import {
  ACTIVE_STATUSES,
  addDays,
  daysBetween,
  scheduleProject,
  type Persona,
  type PlanBookingInput,
  type PlanBookingResult,
  type PlanRequest,
  type ProjectPlanResponse,
} from '@lablink/shared';
import type { AiService } from '../ai/aiService.js';
import type { Clock } from '../lib/clock.js';
import { HttpError, badRequest, forbidden } from '../lib/errors.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { BookingService } from './bookingService.js';
import { BOOKING_HORIZON_DAYS } from './bookingService.js';
import type { CatalogService } from './catalogService.js';

/**
 * AI project planner: Gemini proposes the steps of a project, the
 * deterministic scheduler turns them into a feasible multi-equipment timetable,
 * and booking goes through the normal booking rules (approval, capacity, fairness).
 */
export class PlannerService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly catalog: CatalogService,
    private readonly bookings: BookingService,
    private readonly ai: AiService,
    private readonly clock: Clock,
  ) {}

  async plan(persona: Persona, request: PlanRequest): Promise<ProjectPlanResponse> {
    this.assertStudent(persona);
    const today = this.clock.today();
    if (request.deadline < today) throw badRequest('The deadline is in the past');
    if (request.deadline > addDays(today, BOOKING_HORIZON_DAYS)) {
      throw badRequest(`Plans can cover up to ${BOOKING_HORIZON_DAYS} days ahead`);
    }

    const decomposition = await this.ai.decomposeProject(
      request.description,
      today,
      request.deadline,
    );
    if (decomposition.steps.length === 0) {
      throw badRequest(
        'Could not identify lab work in that description. Mention the processes you need, e.g. “mill a PCB”, “train a model”, “laser-cut a frame”.',
      );
    }

    const active = await this.repo.list({ statuses: ACTIVE_STATUSES });
    const schedule = scheduleProject({
      steps: decomposition.steps,
      deadline: request.deadline,
      from: { date: today, hour: this.clock.hour() + 1 },
      equipment: this.catalog.equipment,
      labs: this.catalog.labs,
      bookings: active,
      userId: persona.id,
    });

    const byId = new Map(decomposition.steps.map((s) => [s.id, s]));
    return {
      source: decomposition.source,
      title: decomposition.title,
      summary: decomposition.summary,
      deadline: request.deadline,
      // Every scheduled step id comes from the decomposition, so the lookup always succeeds.
      steps: schedule.steps.flatMap((result) => {
        const step = byId.get(result.stepId);
        return step ? [{ ...step, schedule: result }] : [];
      }),
      feasible: schedule.feasible,
      ...(schedule.finish && {
        finish: schedule.finish,
        slackDays: daysBetween(schedule.finish.date, request.deadline),
      }),
    };
  }

  /**
   * Books every session of an accepted plan. Each booking is validated by the
   * regular booking rules (the plan is never trusted blindly); failures are
   * reported per session instead of aborting the rest.
   */
  async book(persona: Persona, input: PlanBookingInput): Promise<PlanBookingResult> {
    this.assertStudent(persona);
    const results: PlanBookingResult['results'] = [];
    for (const item of input.items) {
      try {
        const { booking, outcome } = await this.bookings.create(persona, {
          equipmentId: item.equipmentId,
          slot: item.slot,
          project: { ...input.project, requirements: item.requirements },
        });
        results.push({
          equipmentId: item.equipmentId,
          slot: item.slot,
          outcome,
          bookingId: booking.id,
        });
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        results.push({
          equipmentId: item.equipmentId,
          slot: item.slot,
          outcome: 'failed',
          error: error.message,
        });
      }
    }
    return { results };
  }

  private assertStudent(persona: Persona): void {
    if (persona.role !== 'student') throw forbidden('The project planner is for students');
  }
}
