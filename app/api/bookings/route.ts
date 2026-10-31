import { BookingError, validateBooking } from "@/lib/booking";
import { createBooking } from "@/lib/store";
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    // Next may normalize request.url to localhost behind a proxy. Compare the
    // browser origin to the actual HTTP Host instead of the internal URL.
    if (origin) {
      let originHost = "";
      try { originHost = new URL(origin).host; } catch { /* Reject malformed origins. */ }
      if (!originHost || originHost !== request.headers.get("host")) throw new BookingError("Please submit your booking from this website.", 403);
    }
    if (!request.headers.get("content-type")?.includes("application/json")) throw new BookingError("Unsupported request format.", 415);
    if (Number(request.headers.get("content-length") || 0) > 12000) throw new BookingError("Your booking details are too long.", 413);
    const text = await request.text();
    if (text.length > 12000) throw new BookingError("Your booking details are too long.", 413);
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { throw new BookingError("Please check your booking details."); }
    const booking = await createBooking(validateBooking(payload));
    // Payment integration intentionally deferred: no paid status or card collection.
    return Response.json({ booking }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof BookingError)) console.error("Booking creation failed:", (error as Error).name);
    return Response.json({ error: error instanceof BookingError ? error.message : "We couldn’t save your booking. Please try again." }, { status: error instanceof BookingError ? error.status : 503 });
  }
}
