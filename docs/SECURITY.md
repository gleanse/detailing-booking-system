# Security

What the system protects, how, and where it lives in the code. This describes the `stable-v1` line at v1.4.0. Test evidence for the booking and payment parts is in [DOUBLE-BOOKING-TEST-REPORT.md](DOUBLE-BOOKING-TEST-REPORT.md).

Each protection has a title that names the kind of security, then what it protects against, how it works, where it lives, and the known trade-offs we accept with the reason we accept them. Gaps that are not trade-offs of something we built are in the last section.

## At a glance

**Booking integrity**
- Concurrency control - no double booking
- Time-limited holds - hold timing
- Resource limiting - hold caps
- Request authentication - release token
- Resource cleanup - closed tab handling

**Payments**
- Request authentication - webhook token
- Idempotency - repeated webhooks
- Payment reconciliation - holds freed only on Xendit's word
- Payment reconciliation - cancel settles with Xendit first
- Idempotency - pay pressed twice
- Payment record integrity - a paid customer is never lost

**Accounts and sessions**
- Credential storage - password hashing
- One-time code limiting - sign up verification
- One-time code limiting - password reset and email change
- Access control - role guards and account creation
- Session management - single active session for staff and admin
- Session management - customer sessions
- Rate limiting - staff and admin login
- Rate limiting - customer login
- Error handling - generic messages

**Web and network**
- Cookie hardening - session cookie
- Client address trust - proxy setup

**Abuse limits**
- Abuse prevention - strikes and booking blocks

**Data and operations**
- Data integrity - time zone and weekly purge
- Audit logging - admin actions
- Input validation - image uploads
- Test safety - local only scripts

**Not covered**
- See the last section.

## 1. Booking integrity

### Concurrency control - no double booking

- **Protects against:** two customers taking the last spot on a date at the same moment.
- **How it works:** capacity is checked and the hold is inserted in one atomic step, so simultaneous requests cannot oversell a date.
- **Where:** `bookings/queries.js` (`lockSlot`)
- **Known trade-offs:** none known.

### Time-limited holds - hold timing

- **Protects against:** a hold ending while the customer is still paying, and a dead hold blocking a date.
- **How it works:** a new hold lasts 10 minutes, pressing pay extends it to 16, and the Xendit invoice lasts 15, so the hold always outlives the invoice.
- **Where:** `bookings/queries.js`, `bookings/controller.js`
- **Known trade-offs:** none known.

### Resource limiting - hold caps

- **Protects against:** one person holding many dates and blocking everyone else.
- **How it works:** logged in customers can hold 2 dates at once and guests 5 per network address. The count is taken inside a database advisory lock, so simultaneous requests cannot slip past the cap.
- **Where:** `bookings/queries.js`
- **Known trade-offs:**
  - VPN or address rotation bypasses the network cap.
    - Why accepted: a limit tied to an address cannot stop someone who changes addresses, and holds expire in minutes anyway.
  - Guests on a shared network share the 5 hold cap.
    - Why accepted: guests have no account to count by, and 5 leaves room for several people on one network.

### Request authentication - release token

- **Protects against:** someone else releasing, editing or paying for a hold.
- **How it works:** releasing, editing or paying for a hold needs an HMAC token that only the creator receives. A wrong or missing token gets 403 before any database or Xendit work.
- **Where:** `bookings/booking-token.js`
- **Known trade-offs:**
  - `GET /session/:bookingId` is open by design and returns only status and expiry.
    - Why accepted: the booking page needs it, and it exposes nothing else.

### Resource cleanup - closed tab handling

- **Protects against:** dates stuck on hold after a customer leaves.
- **How it works:** a page that closes reports it. The mark must be at least 60 seconds old and the check runs once a minute, so the hold is freed 1 to 2 minutes after leaving, unless the customer comes back first. A hold with any payment row is never touched.
- **Where:** `bookings/leaving.js`
- **Known trade-offs:**
  - A reload slower than the 60 second minimum, once the minute check has run, counts as abandoned, with one strike.
    - Why accepted: a slow reload cannot be told apart from a closed tab, and one strike is far below the block.
  - A killed browser, app switching or Redis downtime means the hold simply expires after 10 minutes.
    - Why accepted: the 10 minute expiry is the safety net, and it is short.
  - A duplicated tab can release a hold the other copy still shows.
    - Why accepted: it is rare, and the worst case is picking the date again.

## 2. Payments

### Request authentication - webhook token

- **Protects against:** fake payment notices.
- **How it works:** the invoice webhook requires the `x-callback-token` header and answers 401 otherwise. It refuses all requests if the token is not configured.
- **Where:** `bookings/controller.js` (`handleWebhook`)
- **Known trade-offs:** none known.

