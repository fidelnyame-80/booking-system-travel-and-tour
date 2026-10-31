"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { dateLabel, money, trips } from "@/lib/catalog";
import type { Booking } from "@/lib/booking";
import { Chevron, downloadBooking, readBookingKeys } from "./booking-flow";

export default function MyBookings({ onExplore, onBack }: { onExplore: () => void; onBack: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("all");
  const [cancelReference, setCancelReference] = useState("");
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.allSettled(readBookingKeys().map(async key => {
      const response = await fetch(`/api/bookings/${encodeURIComponent(key.reference)}`, { headers: { Authorization: `Bearer ${key.token}` }, signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data.booking as Booking;
    })).then(results => {
      if (controller.signal.aborted) return;
      setBookings(results.flatMap(result => result.status === "fulfilled" ? [result.value] : []).reverse());
      if (results.some(result => result.status === "rejected")) setError("Some bookings couldn’t be loaded. Please try again.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [retry]);
  async function cancel(reference: string) {
    if (cancelling) return;
    setCancelling(true);
    setError("");
    try {
      const key = readBookingKeys().find(item => item.reference === reference);
      if (!key) throw new Error("This booking’s access key is unavailable in this browser.");
      const response = await fetch(`/api/bookings/${reference}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${key.token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBookings(items => items.map(item => item.reference === reference ? data.booking : item));
      setCancelReference("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t cancel the request. Please try again."); }
    finally { setCancelling(false); }
  }
  const visible = bookings.filter(booking => filter === "all" || (filter === "active" ? booking.status !== "cancelled" : booking.status === "cancelled"));
  return <section aria-label="My bookings">
    <header className="booking-header"><button className="header-back" aria-label="Back to booking" onClick={onBack}><Chevron /></button><div><span className="brand-line">CRUISE GETAWAYS</span><h1>MY BOOKINGS</h1></div><button className="header-bookings" onClick={onExplore}>New<br />booking</button></header>
    <div className="bookings-content"><div className="bookings-intro"><h2>YOUR TRIPS</h2><span>{String(bookings.length).padStart(2, "0")} bookings</span></div><div className="booking-filters">{[{ id: "all", label: "All" }, { id: "active", label: "Active" }, { id: "cancelled", label: "Cancelled" }].map(item => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
      {loading ? <p role="status" className="loading-message">Loading your bookings…</p> : <>
        {error && <div className="form-error" role="alert">{error}<button className="text-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {visible.length === 0 && !error ? <div className="empty-state"><span className="empty-number">00</span><h3>{bookings.length ? "NO MATCHING BOOKINGS" : "YOUR NEXT TRIP STARTS HERE"}</h3><p>{bookings.length ? "Try a different booking filter." : "Choose a trip and departure date to make your first booking."}</p><button className="primary-button" onClick={onExplore}>BOOK A GETAWAY</button></div> : <div className="bookings-list">{visible.map(booking => {
          const trip = trips.find(trip => trip.id === booking.tripId);
          if (!trip) return null;
          return <article className="saved-booking" key={booking.reference}>
            <div className="saved-booking-top"><Image src={trip.image} alt="" width={64} height={64} /><div><span className="record-reference">{booking.reference}</span><h3>{trip.subtitle}</h3><p>{dateLabel(booking.date)} · {booking.guests} {booking.guests === 1 ? "traveller" : "travellers"}</p></div></div>
            <div className="status-line"><span><i className={booking.status === "cancelled" ? "cancelled-dot" : ""} />{booking.status === "cancelled" ? "Cancelled" : "Awaiting confirmation"}</span><strong>{money(booking.total)}</strong></div>
            <div className="saved-booking-actions"><span>{booking.status === "cancelled" ? "No payment due" : "Payment pending"}</span><button className="text-button" onClick={() => downloadBooking(booking, trip)}>Download request</button></div>
            {booking.status === "requested" && (cancelReference === booking.reference ? <div className="cancel-confirmation" role="group" aria-label="Confirm cancellation"><p>Cancel this booking request? Your places will be released.</p><div><button className="secondary-button" disabled={cancelling} onClick={() => setCancelReference("")}>KEEP BOOKING</button><button className="primary-button" disabled={cancelling} onClick={() => cancel(booking.reference)}>{cancelling ? "CANCELLING…" : "YES, CANCEL"}</button></div></div> : <button className="cancel-request" onClick={() => setCancelReference(booking.reference)}>Cancel request</button>)}
          </article>;
        })}</div>}
      </>}
      <p className="small-note">Bookings are saved to this browser. Keep your reference; clearing browser data removes these shortcuts.</p>
    </div>
  </section>;
}
