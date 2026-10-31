import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env.local before running db:setup.");
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS departures (
  trip_id text NOT NULL, departure_date date NOT NULL,
  capacity integer NOT NULL DEFAULT 12 CHECK (capacity > 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= capacity),
  PRIMARY KEY (trip_id, departure_date)
)`;
await sql`CREATE TABLE IF NOT EXISTS bookings (
  reference text PRIMARY KEY, idempotency_key uuid NOT NULL UNIQUE, token_hash text NOT NULL,
  trip_id text NOT NULL, departure_date date NOT NULL,
  guests integer NOT NULL CHECK (guests BETWEEN 1 AND 8),
  total_pesewas integer NOT NULL CHECK (total_pesewas > 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (trip_id, departure_date) REFERENCES departures(trip_id, departure_date)
)`;
await sql`CREATE INDEX IF NOT EXISTS bookings_departure_idx ON bookings (trip_id, departure_date)`;
// Rerunnable: never overwrite existing inventory or reservations.
await sql`INSERT INTO departures (trip_id, departure_date)
  SELECT trip_id, day::date
  FROM unnest(ARRAY['cape-coast', 'volta', 'akosombo', 'kumasi']) AS trip_id
  CROSS JOIN generate_series((now() AT TIME ZONE 'UTC')::date + 2, (now() AT TIME ZONE 'UTC')::date + 84, interval '1 day') AS day
  WHERE extract(dow FROM day) IN (5, 6) ON CONFLICT DO NOTHING`;
console.log("Neon tables ready. Departure inventory prepared for the next 12 weeks.");
