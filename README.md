# Cruise Getaways

A mobile-first Ghana travel booking application built with Next.js, React, TypeScript, and Neon PostgreSQL. The editorial interface uses locally hosted destination photography and fonts. No third-party scripts are loaded on the booking path.

## Run locally

Requires Node 22+ and Bun.

```sh
bun install
bun run dev
```

Open http://localhost:3000. Without `DATABASE_URL`, development reservations are persisted in the ignored `.data/bookings.json` file. This adapter supports a single local Node process. Production requires Neon and never silently falls back to disk.

## Connect Neon

1. Sign in at https://console.neon.tech and create a project for Cruise Getaways. Choose a region close to your eventual application host.
2. Open **Connect**, select your database and role, enable connection pooling, and copy the PostgreSQL connection string.
3. Copy `.env.example` to `.env.local`. Replace the example `DATABASE_URL` value with that connection string. Keep this credential out of chat, version control, and all `NEXT_PUBLIC_` variables.
4. Run `bun run db:setup`. This creates the tables and departure inventory for the next 12 weeks. The script is rerunnable; it does not overwrite existing bookings or capacity.
5. Restart the development server. Make a booking and inspect `bookings` and `departures` in the Neon SQL Editor to verify persistence.
6. Add `DATABASE_URL` to your production host's server environment before deployment. Build with `bun run build`, start with `bun run start`.

The current implementation uses the Neon HTTP driver with parameterized queries. Capacity updates and booking creation are atomic; request-level advisory locks make retries idempotent. Booking access requires a random access token, whose SHA-256 hash is stored on the server. The browser retains only references and access keys, not contact details.

Run `bun run db:setup` periodically to extend the 12-week inventory, or replace the working schedule with agency-approved departures. Local development bookings are not automatically migrated to Neon.

Driver documentation: https://github.com/neondatabase/serverless/blob/main/CONFIG.md

## Scope and operating notes

- Discover and filter four Ghana packages; save favourites in the browser.
- View itineraries, select an available departure, and book 1–8 adult travellers.
- Prices include twin-share accommodation and return road transport from Accra; server code calculates the final total.
- Contact details are validated on the client and server. The server rejects invalid dates, insufficient capacity, duplicate request changes, and cross-origin submissions.
- Payment choices capture a preference only. There is intentionally no payment-provider integration, card collection, charge, or synthetic payment success. Every new request remains `requested` and `unpaid`. Frontend copy does not expose implementation details.
- Confirmation provides a reference, downloadable request, and access through My bookings on the same browser. It does not claim an email has been sent.
- There is no staff dashboard or automated email/SMS delivery in this first booking phase. Staff can inspect requests in Neon. Add staff authentication and an operational workflow before a public launch.
- Dates, prices, accommodation descriptions, and copy are working catalogue data in `lib/catalog.ts`; the agency must approve them before accepting real reservations. The site is deliberately `noindex` until launch.
- Pending requests currently retain capacity until staff resolve them. Before launch, implement staff confirmation/cancellation and an expiry policy that releases unused capacity atomically. Add hosting-level rate limits/bot controls for the public booking endpoint.
- For a future payment integration, initiate payment on the server and accept success only from verified, idempotent provider webhooks. Never trust a client-supplied amount or paid flag.

## Checks

```sh
bun run typecheck
bun run test
bun run build
```

Browser tests require the development server on `http://127.0.0.1:3000`:

```sh
bunx playwright install chromium webkit
bun run test:e2e
```

For isolated browser-test records, set `BOOKING_DATA_DIR` to a dedicated directory under `.test-data` before starting the server. Tests cover desktop Chromium, a 360px mobile viewport, and iPhone-sized WebKit. WebKit automation is useful Safari coverage, but does not replace a final check on a physical iPhone.

Unit tests verify server pricing, input validation, date boundaries, protected retrieval, concurrent capacity, and idempotency. Their records go into isolated ignored `.test-data` subdirectories.

## Assets

Destination photographs and licences are recorded in `public/images/credits.json` and displayed in the Photography dialog. Derivative photo files retain their source licences. DM Sans is hosted locally under the licence in `public/fonts/OFL.txt`.