### Idempotency - repeated webhooks

- **Protects against:** double confirmation and duplicate emails when Xendit repeats a notice.
- **How it works:** a repeated paid notice confirms once and sends one email, even when sent simultaneously.
- **Where:** `bookings/confirm.js`
- **Known trade-offs:** none known.

### Payment reconciliation - holds freed only on Xendit's word

- **Protects against:** freeing a date that a customer has paid for.
- **How it works:** the expiry cron and release both skip a booking that has a payment row. A reconcile job asks Xendit and frees the booking only when every invoice is expired.
- **Where:** `bookings/reconcile.js`, `bookings/queries.js`
- **Known trade-offs:**
  - A held booking with a payment row stays held until the reconcile job gets an answer from Xendit.
    - Why accepted: freeing a date without knowing the payment state risks losing a paid booking.

### Payment reconciliation - cancel settles with Xendit first

- **Protects against:** cancelling a booking while a payment is in flight.
- **How it works:** cancel reads the invoices, expires pending ones, confirms the booking if one was paid, and refuses when Xendit cannot be reached.
- **Where:** `bookings/cancel.js`
- **Known trade-offs:**
  - Cancel is unavailable while Xendit cannot be reached.
    - Why accepted: cancelling without knowing the payment state risks losing a paid booking.

### Idempotency - pay pressed twice

- **Protects against:** two invoices and two payment rows from a double click.
- **How it works:** the same checkout link is returned, with one payment row.
- **Where:** `bookings/controller.js` (`createInvoice`)
- **Known trade-offs:** none known.

### Payment record integrity - a paid customer is never lost

- **Protects against:** losing a booking that was paid, even if it had expired.
- **How it works:** a paid notice confirms the booking even if it had expired. Paid, failed and refunded payment records are never purged.
- **Where:** `bookings/confirm.js`, `bookings/purge.js`
- **Known trade-offs:**
  - A late paid notice confirms the booking without rechecking capacity, so a date can rarely go over its limit.
    - Why accepted: refusing a customer who already paid is worse, and the shop can handle one extra job.
  - Payment records pile up and are never cleaned.
    - Why accepted: they are financial history and are needed for refunds.

## 3. Accounts and sessions

### Credential storage - password hashing

- **Protects against:** passwords being readable if the database leaks.
- **How it works:** passwords are hashed with bcrypt.
- **Where:** `customer/controller.js`, `auth/auth.routes.js`
- **Known trade-offs:**
  - The only password rule is a minimum of 8 characters, with no complexity rule and no check against common passwords.
    - Why accepted: a simple rule is easier for customers, and the login limiters slow down guessing.

### One-time code limiting - sign up verification

- **Protects against:** accounts made with an inbox the person does not control, and guessing the code.
- **How it works:** a 6 digit code is mailed on sign up, with an attempt limit and a resend cooldown. An unverified account cannot sign in.
- **Where:** `customer/signup-verify.js`
- **Known trade-offs:**
  - Disposable inboxes pass verification.
    - Why accepted: verification proves the inbox exists, not who owns it, and blocking disposable domains means maintaining a list.
  - Sign up says whether an email already has an account.
    - Why accepted: a clear message was chosen over a vague one, and forgot password behaves the same way.

### One-time code limiting - password reset and email change

- **Protects against:** guessing the 6 digit code to take over an account, and flooding an inbox with codes.
- **How it works:** the code expires in 10 minutes. 5 wrong tries kill it, and a new code cannot be requested for 60 seconds, enforced on the server and not only on the page. Codes come from `crypto.randomInt`. For an email change, the pending new email is stored together with the code.
- **Where:** `customer/security/otp.js`, used by `customer/controller.js` and `customer/account.controller.js`
- **Known trade-offs:**
  - Forgot password says whether an email has an account.
    - Why accepted: a clear message was chosen over a vague one, and the code limits stop guessing either way.
  - A code is used up the moment it matches, so if the database update right after it fails, the customer asks for a new code.
    - Why accepted: it is rare, and the alternative leaves a used code alive.
  - After a code is locked, the customer still waits out the rest of the 60 second cooldown before asking for a new one.
    - Why accepted: the wait is at most one minute.
  - No email is sent when a password or email changes, and changing the email does not ask for the password again. A hijacked session could change the email without the owner being told.
    - Why accepted: it was a decision to keep v1 small. Revisit if accounts start holding anything more sensitive.

### Access control - role guards and account creation

- **Protects against:** a customer reaching staff or admin pages and APIs, and anyone but an admin creating staff accounts.
- **How it works:** separate guards for customer, staff and admin on pages and APIs. Admin and staff APIs also check the single session below. Creating staff accounts is admin only.
- **Where:** `shared/middlewares/auth.js`, `admin/admin.routes.js`
- **Known trade-offs:** none known.

