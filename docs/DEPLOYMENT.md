# Deployment

This project supports two production setups: Render with hosted services (Supabase, Upstash), and a VPS running the production Docker Compose file.

## Database selection

The app and every script in `scripts/` choose the database by whether `DATABASE_URL` is set. `NODE_ENV` only controls dev or production mode and does not pick the database.

| Setup | `DATABASE_URL` | `DB_*` variables | `DB_SSL` |
|---|---|---|---|
| Local dev | unset | set (`DB_HOST=localhost`, or `postgres` inside the dev compose) | unset |
| Render with Supabase | set | ignored | `true` |
| VPS with Docker | unset | `DB_USER`, `DB_PASSWORD`, `DB_NAME` set; compose sets `DB_HOST=postgres` | unset |

When `DATABASE_URL` is set it always wins, so keep it commented out in a local `.env`. `DB_SSL=true` turns on ssl for the app's connection, which Supabase requires. A Postgres container does not use ssl, so leave it unset there.

For the Render and Supabase variables, see [`SUPABASE-DATABASE-GUIDE`](SUPABASE-DATABASE-GUIDE.md).

## Production compose file (VPS)

`docker-compose.prod.yml` is a standalone file with three services: `app`, `postgres` and `redis`. It is not layered on top of `docker-compose.yml`, so always pass it with `-f`:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Compared with the dev compose file:

- The app runs the `production` target: css is built into the image and the server starts with `node server.js`.
- There is no bind mount, so the container runs the code baked into the image.
- Only the app publishes a port (3000). Postgres and redis are reachable only by the app over the compose network.
- `NODE_ENV`, `DB_HOST` and `REDIS_URL` are set in the file and override the values in `.env`.

The server's `.env` needs real values for `DB_USER`, `DB_PASSWORD` and `DB_NAME`, plus the Xendit, Brevo and Cloudinary credentials. `DATABASE_URL` and `DB_SSL` must be unset.

To print the merged configuration without starting anything (it includes the values from `.env`, so do not share the output):

```bash
docker compose -f docker-compose.prod.yml config
```

## Managing postgres and redis

Because the database and redis ports are not published, manage them from inside their containers. On a VPS, connect with ssh first.

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U your_db_user -d your_db_name
```

```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli
```

## Not covered yet

- No TLS proxy is included. The session cookie is `secure` in production, so the app needs https in front of it.
- `trust proxy` is set to 3 for Cloudflare plus Render. A VPS with a different proxy setup needs a different count (see [`SECURITY`](SECURITY.md)).
- Backups of the postgres volume are not set up.