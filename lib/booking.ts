import { departureDates, trips } from "./catalog";
export class BookingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type PaymentMethod = "mobile-money" | "card";
export type BookingInput = {
  tripId: string; date: string; guests: number; name: string; email: string;
  phone: string; notes: string; paymentMethod: PaymentMethod; acceptedTerms: true;
  idempotencyKey: string; accessToken: string;
};
export type Booking = {
  reference: string; tripId: string; date: string; guests: number; total: number;
  paymentMethod: PaymentMethod; status: "requested" | "cancelled"; paymentStatus: "unpaid"; createdAt: string;
};
export type StoredBooking = Booking & {
  name: string; email: string; phone: string; notes: string;
  idempotencyKey: string; tokenHash: string; requestHash: string;
};
export function validateBooking(value: unknown, now = new Date()): BookingInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BookingError("Please check your booking details.");
  const data = value as Record<string, unknown>;
  const str = (key: string, max: number, optional = false) => {
    const value = data[key];
    if (typeof value !== "string" || (!optional && !value.trim()) || value.length > max) throw new BookingError(`Please check your ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
    return value.trim();
  };
  const tripId = str("tripId", 50);
  if (!trips.some(trip => trip.id === tripId)) throw new BookingError("Please choose a listed trip.");
  const date = str("date", 10);
  if (!departureDates(now).includes(date)) throw new BookingError("This departure is no longer available. Please choose another date.", 409);
  const guests = data.guests;
  if (typeof guests !== "number" || !Number.isInteger(guests) || guests < 1 || guests > 8) throw new BookingError("Choose between 1 and 8 travellers.");
  const name = str("name", 100);
  if (name.length < 2) throw new BookingError("Please enter your full name.");
  const email = str("email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BookingError("Please enter a valid email address.");
  const phone = str("phone", 30);
  if (!/^\+?[\d\s().-]{7,30}$/.test(phone) || phone.replace(/\D/g, "").length < 7) throw new BookingError("Please enter a valid phone number.");
  const notes = str("notes", 1000, true);
  const paymentMethod = data.paymentMethod;
  if (paymentMethod !== "mobile-money" && paymentMethod !== "card") throw new BookingError("Please choose a payment preference.");
  if (data.acceptedTerms !== true) throw new BookingError("Please accept the booking terms to continue.");
  const idempotencyKey = str("idempotencyKey", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) throw new BookingError("Please refresh and try again.");
  const accessToken = str("accessToken", 72);
  if (!/^[a-f0-9-]{72}$/i.test(accessToken)) throw new BookingError("Please refresh and try again.");
  return { tripId, date, guests, name, email, phone, notes, paymentMethod, acceptedTerms: true, idempotencyKey, accessToken };
}
export function publicBooking(booking: StoredBooking): Booking {
  const { reference, tripId, date, guests, total, paymentMethod, status, paymentStatus, createdAt } = booking;
  return { reference, tripId, date, guests, total, paymentMethod, status, paymentStatus, createdAt };
}
