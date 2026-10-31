import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { BookingError, publicBooking, type BookingInput, type StoredBooking } from "./booking";
import { departureDates, trips, type Departure } from "./catalog";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sql = () => neon(process.env.DATABASE_URL!);
const dataFile = path.join(process.env.BOOKING_DATA_DIR || path.join(process.cwd(), ".data"), "bookings.json");
function assertStorage() {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") throw new BookingError("We couldn’t connect to reservations. Please try again shortly.", 503);
}
// Disk storage is local-development only. The queue survives hot reloads.
const state = globalThis as typeof globalThis & { bookingQueue?: Promise<unknown> };
async function locked<T>(operation: () => Promise<T>): Promise<T> {
  const result = (state.bookingQueue || Promise.resolve()).then(operation, operation);
  state.bookingQueue = result.catch(() => undefined);
  return result;
}
async function readLocal(): Promise<StoredBooking[]> {
  try { return JSON.parse(await readFile(dataFile, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
export async function getDepartures(tripId: string): Promise<Departure[]> {
  if (!trips.some(trip => trip.id === tripId)) throw new BookingError("Trip not found.", 404);
  const dates = departureDates();
  if (process.env.DATABASE_URL) {
    const rows = await sql()`SELECT departure_date::text AS date, capacity - reserved AS remaining FROM departures WHERE trip_id = ${tripId} AND departure_date >= ${dates[0]}::date AND departure_date <= ${dates[dates.length - 1]}::date ORDER BY departure_date`;
    return rows.filter(row => dates.includes(row.date)).map(row => ({ date: row.date, remaining: Number(row.remaining) }));
  }
  assertStorage();
  const bookings = await readLocal();
  return dates.map(date => ({ date, remaining: Math.max(0, 12 - bookings.filter(b => b.tripId === tripId && b.date === date && b.status !== "cancelled").reduce((sum, b) => sum + b.guests, 0)) }));
}
export async function createBooking(input: BookingInput) {
  assertStorage();
  const { accessToken, acceptedTerms, ...details } = input;
  void acceptedTerms;
  const tokenHash = hash(accessToken);
  const requestHash = hash(JSON.stringify(details));
  const trip = trips.find(trip => trip.id === input.tripId)!;
  const booking: StoredBooking = {
    ...details, reference: `TG-${randomBytes(6).toString("hex").toUpperCase()}`,
    total: trip.price * input.guests, tokenHash, requestHash,
    status: "requested", paymentStatus: "unpaid", createdAt: new Date().toISOString(),
  };
  const checkExisting = (existing: StoredBooking) => {
    if (existing.tokenHash !== tokenHash || existing.requestHash !== requestHash) throw new BookingError("This request has already been used. Please start a new booking.", 409);
    return publicBooking(existing);
  };
  if (process.env.DATABASE_URL) {
    const db = sql();
    // Serialize retries, then atomically reserve capacity and create the record.
    const results = await db.transaction([
      db`SELECT pg_advisory_xact_lock(hashtextextended(${input.idempotencyKey}, 0))`,
      db`WITH existing AS (
        SELECT payload FROM bookings WHERE idempotency_key = ${input.idempotencyKey}
      ), available AS (
        UPDATE departures SET reserved = reserved + ${input.guests}
        WHERE trip_id = ${input.tripId} AND departure_date = ${input.date}::date
        AND capacity - reserved >= ${input.guests} AND NOT EXISTS (SELECT 1 FROM existing)
        RETURNING trip_id
      ), inserted AS (
        INSERT INTO bookings (reference, idempotency_key, token_hash, trip_id, departure_date, guests, total_pesewas, payload)
        SELECT ${booking.reference}, ${input.idempotencyKey}, ${tokenHash}, ${input.tripId}, ${input.date}::date, ${input.guests}, ${booking.total * 100}, ${JSON.stringify(booking)}::jsonb
        FROM available RETURNING payload
      ) SELECT payload FROM existing UNION ALL SELECT payload FROM inserted`,
    ]);
    const row = results[1][0];
    if (!row) throw new BookingError("There aren’t enough places left on this departure. Please choose another date.", 409);
    return checkExisting(row.payload as StoredBooking);
  }
  return locked(async () => {
    const bookings = await readLocal();
    const existing = bookings.find(b => b.idempotencyKey === input.idempotencyKey);
    if (existing) return checkExisting(existing);
    const reserved = bookings.filter(b => b.tripId === input.tripId && b.date === input.date && b.status !== "cancelled").reduce((sum, b) => sum + b.guests, 0);
    if (reserved + input.guests > 12) throw new BookingError("There aren’t enough places left on this departure. Please choose another date.", 409);
    bookings.push(booking);
    await mkdir(path.dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(temporary, JSON.stringify(bookings), { mode: 0o600 });
    await rename(temporary, dataFile);
    return publicBooking(booking);
  });
}
export async function findBooking(reference: string, token: string) {
  assertStorage();
  const tokenHash = hash(token);
  if (process.env.DATABASE_URL) {
    const rows = await sql()`SELECT payload FROM bookings WHERE reference = ${reference} AND token_hash = ${tokenHash}`;
    return rows[0] ? publicBooking(rows[0].payload as StoredBooking) : null;
  }
  const booking = (await readLocal()).find(b => b.reference === reference && b.tokenHash === tokenHash);
  return booking ? publicBooking(booking) : null;
}

export async function cancelBooking(reference: string, token: string) {
  assertStorage();
  const tokenHash = hash(token);
  if (process.env.DATABASE_URL) {
    const db = sql();
    const result = await db.transaction([
      db`SELECT pg_advisory_xact_lock(hashtextextended(${reference}, 0))`,
      db`WITH cancelled AS (
        UPDATE bookings SET status = 'cancelled', payload = jsonb_set(payload, '{status}', '"cancelled"'::jsonb)
        WHERE reference = ${reference} AND token_hash = ${tokenHash} AND status = 'requested'
        RETURNING trip_id, departure_date, guests, payload
      ), released AS (
        UPDATE departures SET reserved = reserved - cancelled.guests FROM cancelled
        WHERE departures.trip_id = cancelled.trip_id AND departures.departure_date = cancelled.departure_date
        RETURNING departures.trip_id
      ) SELECT payload FROM cancelled UNION ALL
        SELECT payload FROM bookings WHERE reference = ${reference} AND token_hash = ${tokenHash}
        AND NOT EXISTS (SELECT 1 FROM cancelled)`,
    ]);
    const booking = result[1][0]?.payload as StoredBooking | undefined;
    if (!booking) throw new BookingError("Booking not found.", 404);
    if (booking.status !== "cancelled") throw new BookingError("This booking can no longer be cancelled online. Please contact the agency.", 409);
    return publicBooking(booking);
  }
  return locked(async () => {
    const bookings = await readLocal();
    const booking = bookings.find(item => item.reference === reference && item.tokenHash === tokenHash);
    if (!booking) throw new BookingError("Booking not found.", 404);
    if (booking.status === "cancelled") return publicBooking(booking);
    booking.status = "cancelled";
    const temporary = `${dataFile}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(temporary, JSON.stringify(bookings), { mode: 0o600 });
    await rename(temporary, dataFile);
    return publicBooking(booking);
  });
}
