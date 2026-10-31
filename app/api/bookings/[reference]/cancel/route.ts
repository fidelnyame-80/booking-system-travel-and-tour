import { BookingError } from "@/lib/booking";
import { cancelBooking } from "@/lib/store";

export async function POST(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await params;
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host")) throw new BookingError("Please manage your booking from this website.", 403);
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    if (!/^[a-f0-9-]{72}$/i.test(token) || !/^TG-[A-F0-9]{12}$/.test(reference)) throw new BookingError("Booking not found.", 404);
    const booking = await cancelBooking(reference, token);
    return Response.json({ booking }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return Response.json({ error: error instanceof BookingError ? error.message : "We couldn’t cancel your request. Please try again." }, { status: error instanceof BookingError ? error.status : 503 });
  }
}
