import type { PlanBookingResult, ProjectPlanResponse } from '@lablink/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { sanitiseSteps } from '../src/ai/aiService.js';
import { decomposeFallback } from '../src/ai/fallbacks.js';
import type { JsonGenerationRequest, LlmClient } from '../src/ai/llmClient.js';
import { equipment } from '../src/data/catalog.js';
import { buildTestApp, loginAs } from './helpers.js';

const DESCRIPTION =
  'Final-year drone: mill the flight-controller PCB, debug its I2C sensors on an oscilloscope, then laser cut the acrylic frame.';

const fakeLlm = (respond: () => unknown): LlmClient => ({
  async generateJson<T>(req: JsonGenerationRequest<T>): Promise<T> {
    return req.validator.parse(respond());
  },
});

describe('project decomposition', () => {
  it('maps everyday language to an ordered chain of steps without AI', () => {
    const plan = decomposeFallback(DESCRIPTION, equipment);
    expect(plan.source).toBe('fallback');
    // One step per machine, in the order the student mentioned them, each after the previous one.
    expect(plan.steps.map((s) => s.title)).toEqual([
      'PCB milling',
      'Oscilloscope',
      'Sensors',
      'Laser cutting',
    ]);
    plan.steps.slice(1).forEach((s, i) => expect(s.dependsOn).toEqual([plan.steps[i]!.id]));
    expect(plan.steps.flatMap((s) => s.requirements)).toEqual(
      expect.arrayContaining(['pcb-milling', 'oscilloscope', 'laser-cutting']),
    );
  });

  it('sanitises model output: unknown tags, empty steps, hours and forward dependencies', () => {
    const vocabulary = new Set(['pcb-milling', 'oscilloscope']);
    const steps = sanitiseSteps(
      [
        {
          title: 'Mill',
          purpose: 'p',
          requirements: ['PCB-Milling', 'warp-drive'],
          hours: 40,
          dependsOn: [1],
        },
        { title: 'Dream', purpose: 'p', requirements: ['warp-drive'], hours: 2, dependsOn: [] },
        {
          title: 'Debug',
          purpose: 'p',
          requirements: ['oscilloscope'],
          hours: 0.6,
          dependsOn: [0, 1],
        },
      ],
      vocabulary,
    );
    expect(steps).toEqual([
      {
        id: 's1',
        title: 'Mill',
        purpose: 'p',
        requirements: ['pcb-milling'],
        hours: 12,
        dependsOn: [],
      },
      {
        id: 's2',
        title: 'Debug',
        purpose: 'p',
        requirements: ['oscilloscope'],
        hours: 1,
        dependsOn: ['s1'],
      },
    ]);
  });
});

describe('planner API', () => {
  it('builds a feasible cross-department timetable in dependency order', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    const { body } = (await student
      .post('/api/planner/plan')
      .send({ description: DESCRIPTION, deadline: '2026-12-15' })
      .expect(200)) as {
      body: ProjectPlanResponse;
    };
    expect(body.feasible).toBe(true);
    expect(body.slackDays).toBeGreaterThan(0);
    const scheduled = body.steps.map((s) => s.schedule).filter((s) => s.status === 'scheduled');
    expect(scheduled).toHaveLength(body.steps.length);
    expect(scheduled[0]!.equipmentId).toBe('pcb-lpkf');
    expect(scheduled.at(-1)!.equipmentId).toMatch(/^laser-/);
    // Each step starts only after the previous one ends (steps form a chain).
    const key = (date: string, hour: number) => `${date}T${String(hour).padStart(2, '0')}`;
    for (let i = 1; i < scheduled.length; i++) {
      const end = scheduled[i - 1]!.sessions.at(-1)!;
      const start = scheduled[i]!.sessions[0]!;
      expect(key(start.date, start.startHour) >= key(end.date, end.endHour)).toBe(true);
    }
  });

  it('uses Gemini’s breakdown when available', async () => {
    const llm = fakeLlm(() => ({
      title: 'Drone build',
      summary: 'Mill the PCB then laser-cut the airframe for the expo.',
      steps: [
        {
          title: 'Mill PCB',
          purpose: 'Make the board',
          requirements: ['pcb-milling'],
          hours: 2,
          dependsOn: [],
        },
        {
          title: 'Cut frame',
          purpose: 'Make the airframe',
          requirements: ['laser-cutting'],
          hours: 2,
          dependsOn: [0],
        },
      ],
    }));
    const { app } = buildTestApp({ llm });
    const student = await loginAs(app, 's-zara');
    const res = await student
      .post('/api/planner/plan')
      .send({ description: DESCRIPTION, deadline: '2026-12-15' })
      .expect(200);
    expect(res.body).toMatchObject({ source: 'gemini', title: 'Drone build', feasible: true });
    expect(res.body.steps[0].schedule.equipmentId).toBe('pcb-lpkf');
  });

  it('books every session through the normal booking rules', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    const plan = (
      await student
        .post('/api/planner/plan')
        .send({ description: DESCRIPTION, deadline: '2026-12-15' })
    ).body as ProjectPlanResponse;
    const items = plan.steps.flatMap((s) =>
      s.schedule.status === 'scheduled'
        ? s.schedule.sessions.map((slot) => ({
            equipmentId: s.schedule.status === 'scheduled' ? s.schedule.equipmentId : '',
            slot,
            requirements: s.requirements,
          }))
        : [],
    );
    const res = await student
      .post('/api/planner/book')
      .send({
        project: {
          title: plan.title,
          summary: 'Drone build with PCB, debugging and a laser-cut frame.',
          deadline: plan.deadline,
        },
        items,
      })
      .expect(201);
    const { results } = res.body as PlanBookingResult;
    expect(results).toHaveLength(items.length);
    expect(results.every((r) => r.outcome !== 'failed')).toBe(true);

    // Booking the same plan again fails per session (already booked) instead of crashing.
    const again = await student
      .post('/api/planner/book')
      .send({
        project: {
          title: plan.title,
          summary: 'Drone build with PCB, debugging and a laser-cut frame.',
          deadline: plan.deadline,
        },
        items,
      })
      .expect(201);
    expect((again.body as PlanBookingResult).results.every((r) => r.outcome === 'failed')).toBe(
      true,
    );
  });

  it('explains when nothing in the description maps to lab work', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    const res = await student
      .post('/api/planner/plan')
      .send({
        description: 'Write an essay about medieval poetry and its rhythm',
        deadline: '2026-12-15',
      })
      .expect(400);
    expect(res.body.error.message).toMatch(/Could not identify lab work/);
  });

  it('validates deadlines and restricts planning to students', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    await student
      .post('/api/planner/plan')
      .send({ description: DESCRIPTION, deadline: '2026-11-01' })
      .expect(400);
    await student
      .post('/api/planner/plan')
      .send({ description: DESCRIPTION, deadline: '2027-06-01' })
      .expect(400);
    const faculty = await loginAs(app, 'f-rao');
    await faculty
      .post('/api/planner/plan')
      .send({ description: DESCRIPTION, deadline: '2026-12-15' })
      .expect(403);
    await request(app)
      .post('/api/planner/plan')
      .send({ description: DESCRIPTION, deadline: '2026-12-15' })
      .expect(401);
  });
});