### Session management - single active session for staff and admin

- **Protects against:** a shared or stolen staff login staying usable next to the real one.
- **How it works:** staff and admin accounts have one active session, and a new login ends the old one.
- **Where:** `shared/middlewares/singleSession.js`
- **Known trade-offs:**
  - Logging in on a second device signs out the first.
    - Why accepted: that is the point of the rule.

### Session management - customer sessions

- **Protects against:** a planted session id surviving login, and a stolen session surviving a password change.
- **How it works:** login issues a fresh session id and records it in a per customer Redis set. Changing a password signs out every other device, resetting a password signs out all of them, and logout removes the id. Expired ids are pruned at login.
- **Where:** `customer/security/sessions.js`
- **Known trade-offs:**
  - Customers can be logged in on several devices at once.
    - Why accepted: customers use phones and laptops, unlike staff.
  - If Redis fails while sessions are being revoked, the password change still succeeds and the failure is only logged.
    - Why accepted: showing an error after the password is already saved would be worse, and the log shows what happened.
  - Revoking depends on the session store's `sess:` key name in `app.js`.
    - Why accepted: there is one store, and it is noted here so a change updates both.

### Rate limiting - staff and admin login

- **Protects against:** password guessing on staff and admin accounts.
- **How it works:** failed logins count against the email and against the network address, 5 each within 15 minutes. At 5, that email or address is blocked for 15 minutes. A correct login clears both counters. If Redis is down, the check lets logins through.
- **Where:** `shared/utils/rateLimiter.js`
- **Known trade-offs:**
  - Anyone who knows a staff email can lock that account for 15 minutes by failing 5 times.
    - Why accepted: a strict global lock suits accounts that can refund and cancel, and attackers rotating addresses still get only 5 guesses per email.
  - The address counter is shared by everyone on the shop's network, so 5 failures across all staff block the whole shop for 15 minutes.
    - Why accepted: same reason as above. Revisit if the shop actually hits it.
  - A correct login also clears the address counter.
    - Why accepted: an attacker would need a valid staff account to use it.
  - The counter is incremented and then given an expiry in a second Redis call, so a crash between the two could leave a counter that never expires.
    - Why accepted: the gap is milliseconds wide.
  - If Redis is down, logins are not limited.
    - Why accepted: availability matters more than the limit for a short outage.

### Rate limiting - customer login

- **Protects against:** guessing passwords on customer accounts, and one machine trying one password across many accounts.
- **How it works:** failed logins count against the email and network address pair, which locks at 5, and against the network address alone, which locks at 20. Each lock lasts 15 minutes and failures are remembered for 15 minutes from the first one. Unknown emails and non-customer accounts count the same as wrong passwords, so the lockout does not reveal which emails have accounts. The login page shows attempts left from the 3rd failure, says so on the 5th, and shows a live countdown. A correct login clears only the pair counter, so logging into your own account cannot reset the failures counted against your address. If Redis is down, logins are let through.
- **Where:** `customer/security/login-limiter.js`, used by `customer/controller.js`, with the countdown in `customer/customer-auth.js`
- **Known trade-offs:**
  - One network address can try about 80 passwords an hour across different emails before it is stopped, since each email only sees one failure.
    - Why accepted: customer accounts hold booking history and no stored cards, and a lower limit would lock out people sharing WiFi or a mobile carrier network.
  - Everyone behind one network address is blocked for 15 minutes after 20 failures from it.
    - Why accepted: it takes 20 failures, which a few typos on shared WiFi rarely reach.
  - Rotating network addresses bypasses the limit.
    - Why accepted: no limit tied to an address can stop that.
  - Attempts left only appear when the same email is repeated. Trying different emails shows no warning until the address lock.
    - Why accepted: counting per pair is what stops a stranger from locking a real customer out.
  - The counter is incremented and then given an expiry in a second Redis call, so a crash between the two could leave a counter that never expires.
    - Why accepted: the gap is milliseconds wide, and the worst case is one customer locked after fewer mistakes than they should have.
  - If Redis is down, logins are not limited.
    - Why accepted: availability matters more than the limit for a short outage.

### Error handling - generic messages

- **Protects against:** leaking which accounts exist or what failed inside the server.
- **How it works:** wrong email and wrong password give the same message. Server errors on sign up and in the customer account show a generic message, and the real error goes to the server log.
- **Where:** `customer/controller.js`, `customer/account.controller.js`
- **Known trade-offs:**
  - Other parts of the app still return raw error messages. See the last section.

## 4. Web and network

### Cookie hardening - session cookie

