export type Trip = {
  id: string; title: string; subtitle: string; region: string;
  category: "Coast" | "Nature" | "Culture"; image: string; imageAlt: string;
  days: number; nights: number; price: number; accommodation: number; transport: number;
  description: string; stay: string; itinerary: { title: string; detail: string }[];
};

// Working catalogue: agency to approve prices, properties, and schedules before launch.
export const trips: Trip[] = [
  {
    id: "cape-coast", title: "A slower kind of coast.", subtitle: "Cape Coast & Elmina",
    region: "Central Region", category: "Coast", image: "/images/cape-coast.webp",
    imageAlt: "The white walls of Cape Coast Castle overlooking Ghana’s Atlantic coast",
    days: 3, nights: 2, price: 1850, accommodation: 1200, transport: 650,
    description: "Salt in the air. Stories in the walls. Follow the Atlantic to Cape Coast and Elmina for a thoughtful weekend of coastal walks, living history, and time to simply be.",
    stay: "2 nights in a coastal guesthouse · twin-share room",
    itinerary: [
      { title: "Accra to the coast", detail: "Meet in Accra at 7:00 am. Take the coastal road west, settle into your guesthouse, and spend the afternoon by the ocean." },
      { title: "History, at your own pace", detail: "Explore Cape Coast and Elmina. Make time for the castles, the fishing harbour, and a long lunch overlooking the water. Attraction entry and meals are paid separately." },
      { title: "One more ocean morning", detail: "A slow start and a final coastal walk before the return journey to Accra. Expected arrival: 6:00 pm, depending on traffic." },
    ],
  },
  {
    id: "volta", title: "Into the green.", subtitle: "Wli & the Volta Highlands",
    region: "Volta Region", category: "Nature", image: "/images/volta.webp",
    imageAlt: "Wli waterfall cascading down a green cliff in the Volta Region of Ghana",
    days: 3, nights: 2, price: 1650, accommodation: 1050, transport: 600,
    description: "Trade the city’s rhythm for forest paths and falling water. A fresh-air escape to the Volta highlands, with unhurried mornings and room to explore.",
    stay: "2 nights in a highland lodge · twin-share room",
    itinerary: [
      { title: "The road to the highlands", detail: "Depart Accra at 7:00 am. Travel through the Volta Region and settle into your lodge for a quiet evening." },
      { title: "Follow the water", detail: "Walk the forest trail to Wli’s lower falls. Take the afternoon at your own pace. Local guide and entry fees are paid separately." },
      { title: "A little longer in the green", detail: "Enjoy a relaxed morning before the drive back to Accra. Expected arrival: 6:00 pm, depending on traffic." },
    ],
  },
  {
    id: "akosombo", title: "Life by the water.", subtitle: "Akosombo & the Volta River",
    region: "Eastern Region", category: "Nature", image: "/images/akosombo.webp",
    imageAlt: "Green hills and calm water beside the Volta River near Akosombo",
    days: 2, nights: 1, price: 1250, accommodation: 800, transport: 450,
    description: "A short journey. A complete change of pace. Find your place beside the Volta, where the days are made for riverside reading and watching the light change.",
    stay: "1 night in a riverside lodge · twin-share room",
    itinerary: [
      { title: "Out of the city, onto the river", detail: "Meet in Accra at 8:00 am. Arrive in Akosombo, check into your lodge, and enjoy an afternoon by the river. Optional boat trips are paid separately." },
      { title: "A morning with no rush", detail: "Spend the morning at the lodge before returning to Accra. Expected arrival: 4:00 pm, depending on traffic." },
    ],
  },
  {
    id: "kumasi", title: "A city with a story.", subtitle: "Kumasi & Ashanti Heritage",
    region: "Ashanti Region", category: "Culture", image: "/images/kumasi.webp",
    imageAlt: "The courtyard and architecture of the Manhyia Palace Museum in Kumasi",
    days: 3, nights: 2, price: 1950, accommodation: 1250, transport: 700,
    description: "Meet Kumasi through its craft, its courtyards, and its everyday energy. An escape for the curious, with time to discover the city on your own terms.",
    stay: "2 nights in a city guesthouse · twin-share room",
    itinerary: [
      { title: "North to Kumasi", detail: "Depart Accra at 6:00 am. Travel to Kumasi and check in before an evening exploring the neighbourhood." },
      { title: "Craft, culture, and the city", detail: "Discover Manhyia, the markets, and local craft traditions at your own pace. Museum entry, purchases, and meals are paid separately." },
      { title: "The journey home", detail: "A final morning in Kumasi, then return by road to Accra. Expected arrival: 7:00 pm, depending on traffic." },
    ],
  },
];
export const money = (amount: number) => `GH₵ ${new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 }).format(amount)}`;
export const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
export type Departure = { date: string; remaining: number };
export function departureDates(now = new Date()): string[] {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dates: string[] = [];
  // At least 48 hours to prepare; Friday and Saturday departures for 12 weeks.
  for (let day = 2; day <= 84; day++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + day);
    if ([5, 6].includes(date.getUTCDay())) dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}
