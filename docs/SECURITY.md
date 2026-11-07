# Security

What the system protects, how, and where it lives in the code. This describes the `stable-v1` line at v1.2.0. Test evidence for the booking and payment parts is in [DOUBLE-BOOKING-TEST-REPORT.md](DOUBLE-BOOKING-TEST-REPORT.md).

Anything the system does not protect against is listed in the last section.

## 1. Booking integrity

| Protection | How it works | Where |
|---|---|---|
| No double booking | Capacity is checked and the hold inserted in one atomic step, so simultaneous requests cannot oversell a date | `bookings/queries.js` (`lockSlot`) |
| Hold timing | A new hold lasts 10 minutes, pressing pay extends it to 16, the Xendit invoice lasts 15, so the hold always outlives the invoice | `bookings/queries.js`, `bookings/controller.js` |
| Hold caps | Logged in customers can hold 2 dates at once, guests 5 per network. Counted inside a database advisory lock so simultaneous requests cannot slip past the cap | `bookings/queries.js` |
| Release token | Releasing, editing or paying for a hold needs an HMAC token that only the creator receives. Wrong or missing token gets 403 before any database or Xendit work | `bookings/booking-token.js` |
| Closed tab cleanup | A page that closes reports it, and the hold is freed after 60 seconds unless the customer comes back. A hold with any payment row is never touched | `bookings/leaving.js` |

## 2. Payments

| Protection | How it works | Where |
|---|---|---|
| Webhook is authenticated | The invoice webhook requires the `x-callback-token` header and answers 401 otherwise. It refuses all requests if the token is not configured | `bookings/controller.js` (`handleWebhook`) |
| Webhook is safe to repeat | A repeated paid notice confirms once and sends one email, even when sent simultaneously | `bookings/confirm.js` |
| Held booking with a payment is freed only on Xendit's word | The expiry cron and release both skip a booking that has a payment row. A reconcile job asks Xendit and frees it only when every invoice is expired | `bookings/reconcile.js`, `bookings/queries.js` |
| Cancel settles with Xendit first | Cancel reads the invoices, expires pending ones, confirms the booking if one was paid, and refuses when Xendit cannot be reached | `bookings/cancel.js` |
| Pay pressed twice | The same checkout link is returned, with one payment row | `bookings/controller.js` (`createInvoice`) |
| A paid customer is never lost | A paid notice confirms the booking even if it had expired. Paid, failed and refunded payment records are never purged | `bookings/confirm.js`, `bookings/purge.js` |

## 3. Accounts and sessions

| Protection | How it works | Where |
|---|---|---|
| Password storage | Passwords are hashed with bcrypt | `customer/controller.js`, `auth/auth.routes.js` |
| Email verification | A 6 digit code is mailed on sign up, with an attempt limit and a resend cooldown. An unverified account cannot sign in | `customer/signup-verify.js` |
| Role checks | Separate guards for customer, staff and admin on pages and APIs. Admin and staff APIs also check the session below | `shared/middlewares/auth.js` |
| Single active session | Staff and admin accounts have one active session, a new login ends the old one | `shared/middlewares/singleSession.js` |
| Session storage | Sessions live in Redis with an expiry. Cookies are `httpOnly`, and `secure` in production | `app.js` |
| Login throttling (staff and admin) | 5 failed attempts block the account for a period | `shared/utils/rateLimiter.js` |
| Generic login errors | Wrong email and wrong password give the same message, and server errors on sign up show a generic message | `customer/controller.js` |
| Account creation | Creating staff accounts is admin only | `admin/admin.routes.js` |

## 4. Abuse limits

- A strike is added when a hold ends without payment: cancel, expiry, or an abandoned tab. Paid bookings add none.
- 3 strikes within 1 hour block booking for 2 hours.
- Logged in customers are counted by account, guests by network address.
- Block messages show the time left in hours and minutes.

Where: `shared/utils/cron.js`, `bookings/controller.js`.

## 5. Data and operations

- Timestamps are stored with time zone and dates use Asia/Manila.
- The weekly purge removes old expired bookings with their unpaid leftovers in one transaction, and rolls back on failure (`bookings/purge.js`).
- Admin actions that change records write to the audit log, and the log screen escapes its text.
- Image uploads accept JPEG, PNG, WEBP and GIF only.
- Test scripts refuse to run unless the database is local, and use `@example.test` addresses so no real person is emailed.

## 6. Not covered

These are known and accepted for v1.

**Web**
- No CSRF token and no security headers package (such as helmet). In production the session cookie uses `sameSite: none`, which sends it on cross-site requests.
- Sessions are not regenerated at login.
- JSON bodies up to 10 MB are accepted.
- About 68 error responses still return the raw error message (tracked as a separate issue).
- `SESSION_SECRET` has a development fallback in `app.js`. Booking tokens refuse to sign in production without a real secret, so it must be set on the host.

**Accounts**
- Customer login has no attempt limit. Only staff and admin login is throttled.
- Image uploads trust the type the browser declares and do not inspect the file content. Uploading is admin only.

**Booking abuse**
- VPN or IP rotation bypasses the network cap and block.
- Disposable inboxes pass email verification.
- Guests on a shared network share the 5 hold cap and the block.
- Guests can still book without an account.
- `GET /session/:bookingId` is open by design and returns only status and expiry.

**Closed tab handling**
- A reload slower than 60 seconds counts as abandoned, with one strike.
- A killed browser, app switching or Redis downtime means the hold simply expires after 10 minutes.
- A duplicated tab can release a hold the other copy still shows.

**Testing**
- Redis, Xendit and email are stubbed in the automated tests. No automated test talks to the real Xendit sandbox.

