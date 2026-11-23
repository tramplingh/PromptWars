import type { Alternative, AllocationPlan, PriorityScore } from './allocation.js';
import type { DayAvailability } from './availability.js';
import type { Booking, Department, Equipment, Lab, Persona } from './domain.js';

/** Response contracts for the LabLink HTTP API. */

export type AiSource = 'gemini' | 'fallback';

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface SessionInfo {
  persona: Persona | null;
}

export interface Catalog {
  departments: Department[];
  labs: Lab[];
  equipment: Equipment[];
}

export interface EquipmentDetail {
  equipment: Equipment;
  lab: Lab;
  department: Department;
  availability: DayAvailability[];
}

export interface BookingView extends Booking {
  equipmentName: string;
  userName: string;
}

export type BookingOutcome = 'confirmed' | 'awaiting-approval' | 'queued-for-resolution';

export interface CreateBookingResponse {
  booking: BookingView;
  outcome: BookingOutcome;
}

/** Body of a 409 response when the requested slot is already taken. */
export interface SlotTakenDetails {
  alternatives: Alternative[];
}

export interface ScoredBooking extends BookingView {
  score: PriorityScore;
  conflictId?: string;
}

export interface ApprovalQueue {
  pending: ScoredBooking[];
  conflicts: AllocationPlan[];
}

export interface ApplyPlanResponse {
  updated: BookingView[];
}

export interface AiSearchResponse {
  source: AiSource;
  results: { equipmentId: string; reason: string }[];
}

export interface AiDraftResponse {
  source: AiSource;
  title: string;
  summary: string;
  requirements: string[];
  suggestedHours: number;
}

export interface ConflictExplanation {
  source: AiSource;
  overview: string;
  perStudent: { bookingId: string; message: string }[];
}

export interface UtilisationItem {
  equipmentId: string;
  name: string;
  departmentId: string;
  approvedHours: number;
  pendingHours: number;
  capacityHours: number;
  /** approvedHours / capacityHours, 0–1. */
  utilisation: number;
}

export interface UtilisationReport {
  from: string;
  to: string;
  items: UtilisationItem[];
  /** Approved+pending load per opening hour across all equipment. */
  peakHours: { hour: number; load: number }[];
  overall: number;
}

export interface Insight {
  title: string;
  detail: string;
  action: string;
}

export interface InsightsResponse {
  source: AiSource;
  insights: Insight[];
}