- **Protects against:** page scripts reading the cookie, the cookie travelling over plain HTTP, and other sites triggering logged in requests.
- **How it works:** the session cookie is `httpOnly` (page scripts cannot read it), `secure` in production (HTTPS only), and `sameSite: lax` (it is not sent on cross-site form posts or background requests, but it is still sent when someone follows a link or a payment redirect back). Customer sessions last 8 hours, or 30 days with remember me. Sessions live in Redis with an expiry.
- **Where:** `app.js`
- **Known trade-offs:**
  - `SESSION_SECRET` has a development fallback in `app.js`.
    - Why accepted: it lets local setup run without configuration. Booking tokens refuse to sign in production without a real secret, so it must be set on the host.
  - `httpOnly` stops a script from stealing the cookie, but a script already running on the page can still act as the logged in user. See the unescaped page data in the last section.
    - Why accepted: it limits the damage and does not replace escaping the data.

### Client address trust - proxy setup

- **Protects against:** address based limits seeing the proxy instead of the real visitor.
- **How it works:** `trust proxy` is set to 3 for Cloudflare plus Render, so the visitor address is the third address from the app side.
- **Where:** `app.js`
- **Known trade-offs:**
  - It must be rechecked if the hosting or domain setup changes.
    - Why accepted: it is correct for the current setup, and a wrong count only affects address based limits.
  - Reaching the app directly through the default `onrender.com` address skips Cloudflare, and a visitor there could fake their address.
    - Why accepted: it only matters to someone who finds that address. The fix is disabling it on the host.

## 5. Abuse limits

### Abuse prevention - strikes and booking blocks

- **Protects against:** repeated holds that never turn into payments.
- **How it works:** a strike is added when a hold ends without payment, by cancel, expiry or an abandoned tab. Paid bookings add none. 3 strikes within 1 hour block booking for 2 hours. Logged in customers are counted by account and guests by network address. Block messages show the time left in hours and minutes.
- **Where:** `shared/utils/cron.js`, `bookings/controller.js`
- **Known trade-offs:**
  - VPN or address rotation bypasses the guest block.
    - Why accepted: same reason as the hold caps.
  - Guests on a shared network share the block.
    - Why accepted: guests have no account to count by.
  - Guests can still book without an account.
    - Why accepted: it is a product choice that keeps booking easy.

## 6. Data and operations

### Data integrity - time zone and weekly purge

- **Protects against:** wrong dates across time zones, and half finished cleanups.
- **How it works:** timestamps are stored with time zone and dates use Asia/Manila. The weekly purge removes old expired bookings with their unpaid leftovers in one transaction, and rolls back on failure.
- **Where:** `bookings/purge.js`
- **Known trade-offs:** none known.

### Audit logging - admin actions

- **Protects against:** admin changes that nobody can trace.
- **How it works:** admin actions that change records write to the audit log, and the log screen escapes its text.
- **Known trade-offs:** none known.

### Input validation - image uploads

- **Protects against:** non-image files being uploaded.
- **How it works:** uploads accept JPEG, PNG, WEBP and GIF only. Uploading is admin only.
- **Known trade-offs:**
  - The check trusts the type the browser declares and does not inspect the file content.
    - Why accepted: only admins can upload.

### Test safety - local only scripts

- **Protects against:** test scripts touching real data or emailing real people.
- **How it works:** test scripts refuse to run unless the database is local, and use `@example.test` addresses.
- **Known trade-offs:**
  - Redis, Xendit and email are stubbed in the automated tests, so no automated test talks to the real Xendit sandbox.
    - Why accepted: tests stay safe and repeatable. The real payment round trip is checked by hand.

## 7. Protections we do not have

These are known gaps, not trade-offs of something we built.

- **No CSRF token.** `sameSite: lax` is the only defense against cross-site requests.
  - Why accepted: lax keeps the cookie off cross-site form posts and background requests, and tokens on every route would be a large change. Revisit if a flow ever needs `sameSite: none`.
- **No security headers package (such as helmet).**
  - Why accepted: strict headers can break pages that load outside scripts or styles, so it needs its own testing pass.
- **JSON bodies up to 10 MB are accepted.**
  - Why accepted: nothing sensitive depends on request size, and per route limits are the fix.
- **About 60 error responses outside the customer account still return the raw error message.** This is tracked as a separate issue.
  - Why accepted: it needs an error to occur first, and the real error is also in the server log.
- **Staff and admin login does not regenerate the session id.** Customer login does.
  - Why not yet: it lives in the staff and admin login code, and the single session rule limits each account to one session.
- **The customer account page builds some HTML from booking data without escaping it** (service name, motorcycle model, color and plate).
  - Why not yet: it is mostly the customer's own data and the cookie is `httpOnly`, so a script cannot steal it. It belongs to the account page rework.
