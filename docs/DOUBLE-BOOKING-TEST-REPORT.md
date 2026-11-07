# Double Booking and Payment Safety Test Report

Herco Detailing Garage booking system, branch `stable-v1` (v1.1.1). Tracked in issue #18.

## 1. Goals

The booking system protects two promises:

- A slot is never given to more customers than its capacity (no double booking).
- A customer who paid is never lost, even when the hold expires, the page closes, or the cancel button is pressed at the wrong moment.

Everything below exists to keep those two promises, and each protection has a test that can be rerun by anyone.

## 2. What was built, and why

The "before" column comes from reading the earlier code, not from running it. Old behavior was not re-run, because that would mean checking out old commits against a database. The proof is in the "after" column: the tests on the current code.

| Risk | Before (from code analysis) | After | Proof |
|---|---|---|---|
| Two customers take the same slot at the same moment | Check and insert were separate steps, so a race could oversell | The lock is atomic, only capacity many holds can exist | T1 |
| Pressing pay twice | Could create two invoices and two payment rows | Same checkout link is returned, one payment row, hold unchanged | T2 |
| Xendit repeats a paid notice | Could confirm twice and send two emails | Confirms once, one email, wrong token refused | T3, T4 |
| Hold expires while a payment is in progress | The clock alone could free a slot a customer was paying for | A held booking with a payment is freed only on Xendit's word, a paid customer is confirmed with one email | T5, T7 |
| Invoice outlives the hold | A customer could pay for a slot that was already freed | Invoice lasts 15 minutes and the hold 16, a test fails if that order is ever broken | T6 |
| Release while a payment is in progress | The slot could be released from under a payer | Release refuses a booking with a started payment, atomically in SQL | T8 |
| Cancel while a payment is in progress | Slot released even if Xendit was paid a moment later | Cancel asks Xendit first, expires pending invoices, confirms if paid, refuses if Xendit cannot be reached | T9 |
| Fake accounts | Anyone could sign up with any email | Email must be verified with a code before sign in | T10 |
| One person hoards slots | Unlimited holds | Logged in customers are capped at 2 holds per account, guests at 5 per network | T11 |
| Someone else releases, edits or pays for a hold | A booking id was enough | A signed token is required, wrong or missing token gets 403 before any work | T12 |
| Closed tab blocks a slot | Slot stayed blocked for the full 10 minutes | Freed after 60 seconds away, one strike, never when a payment exists | T13 |
| Weekly purge | Failed on bookings that had payment rows | One transaction clears unpaid leftovers, keeps anything with a paid, failed or refunded payment, rolls back on failure | T14 |

### Hold timing

- A new hold lasts 10 minutes.
- Pressing pay extends it to 16 minutes and creates a Xendit invoice of 15 minutes.
- The hold therefore outlasts the invoice by one minute.

### Strike and block rules

- A strike is added when a hold ends without payment: cancel, expiry, or an abandoned tab.
- Paid bookings add no strike.
- 3 strikes within 1 hour block booking for 2 hours.
- Logged in customers are counted by account, guests by network.

## 3. Test evidence

Last full run: all 14 scripts passed with exit code 0 on `stable-v1` at commit e8a175f, 2026-11-08.

All tests are plain Node scripts in `scripts/`. They call the real handlers against a real local PostgreSQL database and assert on what ends up in the tables. Only the outside world is replaced by stubs: email, Xendit and Redis.

