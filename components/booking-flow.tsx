"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { dateLabel, money, trips, type Departure, type Trip } from "@/lib/catalog";
import type { Booking, PaymentMethod } from "@/lib/booking";

export type BookingKey = { reference: string; token: string };
export function readBookingKeys(): BookingKey[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("cruise-bookings") || "[]");
    return Array.isArray(stored) ? stored.filter((key): key is BookingKey => key && typeof key.reference === "string" && typeof key.token === "string").slice(-30) : [];
  } catch { return []; }
}
export function downloadBooking(booking: Booking, trip: Trip) {
  const text = `CRUISE GETAWAYS\nBooking request\n\nReference: ${booking.reference}\nTrip: ${trip.subtitle}\nDeparture: ${dateLabel(booking.date)}\nTravellers: ${booking.guests}\nTotal: ${money(booking.total)}\nIncludes accommodation and return transport from Accra.\n\nStatus: ${booking.status === "cancelled" ? "Cancelled" : "Awaiting confirmation"}\nPayment: Unpaid\nPreference: ${booking.paymentMethod === "card" ? "Card" : "Mobile money"}\n\n${booking.status === "cancelled" ? "This request has been cancelled. No payment is due." : "Your request is not yet a confirmed booking. No payment has been taken."} Keep this reference for correspondence with our team.\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${booking.reference}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function mondayOf(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function Chevron({ direction = "left" }: { direction?: "left" | "right" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={direction === "left" ? "m14 5-7 7 7 7" : "m10 5 7 7-7 7"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function BookingFlow({ onViewBookings, onComplete }: { onViewBookings: () => void; onComplete: () => void }) {
  const [trip, setTrip] = useState(trips[0]);
  const [step, setStep] = useState(0);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [week, setWeek] = useState("");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState(1);
  const [details, setDetails] = useState({ name: "", email: "", phone: "", notes: "" });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile-money");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const attempt = useRef<{ fingerprint: string; key: string; token: string } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const submitLock = useRef(false);
  const guestRef = useRef(guests);
  guestRef.current = guests;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/departures?trip=${trip.id}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data.departures as Departure[];
      })
      .then(items => {
        setDepartures(items);
        setDate(previous => items.some(item => item.date === previous && item.remaining >= guestRef.current) ? previous : "");
        setWeek(previous => previous && items.some(item => item.date >= previous && item.date <= addDays(previous, 6)) ? previous : items[0] ? mondayOf(items[0].date) : "");
      })
      .catch(reason => { if (reason.name !== "AbortError") setError(reason.message || "We couldn’t load departures. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [trip.id, reload]);

  useLayoutEffect(() => {
    if (step > 0 || booking) {
      window.scrollTo({ top: 0, behavior: "instant" });
      title.current?.focus({ preventScroll: true });
    }
  }, [step, booking]);

  const chosen = departures.find(item => item.date === date);
  const total = trip.price * guests;
  const weekDates = week ? Array.from({ length: 7 }, (_, index) => addDays(week, index)) : [];
  const firstWeek = departures[0] ? mondayOf(departures[0].date) : "";
  const lastWeek = departures.length ? mondayOf(departures[departures.length - 1].date) : "";
  const names: Record<string, string> = { "cape-coast": "CAPE COAST", volta: "VOLTA", akosombo: "AKOSOMBO", kumasi: "KUMASI" };

  function next(event: FormEvent) {
    event.preventDefault();
    if (step === 0 && (!chosen || chosen.remaining < guests)) {
      setError("Choose an available departure date for your group.");
      return;
    }
    setError("");
    setStep(current => current + 1);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    if (!accepted) { setError("Please accept the booking terms to continue."); return; }
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      const payload = { tripId: trip.id, date, guests, ...details, paymentMethod, acceptedTerms: true };
      const fingerprint = JSON.stringify(payload);
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID(), token: crypto.randomUUID() + crypto.randomUUID() };
      const current = attempt.current;
      const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, idempotencyKey: current.key, accessToken: current.token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn’t save your booking. Please try again.");
      const result = data.booking as Booking;
      try {
        const keys = readBookingKeys().filter(key => key.reference !== result.reference);
        localStorage.setItem("cruise-bookings", JSON.stringify([...keys, { reference: result.reference, token: current.token }].slice(-30)));
      } catch { setStorageWarning(true); }
      setBooking(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please check your connection and try again.");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const header = <header className="booking-header">
    <button className="header-back" aria-label={step > 0 && !booking ? "Previous booking step" : "My bookings"} disabled={submitting} onClick={() => { if (step > 0 && !booking) { setStep(step - 1); setError(""); } else onViewBookings(); }}><Chevron /></button>
    <div><span className="brand-line">CRUISE GETAWAYS</span><h1 ref={title} tabIndex={-1}>{booking ? "BOOKING RECEIVED" : step === 0 ? "BOOK A GETAWAY" : step === 1 ? "YOUR DETAILS" : step === 2 ? "CONFIRM BOOKING" : "MOCK PAYMENT"}</h1></div>
    <button className="header-bookings" disabled={submitting} onClick={onViewBookings}>My<br />bookings</button>
  </header>;

  if (booking) return <section aria-label="Booking request received">
    {header}
    <div className="confirmation">
      <div className="confirmation-mark" aria-hidden="true">✓</div>
      <h2>YOUR REQUEST IS IN.</h2>
      <p>We’ll contact you to confirm your trip and payment arrangements.</p>
      <div className="confirmation-ticket">
        <span className="field-label">BOOKING REFERENCE</span><strong className="booking-reference">{booking.reference}</strong>
        <div className="ticket-trip"><Image src={trip.image} alt="" width={64} height={64} /><div><h3>{trip.subtitle}</h3><p>{dateLabel(date)} · {guests} {guests === 1 ? "traveller" : "travellers"}</p></div></div>
        <div className="summary-row"><span>Package total</span><strong>{money(total)}</strong></div>
        <div className="status-line"><span><i />Awaiting confirmation</span><span>Payment pending</span></div>
      </div>
      <p className="small-note">No payment has been taken. Your request is not yet a confirmed booking.</p>
      {storageWarning && <p role="status" className="form-error">This browser couldn’t save your shortcut. Download your request and keep its reference.</p>}
      <button className="primary-button" onClick={() => downloadBooking(booking, trip)}>DOWNLOAD BOOKING REQUEST</button>
      <button className="secondary-button" onClick={onViewBookings}>VIEW MY BOOKINGS</button>
      <button className="text-button" onClick={onComplete}>Make another booking</button>
    </div>
  </section>;

  return <section aria-label="Book a getaway">
    {header}
    <ol className="progress-strip" aria-label="Booking progress">{["TRIP", "DETAILS", "CONFIRM", "PAY"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={step === index ? "active" : step > index ? "done" : ""}><span>{step > index ? "✓" : `0${index + 1}`}</span>{label}</li>)}</ol>
    {step === 0 && <section className="date-strip" aria-label="Departure dates">
      <div className="month-navigation"><button type="button" aria-label="Previous week" disabled={!week || week <= firstWeek || loading} onClick={() => setWeek(addDays(week, -7))}><Chevron /></button><strong>{week ? dateLabel(addDays(week, 4), { month: "long", year: "numeric" }) : "DEPARTURE DATES"}</strong><button type="button" aria-label="Next week" disabled={!week || week >= lastWeek || loading} onClick={() => setWeek(addDays(week, 7))}><Chevron direction="right" /></button></div>
      {loading ? <p className="date-loading" role="status">Loading available dates…</p> : <div className="week-grid">{weekDates.map(day => {
        const departure = departures.find(item => item.date === day);
        const available = departure && departure.remaining >= guests;
        return <label key={day} className={`day-option ${date === day ? "selected" : ""} ${!available ? "unavailable" : ""}`}><input type="radio" name="departure" checked={date === day} disabled={!available} onChange={() => { setDate(day); setError(""); }} aria-label={`${dateLabel(day)}, ${departure?.remaining || 0} places available`} /><span>{dateLabel(day, { weekday: "short" })}</span><strong>{dateLabel(day, { day: "2-digit" })}</strong><i aria-hidden="true" /></label>;
      })}</div>}
      <div className="date-strip-note">{date ? `${dateLabel(date, { weekday: "long", day: "numeric", month: "short" })} · ${chosen?.remaining || 0} places available` : "Select an available date · Friday & Saturday departures"}</div>
    </section>}
    <form className="booking-form" onSubmit={step === 3 ? submit : next}>
      <div className="form-body">
        {step === 0 && <>
          <fieldset className="guest-field"><legend>TRAVELLERS <span>Adults 18+</span></legend><div className="guest-options">{Array.from({ length: 8 }, (_, index) => index + 1).map(count => <label className={guests === count ? "guest-option selected" : "guest-option"} key={count}><input type="radio" name="guests" value={count} checked={guests === count} onChange={() => { setGuests(count); if (chosen && chosen.remaining < count) setDate(""); }} /><span>{count} {count === 1 ? "PERSON" : "PEOPLE"}</span></label>)}</div></fieldset>
          <fieldset className="trip-field"><legend>CHOOSE YOUR TRIP <span>{String(trips.length).padStart(2, "0")} getaways</span></legend><div className="trip-options">{trips.map(option => <label className={trip.id === option.id ? "trip-option selected" : "trip-option"} key={option.id}><input type="radio" name="trip" checked={trip.id === option.id} onChange={() => setTrip(option)} aria-label={option.subtitle} /><Image src={option.image} alt={option.imageAlt} width={72} height={72} loading="eager" /><strong>{names[option.id]}</strong><small>{option.days} DAYS / {option.nights} NIGHTS</small></label>)}</div></fieldset>
          <details className="trip-details"><summary><span>{trip.subtitle}</span><span aria-hidden="true">+</span></summary><div className="trip-details-body"><p>{trip.description}</p><h3>YOUR STAY</h3><p>{trip.stay}. Return road transport from Accra is included. Meals, entry fees, local guides, and optional activities are separate.</p>{trip.itinerary.map((day, index) => <section key={day.title}><h3>DAY 0{index + 1} / {day.title}</h3><p>{day.detail}</p></section>)}</div></details>
          <div className="package-breakdown"><div className="summary-row"><span>Accommodation × {guests}</span><span>{money(trip.accommodation * guests)}</span></div><div className="summary-row"><span>Return transport × {guests}</span><span>{money(trip.transport * guests)}</span></div><p>Twin-share rooms · {trip.days} days, {trip.nights} {trip.nights === 1 ? "night" : "nights"}</p></div>
        </>}
        {step === 1 && <>
          <TripRecap trip={trip} date={date} guests={guests} />
          <div className="section-label"><h2>LEAD TRAVELLER</h2><p>One point of contact for your group.</p></div>
          <div className="form-fields">
            <label>FULL NAME<input name="name" autoComplete="name" placeholder="First and last name" required minLength={2} maxLength={100} value={details.name} onChange={event => setDetails({ ...details, name: event.target.value })} /></label>
            <label>EMAIL ADDRESS<input name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required maxLength={254} value={details.email} onChange={event => setDetails({ ...details, email: event.target.value })} /></label>
            <label>PHONE NUMBER<input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+233 24 000 0000" required minLength={7} maxLength={30} value={details.phone} onChange={event => setDetails({ ...details, phone: event.target.value })} /></label>
            <label>BOOKING NOTES <span className="optional">Optional</span><textarea name="notes" placeholder="Room preferences, accessibility requests, or a special occasion…" maxLength={1000} rows={3} value={details.notes} onChange={event => setDetails({ ...details, notes: event.target.value })} /></label>
          </div>
          <p className="small-note">We’ll use these details to arrange your trip. Please leave out sensitive medical or financial information.</p>
        </>}
        {step === 2 && <>
          <TripRecap trip={trip} date={date} guests={guests} />
          <div className="section-label"><h2>CONFIRM YOUR BOOKING</h2><p>Please check the trip details before we hold your place.</p></div>
          <div className="confirmation-review">
            <div><span>Departure</span><strong>{dateLabel(date)}</strong></div>
            <div><span>Travellers</span><strong>{guests} {guests === 1 ? "adult" : "adults"}</strong></div>
            <div><span>Lead traveller</span><strong>{details.name}</strong></div>
            <div><span>Contact</span><strong>{details.email}<br />{details.phone}</strong></div>
            {details.notes && <div><span>Notes</span><strong>{details.notes}</strong></div>}
          </div>
          <div className="package-breakdown"><div className="summary-row"><span>Accommodation × {guests}</span><span>{money(trip.accommodation * guests)}</span></div><div className="summary-row"><span>Return transport × {guests}</span><span>{money(trip.transport * guests)}</span></div><div className="summary-row review-total"><strong>Booking total</strong><strong>{money(total)}</strong></div></div>
          <p className="small-note">Your place will be held while you complete the payment screen.</p>
        </>}
        {step === 3 && <>
          <TripRecap trip={trip} date={date} guests={guests} />
          <div className="section-label"><h2>PAYMENT</h2><p>Choose your payment method to complete this booking.</p></div>
          <div className="mock-payment-label">DEMO CHECKOUT</div>
          <fieldset className="payment-options"><legend>HOW WOULD YOU LIKE TO PAY?</legend>
            <label className={`payment-option ${paymentMethod === "mobile-money" ? "selected" : ""}`}><input type="radio" name="payment" value="mobile-money" checked={paymentMethod === "mobile-money"} onChange={() => setPaymentMethod("mobile-money")} /><span><strong>Mobile money</strong><small>MTN MoMo · Telecel Cash · AT Money</small></span><span className="payment-wordmark" aria-hidden="true">MoMo</span></label>
            <label className={`payment-option ${paymentMethod === "card" ? "selected" : ""}`}><input type="radio" name="payment" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} /><span><strong>Debit or credit card</strong><small>Visa · Mastercard</small></span><span className="payment-wordmark" aria-hidden="true">CARD</span></label>
          </fieldset>
          <div className="mock-payment-card"><span>{paymentMethod === "card" ? "CARDHOLDER NAME" : "MOBILE MONEY NUMBER"}</span><strong>{paymentMethod === "card" ? details.name.toUpperCase() : details.phone}</strong><small>{paymentMethod === "card" ? "•••• 4242  ·  12/30" : "Payment prompt ready"}</small></div>
          <div className="package-breakdown"><div className="summary-row review-total"><strong>Total in Ghana cedis</strong><strong>{money(total)}</strong></div></div>
          <label className="terms-checkbox"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} required /><span>I have reviewed this booking and would like to continue with the selected payment method.</span></label>
          <p className="small-note">This prototype keeps your payment selection with the booking request.</p>
        </>}
        {error && <div className="form-error" role="alert">{error}<button type="button" className="text-button" onClick={() => { setStep(0); setReload(value => value + 1); }}>Refresh available dates</button></div>}
        {!loading && !departures.length && !error && <div className="form-error" role="status">No departures are available right now.<button type="button" className="text-button" onClick={() => setReload(value => value + 1)}>Refresh available dates</button></div>}
      </div>
      <div className="booking-action-bar"><div className="total-line"><span>PACKAGE TOTAL <small>{guests} {guests === 1 ? "traveller" : "travellers"} · stay + transport</small></span><strong aria-live="polite">{money(total)}</strong></div><button className="primary-button" type="submit" disabled={submitting || (step === 0 && (loading || !date))}>{submitting ? "COMPLETING BOOKING…" : step === 0 ? "CONTINUE TO DETAILS" : step === 1 ? "CONTINUE TO CONFIRMATION" : step === 2 ? "CONFIRM BOOKING" : "COMPLETE MOCK PAYMENT"}</button><p>{step === 0 ? "Choose your date above to continue." : step === 1 ? "Your trip details stay with your booking." : step === 2 ? "Confirm to continue to the payment screen." : "Your payment method will be saved with this booking."}</p></div>
    </form>
  </section>;
}

function TripRecap({ trip, date, guests }: { trip: Trip; date: string; guests: number }) {
  return <div className="trip-recap"><Image src={trip.image} alt="" width={58} height={58} /><div><strong>{trip.subtitle}</strong><p>{dateLabel(date)} · {guests} {guests === 1 ? "traveller" : "travellers"}</p><small>{trip.days} days / {trip.nights} nights · From Accra</small></div></div>;
}
