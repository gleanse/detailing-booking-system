# Supabase Database Guide

How to run database scripts against the production Supabase database from any machine (Termux, WSL2, Linux, or Windows with Git Bash) that has Node, the cloned repo and `npm install` done. Supabase is used only as a hosted PostgreSQL server, so everything here is plain Postgres over a connection string. See [`EXTERNAL-SERVICES.md`](EXTERNAL-SERVICES.md) for the general Supabase notes.

Supabase's own services (Auth, Storage, the auto-generated API, `supabase-js`) are not used. All access goes through the backend code.

## Env variables

| Variable | Where it lives | Purpose |
|---|---|---|
| `DATABASE_URL` | Render dashboard (Environment tab) and local `.env` | Supabase connection string used by the app and the scripts in production mode |
| `SUPABASE_DATABASE_PASS` | local `.env` | The database password, kept for reference |
| `NODE_ENV` | `.env` / Render | `production` makes the app and every script in `scripts/` use `DATABASE_URL`; anything else uses the local `DB_*` variables |

Never commit these values or paste them in chats. Anyone with `DATABASE_URL` has full access to the database.

## Connection string

Use the **session pooler** string, not the direct connection:

- Dashboard: **Connect** > change the method to **Session pooler**
- Format: `postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
- Port must be `5432`. Port `6543` (transaction pooler) can break migration locking.
- The direct host (`db.<project-ref>.supabase.co`) is IPv6-only on the free tier and fails on any network without IPv6 (common on mobile data, and on some home networks and WSL2 setups).
- The Render `DATABASE_URL` is already a session pooler string, so it can be reused as is.
- If the password has special characters, URL-encode them (`@` becomes `%40`, `#` becomes `%23`).

If the password is lost, reset it at **Project Settings > Database > Reset database password**. The old one stops working immediately, so update `DATABASE_URL` in Render (then redeploy) and in the local `.env`.

## Running scripts against Supabase

Run from the project root, on the right branch, with the values passed inline:

```bash
NODE_ENV=production DATABASE_URL='<session pooler url>' npm run migrate up
```

Notes:

- Inline variables exist only for that one command. Nothing is written to `.env` or to Render, and they are gone when the command exits.
- The inline `VAR=value command` syntax needs a Unix-style shell (bash, zsh). It does not work in Windows cmd or PowerShell, so on Windows use WSL2 or Git Bash.
- Use single quotes around the URL so characters like `$` and `!` are not interpreted by the shell.
- The command text may stay in shell history with the password in it. Clear it with `history -c` if needed.
- `dotenv` does not override variables that are already set, so the inline values win over `.env`.

## Which scripts are safe

| Command | Against Supabase |
|---|---|
| `npm run migrate up` | Safe and routine. Applies only migrations not yet recorded in the `pgmigrations` table. |
| `npm run seed` | Dangerous once real data exists. It truncates every app table, then inserts demo data. |
| `npm run db:ensure` | Not needed. The `postgres` database always exists on Supabase. |
| `npm run db:setup` | Avoid. It runs ensure, migrate and seed, so it includes the wipe. |
| `npm run db:setup:docker` | Not applicable. It starts local Docker containers. |

Demo seed accounts all use the password `password`. Delete or change them before go-live.

## Adding a schema change

1. Add a migration file in `migrations/` and test it with `npm run migrate up` locally.
2. Commit and push.
3. Run the inline `migrate up` command above against Supabase.
4. Verify in the Supabase SQL editor:

```sql
select name from pgmigrations;
```

Do not edit tables directly in the Supabase dashboard. A change with no migration file makes the repo and the database drift apart.

## Rebuilding Supabase from scratch

Only for a disposable database with no real data. This deletes all tables and data.

Preferred: let the migration tool undo itself, using the same inline variables as above. The count is the number of migrations currently applied (2 in this example). Increase it if more migrations exist later.

```bash
NODE_ENV=production DATABASE_URL='<session pooler url>' npm run migrate down 2
NODE_ENV=production DATABASE_URL='<session pooler url>' npm run migrate up
```

Optionally run `npm run seed` the same way afterward.

Fallback if `pgmigrations` and the tables are out of sync, run in the Supabase SQL editor:

```sql
drop table if exists
  booking_status_logs, audit_logs, notifications, payments, bookings,
  closed_dates, availability, service_variants, services, users,
  pgmigrations
cascade;
```

Then confirm it is empty and run `migrate up`:

```sql
select table_name from information_schema.tables
where table_schema = 'public';
```

## Dashboard warnings and permissions

The Supabase dashboard may show warnings such as "RLS disabled" on the tables. They can be ignored. Row Level Security and Supabase's role permissions only apply to its auto-generated API, which this project does not use. The backend connects as the `postgres` role, which has full access regardless.

## Troubleshooting

| Symptom                                             | Cause and fix                                                                                                                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENOTFOUND`, `ENETUNREACH` or timeout               | Direct connection string on an IPv4-only network. Use the session pooler string.                                                                                                         |
| SSL or "no encryption" error                        | Append `?sslmode=require` to the URL.                                                                                                                                                    |
| Authentication failed                               | Wrong password, or special characters not URL-encoded.                                                                                                                                   |
| `relation "users" already exists`                   | Tables exist but `pgmigrations` does not (schema built outside `node-pg-migrate`). Either empty the database, or baseline with `migrate up 1 --fake` after verifying the schema matches. |
| Connection hangs after inactivity                   | Free tier project is paused. Open the Supabase dashboard to wake it up.                                                                                                                  |
| Users logged out or odd login behavior after a seed | Old sessions in Upstash Redis point to deleted users. Log in again or run `FLUSHDB` on the Redis instance.                                                                               |
