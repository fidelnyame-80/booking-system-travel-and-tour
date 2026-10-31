import { BookingError } from "@/lib/booking";
import { findBooking } from "@/lib/store";
export async function GET(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await params;
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (!/^[a-f0-9-]{72}$/i.test(token) || !/^TG-[A-F0-9]{12}$/.test(reference)) throw new BookingError("Booking not found.", 404);
    const booking = await findBooking(reference, token);
    if (!booking) throw new BookingError("Booking not found.", 404);
    return Response.json({ booking }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return Response.json({ error: error instanceof BookingError ? error.message : "We couldn’t load your booking. Please try again." }, { status: error instanceof BookingError ? error.status : 503 });
  }
}
