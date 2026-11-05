// A typed client for the bookings API.
import { z } from 'zod';

export interface Booking {
  id: number;
  room: string;
  starts: Date;
  minutes: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const BASE_URL = 'https://api.example.org/v2';
const TIMEOUT_MS = 8000;

const BookingSchema = z.object({
  id: z.number(),
  room: z.string(),
  starts: z.string(),
  minutes: z.number(),
});

export class BookingClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async list(room?: string): Promise<Result<Booking[]>> {
    const url = room ? `${BASE_URL}/bookings?room=${encodeURIComponent(room)}` : `${BASE_URL}/bookings`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const raw: unknown[] = await res.json();
      return { ok: true, value: raw.map(toBooking) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  async cancel(id: number): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/bookings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${this.token}` } });
    return res.ok;
  }
}

function toBooking(raw: unknown): Booking {
  const b = BookingSchema.parse(raw);
  return { ...b, starts: new Date(b.starts) };
}

export function overlaps(a: Booking, b: Booking): boolean {
  const aEnd = a.starts.getTime() + a.minutes * 60000;
  const bEnd = b.starts.getTime() + b.minutes * 60000;
  return a.room === b.room && a.starts.getTime() < bEnd && b.starts.getTime() < aEnd;
}
