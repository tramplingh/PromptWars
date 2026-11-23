import { randomUUID } from 'node:crypto';

export const newBookingId = (): string => `bk-${randomUUID()}`;
