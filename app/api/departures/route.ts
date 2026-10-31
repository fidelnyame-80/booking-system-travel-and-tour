import { BookingError } from "@/lib/booking";
import { getDepartures } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const tripId = new URL(request.url).searchParams.get("trip") || "";
    return Response.json({ departures: await getDepartures(tripId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof BookingError)) console.error("Departure lookup failed:", (error as Error).name);
    return Response.json({ error: error instanceof BookingError ? error.message : "We couldn’t load departure dates. Please try again." }, { status: error instanceof BookingError ? error.status : 503 });
  }
}
