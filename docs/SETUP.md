# Setup

Guide for getting this project running on a new machine, plus a reference for commands used during day-to-day development.

## Prerequisites

- **Node.js** (v20+ recommended - check with `node -v`) - only needed if running Node natively (Options A/B). Not required for Option C, since the container handles this.
- **npm** (comes with Node) - same as above, not required for Option C.
- **Docker + Docker Compose** - required for Option B (database only) or Option C (fully Dockerized).
- **PostgreSQL** (native install) - only required if not using Docker for the database at all (Option A).
- **Redis** - required for sessions, OTP codes and booking abuse prevention. Options B and C start it from `docker-compose.yml`. For Option A, run a local Redis on port 6379 (matches `REDIS_URL` in `.env.example`).

| Option | What runs natively | What runs in Docker |
|---|---|---|
| A - Fully native | Node + Postgres + Redis | - |
| B - DB only in Docker | Node | Postgres + Redis |
| C - Fully Dockerized | - | Node + Postgres + Redis |

## First-time setup

1. **Clone the repo**

Via SSH:
```bash
   git clone git@github.com:gleanse/detailing-booking-system.git
```

   Or via HTTPS:
```bash
   git clone https://github.com/gleanse/detailing-booking-system.git
```

   Then navigate to the directory:
```bash
   cd detailing-booking-system
```

2. **Install dependencies**
```bash
   npm install
```
   Not required if you're running fully Dockerized (Option C below) - dependencies install inside the container instead.

3. **Set up environment variables**

Copy the example file and fill in your own values:
```bash
   cp .env.example .env
```
   `.env.example` is the template - this command creates your actual `.env` from it.
   See [`EXTERNAL-SERVICES.md`](EXTERNAL-SERVICES.md) for what each third-party service credential is and how to get one.

4. **Set up the database and run the app** - pick one:

**Option A - Native (Postgres installed locally, app runs on host):**
```bash
   npm run db:setup
```
   This creates the database if it doesn't exist, runs migrations, and seeds sample data. Requires a local Postgres instance already running.

   Then run the dev servers - you need two terminals:

   **Terminal 1 - server:**
```bash
   npm run dev
```

   **Terminal 2 - Tailwind:**
```bash
   npm run css
```
   This watches your source files and rebuilds `output.css` on every change. Keep it running the whole time you're developing - if it's not running, style changes won't show up, even after a refresh.

   **Option B - Docker for database only (Postgres in a container, app runs on host):**
```bash
   npm run db:setup:docker
```
   This starts the Postgres container, runs migrations, and seeds sample data. The app itself still runs natively - continue with the same two-terminal setup as Option A (`npm run dev` + `npm run css`).

   **Option C - Fully Dockerized (app + database both in containers):**
```bash
   docker compose up --build
```
   This builds and starts both the app and Postgres containers together. No need to run `npm install`, `npm run dev`, or `npm run css` separately - the container handles all of that internally (nodemon + Tailwind watcher run together automatically). Once it's up, seed/migrate the same way:
```bash
   npm run migrate up
   npm run seed
```
   Not required if you're not using Docker - this option is entirely optional, useful for environment parity across machines or if you'd rather not install Postgres/Node dependencies natively at all.
   Or, for future resets, use the combined script instead:
```bash
   npm run db:setup:docker
```
   This starts the containers (if not already running), then migrates and seeds in one step - useful after `docker compose down -v` when you need a fresh database. Note: for a first-time setup, use `docker compose up --build` first (above) since the app image needs to be built.

You should now have the app running locally, regardless of which option you picked.

## Everyday dev commands

**Native / Option A & B:**
```bash
npm run dev      # terminal 1
npm run css      # terminal 2
```

**Fully Dockerized / Option C:**
```bash
docker compose up -d        # start in background (after first build)
docker logs -f detailing_booking_app   # follow logs
```

**Database setup / reset:**
```bash
npm run db:setup           # native Postgres: ensure db exists, migrate, seed
npm run db:setup:docker    # docker: start containers, migrate, seed (both app + db if using Option C)
npm run migrate up         # run migrations only
npm run seed                # run seed script only
npm run db:ensure           # create the database if it doesn't already exist
```

**Warning:** `npm run seed` erases existing data in the seeded tables before inserting sample data. Don't run it against a database you care about - use it only on a fresh or disposable local database.

**Docker container:**
```bash
docker compose up --build   # build images and start (use after dockerfile/dependency changes)
docker compose up -d        # start (no rebuild)
docker compose down         # stop
docker compose down -v      # stop and wipe data (full reset)
docker logs detailing_booking_db    # check postgres logs / confirm it initialized correctly
docker logs detailing_booking_app   # check app logs (server, nodemon, css watcher)
docker ps                   # list running containers
docker ps -a                # list all containers, including stopped ones
```

## Troubleshooting

**Port 5432 already in use:** only one Postgres instance can use port 5432 at a time. If you're running another dockerized project locally (e.g. a different app's database), stop that one first:
```bash
docker stop <other-container-name>
```
