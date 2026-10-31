"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import BookingFlow from "./booking-flow";
import Dialog from "./dialog";

const MyBookings = dynamic(() => import("./my-bookings"), { loading: () => <p className="loading-message" role="status">Loading your bookings…</p> });

export default function BookingSystem() {
  const [screen, setScreen] = useState<"new" | "bookings">("new");
  const [session, setSession] = useState(0);
  const [panel, setPanel] = useState<"terms" | "privacy" | "credits" | null>(null);
  function navigate(next: "new" | "bookings") {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function startNew() { setSession(value => value + 1); navigate("new"); }
  return <main className="booking-app" id="booking-content">
    <div hidden={screen !== "new"}><BookingFlow key={session} onViewBookings={() => navigate("bookings")} onComplete={startNew} /></div>
    {screen === "bookings" && <MyBookings onExplore={startNew} onBack={() => navigate("new")} />}
    <footer className="app-footer"><button onClick={() => setPanel("terms")}>Booking terms</button><span>·</span><button onClick={() => setPanel("privacy")}>Privacy</button><span>·</span><button onClick={() => setPanel("credits")}>Photo credits</button></footer>
    {panel && <Dialog title={panel === "terms" ? "Booking terms" : panel === "privacy" ? "Privacy" : "Photography"} onClose={() => setPanel(null)}><div className="prose-panel">
      {panel === "terms" ? <><h2>BOOKING TERMS</h2><p>Your request becomes a confirmed booking only when the agency confirms your arrangements. No payment is taken when you send a request.</p><h3>YOUR PACKAGE</h3><p>Prices are in Ghana cedis, per adult, based on twin-share accommodation. The total includes accommodation and return road transport from Accra. Meals, entry fees, guides, and optional activities are excluded unless listed.</p><h3>CHANGES AND CANCELLATION</h3><p>You can cancel an unconfirmed request from My bookings. Final availability, accommodation, payment arrangements, and cancellation terms for confirmed trips will be provided for your approval before confirmation.</p><p>Mention accessibility needs or private-room preferences in your notes. Private rooms are subject to availability and a separately confirmed supplement.</p></> : panel === "privacy" ? <><h2>YOUR BOOKING DETAILS</h2><p>Your name, email, phone number, and travel preferences are used to manage your request and contact you about your trip. Do not enter sensitive medical or financial information in the notes.</p><p>Booking access keys are saved in this browser so you can return to your requests. Card details and mobile-money PINs are never collected here. Keep your downloaded booking record; clearing browser data removes your shortcuts.</p><p>For a correction or deletion, reply to the agency when it contacts you about your request.</p></> : <><h2>DESTINATION PHOTOGRAPHY</h2><p>Images from Wikimedia Commons are resized and cropped for this application. Each image retains its original licence.</p><PhotoCredits /></>}
    </div></Dialog>}
  </main>;
}
function PhotoCredits() {
  const [credits, setCredits] = useState<{ name: string; author: string; source: string; license: string; licenseUrl: string }[]>([]);
  useEffect(() => { fetch("/images/credits.json").then(response => response.json()).then(setCredits).catch(() => setCredits([])); }, []);
  return <ul className="credits-list">{credits.map(credit => <li key={credit.name}><a href={credit.source} target="_blank" rel="noreferrer">{credit.name}</a><span>{credit.author} · <a href={credit.licenseUrl || credit.source} target="_blank" rel="noreferrer">{credit.license}</a></span></li>)}</ul>;
}
