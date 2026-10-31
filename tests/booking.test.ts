import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { test } from "node:test";
import { validateBooking, BookingError, type BookingInput } from "../lib/booking";
import { departureDates, trips } from "../lib/catalog";

process.env.BOOKING_DATA_DIR = path.join(process.cwd(), ".test-data", `unit-${randomUUID()}`);
delete process.env.DATABASE_URL;
const { createBooking, findBooking, getDepartures, cancelBooking } = await import("../lib/store");
const makeInput = (overrides = {}): BookingInput => validateBooking({
  tripId: "cape-coast", date: departureDates()[0], guests: 1,
  name: "Test Traveller", email: "traveller@example.com", phone: "+233240000000", notes: "",
  paymentMethod: "mobile-money", acceptedTerms: true, idempotencyKey: randomUUID(),
  accessToken: randomUUID() + randomUUID(), ...overrides,
});

test("rejects invalid traveller counts, contact details, dates, and missing consent", () => {
  for (const guests of [0, 9, 1.5, "2", null]) assert.throws(() => makeInput({ guests }), BookingError);
  for (const field of [{ email: "invalid" }, { phone: "bad" }, { name: " " }, { acceptedTerms: false }, { tripId: "unknown" }, { date: "2020-01-01" }, { date: "2027-02-30" }, { paymentMethod: "paid" }]) assert.throws(() => makeInput(field), BookingError);
});
test("departure dates are valid UTC Fridays/Saturdays across year boundaries", () => {
  const dates = departureDates(new Date("2026-12-31T23:59:00Z"));
  assert.equal(dates[0], "2027-01-02");
  assert.ok(dates.every(d => [5, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())));
  assert.equal(new Set(dates).size, dates.length);
});
test("server calculates totals, protects lookup, and never marks a payment paid", async () => {
  const input = makeInput({ guests: 2, total: 1, paymentStatus: "paid" });
  const result = await createBooking(input);
  assert.equal(result.total, trips[0].price * 2);
  assert.equal(result.paymentStatus, "unpaid");
  assert.equal(result.status, "requested");
  assert.ok(!("email" in result));
  assert.equal(await findBooking(result.reference, randomUUID() + randomUUID()), null);
  assert.deepEqual(await findBooking(result.reference, input.accessToken), result);
});
test("simultaneous retries create one record and consume capacity once", async () => {
  const input = makeInput({ date: departureDates()[1], guests: 3 });
  const results = await Promise.all(Array.from({ length: 6 }, () => createBooking(input)));
  assert.equal(new Set(results.map(r => r.reference)).size, 1);
  assert.equal((await getDepartures(input.tripId)).find(d => d.date === input.date)?.remaining, 9);
  await assert.rejects(createBooking({ ...input, guests: 4 }), (error: unknown) => error instanceof BookingError && error.status === 409);
});
test("concurrent groups cannot overbook the last places", async () => {
  const date = departureDates()[2];
  const results = await Promise.allSettled([createBooking(makeInput({ date, guests: 8 })), createBooking(makeInput({ date, guests: 8 }))]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
  assert.equal((await getDepartures("cape-coast")).find(d => d.date === date)?.remaining, 4);
});

test("cancellation requires the access token and releases capacity exactly once", async () => {
  const input = makeInput({ date: departureDates()[3], guests: 4 });
  const booking = await createBooking(input);
  await assert.rejects(cancelBooking(booking.reference, randomUUID() + randomUUID()), BookingError);
  assert.equal((await getDepartures(input.tripId)).find(item => item.date === input.date)?.remaining, 8);
  const results = await Promise.all(Array.from({ length: 4 }, () => cancelBooking(booking.reference, input.accessToken)));
  assert.ok(results.every(result => result.status === "cancelled"));
  assert.equal((await getDepartures(input.tripId)).find(item => item.date === input.date)?.remaining, 12);
});