| ID | Script | Proves | Last result |
|---|---|---|---|
| T1 | `test-double-booking.js` | 50 simultaneous lock requests against a date with capacity 3 never exceed it | 20 rounds of 50 simultaneous requests, exactly 3 of 3 slots taken every round |
| T2 | `test-pay-reuse.js` | Pay twice reuses the checkout, late press refused, failed attempt can retry | 10 of 10 |
| T3, T4 | `test-webhook-repeat.js` | Repeated paid notice confirms once, wrong token refused | 9 of 9 |
| T5, T7 | `test-reconcile.js` | Held bookings freed only on Xendit's word, paid customer confirmed once, unreachable Xendit frees nothing | 20 of 20 |
| T6 | `test-invoice-window.js` | Hold is longer than the invoice | 1 of 1 |
| T8 | `test-release.js` | Release refused with a started payment, still works without one | 6 of 6 |
| T9 | `test-cancel.js` | Cancel settles invoices with Xendit first | 18 of 18 |
| T10 | `test-verify.js` | Email verification on sign up | 20 of 20 |
| T11 | `test-holds.js` | Hold caps per account and per network, including simultaneous requests | 23 of 23 |
| T12 | `test-booking-token.js` | Release, details and pay need the signed token | 19 of 19 |
| T13 | `test-leaving.js` | Closed tab freed after grace period, never with a payment, block wording | 24 of 24 |
| T14 | `test-purge.js` | Weekly purge keeps money records and rolls back on failure | 7 of 7 |

### Why these tests are not vacuous

- **Real code, real database.** Results are read from the tables, not from response text alone.
- **Both sides are checked.** A refusal only counts because the same file shows the action works when it should. For example T13 shows an abandoned hold is released, so "a hold with a payment is never released" cannot pass just because the sweep is broken. T11 shows 5 granted and 5 refused, so the cap does not pass by refusing everything.
- **Concurrency is judged by outcome.** "10 simultaneous holds leave exactly 5" counts what is in the database.
- **Safe to run.** Every script refuses to start unless `DB_HOST` is local and `DATABASE_URL` is empty. Test emails use `@example.test` addresses, so no real person is ever emailed.

## 4. How to rerun

Requirements: local PostgreSQL with migrations applied (`npm run migrate`), `DB_HOST` local and `DATABASE_URL` empty.

```bash
node scripts/test-double-booking.js
node scripts/test-pay-reuse.js
node scripts/test-webhook-repeat.js
node scripts/test-reconcile.js
node scripts/test-invoice-window.js
node scripts/test-release.js
node scripts/test-cancel.js
node scripts/test-verify.js
node scripts/test-holds.js
node scripts/test-booking-token.js
node scripts/test-leaving.js
node scripts/test-purge.js
```

Each script prints one line per check and ends with `RESULT: PASS` or `RESULT: FAIL`. `test-purge.js` also purges any other expired booking older than 30 days in the local database.

## 5. Known limits

These are choices, not oversights. v1 does not protect against the following.

**Abuse limits**

- VPN or IP rotation bypasses the network cap and network block.
- Disposable inboxes pass email verification, since it proves only that a mailbox exists.
- Guests on a shared network (for example one shop wifi) share the 5 hold cap and the network block.
- Guests can still book without logging in.

**Closed tab handling (T13)**

- A reload slower than 60 seconds counts as abandoned and adds one strike.
- If the browser is killed, the app is switched away, or Redis is down, the hold simply expires on its normal 10 minute timer.
- Closing one copy of a duplicated tab can release a hold the other copy still shows.
- A hold that already has a payment row is never freed early, it waits the full 16 minutes. This is deliberate, to protect paid customers.
- Leaving marks live in Redis and are only removed when the cron sweeps them.

**Information and configuration**

- `GET /session/:bookingId` is open by design and returns only status and expiry.
- About 68 error responses still return the raw error message (tracked in a separate issue).
- `SESSION_SECRET` has a development fallback in `app.js`. Booking tokens refuse to be signed in production without a real secret, so it must be set on the host.

**Testing scope**

- Redis, Xendit and email are stubbed. No automated test talks to the real Xendit sandbox.
- Still to do manually before go live: a real Xendit payment followed by cancel must land on confirmed, and the redesigned sign in pages need a phone and desktop pass.

## 6. Summary

The protections are layered so that no single check carries the whole promise. The database lock stops double booking, the payment guards stop a paid customer from losing a slot, and the token and caps stop one visitor from interfering with another. Every claim above maps to a script that can be rerun in a few minutes.

