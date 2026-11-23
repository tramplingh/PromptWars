/**
 * Core LabLink domain model. These types are shared verbatim by the API
 * and the web client so both sides always agree on the data contract.
 */

export const ROLES = ['student', 'faculty', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const EQUIPMENT_CATEGORIES = [
  'Electronics',
  'Embedded & IoT',
  'Computing',
  'Fabrication',
  'Biotech',
  'Imaging & Optics',
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export const BOOKING_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'no-show',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that occupy capacity on the equipment calendar. */
export const ACTIVE_STATUSES: readonly BookingStatus[] = ['pending', 'approved'];

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface Lab {
  id: string;
  name: string;
  departmentId: string;
  location: string;
  /** Opening hour in 24h campus local time (inclusive). */
  openHour: number;
  /** Closing hour in 24h campus local time (exclusive). */
  closeHour: number;
}

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  labId: string;
  departmentId: string;
  description: string;
  /** Normalised capability tags used for requirement matching, e.g. "pcb-milling". */
  capabilities: string[];
  /** Number of identical units that can be booked concurrently. */
  units: number;
  /** When true, every booking needs a faculty decision before it is confirmed. */
  requiresApproval: boolean;
  status: 'operational' | 'maintenance';
  maxHoursPerBooking: number;
}

export interface Persona {
  id: string;
  name: string;
  role: Role;
  departmentId: string;
  /** Short descriptor shown in the role switcher, e.g. "B.Tech ECE, Year 3". */
  title: string;
}

/** A contiguous block of whole hours on a single campus-local date. */
export interface TimeSlot {
  /** ISO calendar date, YYYY-MM-DD. */
  date: string;
  startHour: number;
  endHour: number;
}

export interface Project {
  title: string;
  summary: string;
  /** ISO calendar date, YYYY-MM-DD. */
  deadline: string;
  /** Capability tags the work needs; matched against Equipment.capabilities. */
  requirements: string[];
}

export interface Decision {
  by: string;
  note: string;
  at: string;
}

export interface Booking {
  id: string;
  equipmentId: string;
  userId: string;
  slot: TimeSlot;
  project: Project;
  status: BookingStatus;
  /** ISO timestamp. */
  createdAt: string;
  decision?: Decision;
  /** Set when conflict resolution moved this booking to another slot or device. */
  reallocatedFrom?: { equipmentId: string; slot: TimeSlot };
  /** ISO timestamp of a verified check-in at the device. */
  checkedInAt?: string;
  /** Id of the no-show booking whose released slot this booking received. */
  backfilledFrom?: string;
}
