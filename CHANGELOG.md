# Changelog

All notable changes to this project are documented in this file.



![Version](https://img.shields.io/badge/version-1.4.0-blue)




![Status](https://img.shields.io/badge/status-stable-brightgreen)




![Release Date](https://img.shields.io/badge/released-2026--11--12-informational)



---

## [1.4.0] - 2026-11-12

Security hardening for the v1 line: login protection, safer sessions and cookies, correct visitor addresses behind the proxy, and a demo seed that matches the app. Details are in [docs/SECURITY.md](docs/SECURITY.md).

### Added

| Change | Area |
|---|---|
| Customer login limit, 5 wrong tries per email and address and 20 per address, then a 15 minute block | Auth |
| Fresh session id at customer login, and other devices signed out when the password changes | Auth |
| Wrong code and resend limits on password reset and email change | Auth |
| Login and logout events in the audit log | Admin |
| Security reference rewritten per protection, with titles and known trade-offs | Docs |

### Changed

| Change | Area |
|---|---|
| Guests are tracked by their real visitor address, `trust proxy` is set to 3 for Cloudflare plus Render | Security |
| Session cookie uses `sameSite: lax` in production instead of `none` | Security |
| Staff login block restored to 15 minutes after a temporary test value | Security |
| Admin walk-in reference codes use the `HRC-` format like online bookings | Bookings |
| Demo seed follows how the app really writes data, with `@example.test` demo accounts | Database |
| Schema reference updated with timezone columns and `email_verified`, snapshots v1.11.0 and v1.12.0 added | Database |

### Fixed

| Change | Area |
|---|---|
| Guest strikes and blocks were split across proxy addresses, so slow abandons never reached a block | Security |
| Account endpoints no longer send raw error text to the browser | Security |
| Down payment migration failed on existing services, it now backfills before requiring the column | Database |
| Staff booking modal did not open from unfinished jobs | Staff |
| Back button after login no longer loses the session | Auth |
| Login page logo centering and favicon | Auth UI |

---

## [1.3.0] - 2026-11-09

Staff app redesign on `stable-v1`: board, in-app scanner, account page, and consistent queue numbering.

### Added

| Change | Area |
|---|---|
| In-app QR scanner on the Scan tab, reads booking codes with jsQR, with a typed-code fallback | Staff |
| Account page with editable name and phone, saved through a staff profile route | Staff |
| Password change and email change by one-time code, locked after five wrong codes | Staff, Auth |
| Shared top bar with the Herco mark and an account button on every staff page | Staff UI |
| Future date picker on walk-in when today has no slot | Staff |
| Stat card filters on the board, filtering today's bookings and the upcoming list | Staff |
| Unfinished jobs section above the board, collapsed by default, with a count and hint | Staff |

### Changed

| Change | Area |
|---|---|
| Queue numbers stay unique per slot and are never reused across online, admin walk-in, staff walk-in, and reschedule | Bookings |
| Board groups today's bookings by service and includes carried-over jobs from the last 7 days | Staff |
| Board, Upcoming, Walk-in, and Account share the same header and row design | Staff UI |
| Logout moved from the Board to the Account page, behind a confirmation popup | Staff |

### Fixed

| Change | Area |
|---|---|
| Cancelled queue numbers are no longer reused | Bookings |
| Reschedule renumbers moved bookings and skips cancelled or picked up ones | Bookings |
| Staff-facing user input is escaped before it is rendered | Staff |
| Account page had no top bar | Staff UI |

### Removed

| Change | Area |
|---|---|
| Board filter tabs, My In Progress and Done boxes, and the old Dashboard header | Staff |
| Logout button and popup from the Board, Scan, and Walk-in title rows | Staff |

---

## [1.2.0] - 2026-11-08

Booking and payment hardening for the v1 line, released from `stable-v1`. Security details are in [docs/SECURITY.md](docs/SECURITY.md) and test evidence in [docs/DOUBLE-BOOKING-TEST-REPORT.md](docs/DOUBLE-BOOKING-TEST-REPORT.md).

### Added

| Change | Area |
|---|---|
| Atomic capacity check when locking a slot, so simultaneous requests cannot double book | Bookings |
| Hold caps, 2 per logged in account and 5 per guest network | Bookings |
| Signed token required to release, edit or pay for a hold | Bookings |
| Closed tab detection, a hold whose page never comes back is freed after 60 seconds | Bookings |
| Email verification with a code before sign in | Auth |
| Redesigned customer sign in and sign up pages | Auth UI |
| Reconcile job that frees a held booking only on Xendit's word | Bookings, Payments |
| Same checkout is reused when pay is pressed twice | Payments |
| Single active session per staff and admin account | Auth |
| Refund tracking, walk-in down payments and final price adjustment | Payments, Staff |
| Automated test scripts T1 to T14 | Tooling |

### Changed

| Change | Area |
|---|---|
| Down payment is a flat service amount instead of full or 50 percent | Payments |
| Payment starts extend the hold to 16 minutes, the invoice lasts 15 | Payments |
| Cancel settles invoices with Xendit before releasing a slot | Bookings |
| Timestamps stored with time zone and dates use Asia/Manila | Database |
| Block message shows hours and minutes and mentions unused reservations | Bookings |
| Landing page and navbar redesigned | Landing |

### Fixed

| Change | Area |
|---|---|
| Invoice webhook is safe to repeat, one confirmation and one email | Payments |
| A paid customer on an expired booking is still confirmed | Payments |
| Release is refused when a payment has started | Bookings |
| Weekly purge failed on bookings with payment rows | Cron |
| Success page no longer shows an error to a paid customer when the first check fails | Bookings |
| Switching service frees the previously held slot | Bookings |
| Queue numbering is consistent across booking flows | Bookings |
| Past dates are rejected on walk-in | Staff |

---

## [2.0.0-alpha.2] - 2026-10-22

Security fix and account route cleanup, carried over from `stable-v1`.

### Changed

| Change | Area |
|---|---|
| Staff account routes renamed from `/api/admin/staff` to `/api/admin/accounts` | Admin |

### Removed

| Change | Area |
|---|---|
| Unused signup page, its route and its script | Auth |

### Fixed

| Change | Area |
|---|---|
| Account creation was open to anyone without logging in, now admin-only at `POST /api/admin/accounts` | Auth, Admin |

---

## [2.0.0-alpha.1] - 2026-10-19

Early v2 checkpoint. Payments extracted into their own feature on the Xendit Payment Requests API.

### Added

| Change | Area |
|---|---|
| `payments/` feature mounted at `/api/payments` | Payments |
| GCash checkout through Xendit Payment Requests, redirecting straight to GCash | Payments |
| Webhook verification with `x-callback-token` | Payments |
| Idempotent booking confirmation, a repeated webhook cannot change the queue number or resend the email | Payments, Bookings |

### Changed

| Change | Area |
|---|---|
| Booking payment step shows a GCash row and calls `/api/payments/gcash` | Booking UI |
| Xendit webhook moved to `/api/payments/webhook` (event `payment.succeeded`), dashboard URL must be set manually | Payments |

### Removed

| Change | Area |
|---|---|
| Invoice checkout and the unauthenticated `/api/booking/webhook`, `/pay`, `/details` routes | Bookings |
| Unused Xendit invoice and generic clients | Config |

### Fixed

| Change | Area |
|---|---|
| Wrong relative requires in the customer auth controller | Customer |

---

## [2.0.0-alpha] - 2026-09-26

Structural refactor only, no behavior changes.

### Changed

| Change | Area |
|---|---|
| Feature folders restructured into `controller.js`, `queries.js`, `routes.js` and `views/` | Codebase |
| Customer account and auth logic split, auth lives in `customer/auth/` | Customer |

---

## [1.1.0] - 2026-10-22

Security and polish release for the v1 line, released from `stable-v1`.

### Changed

| Change | Area |
|---|---|
| Staff account routes renamed from `/api/admin/staff` to `/api/admin/accounts` | Admin |
| Admin notifications are clickable and open the booking with the search prefilled | Admin UI |
| Chrome autofill no longer turns login inputs white | Auth UI |
| `XENDIT_WEBHOOK_TOKEN` is now required by the invoice webhook and documented in the env example | Bookings, Config |
| Prettier config added so formatting matches `main` | Tooling |

### Removed

| Change | Area |
|---|---|
| Unused signup page, its route and its script | Auth |

### Fixed

| Change | Area |
|---|---|
| Account creation was open to anyone without logging in, now admin-only at `POST /api/admin/accounts` | Auth, Admin |
| Invoice webhook accepted unauthenticated requests, now verifies `x-callback-token` | Bookings |

---

## [1.0.0] - 2026-09-11

Defended baseline, stabilized after panel feedback.

### Added

| Change | Area |
|---|---|
| Rate limiting on login endpoint | Auth |
| Redis migration (Upstash to ioredis) | Session, OTP, Cron, Password Reset |
| Docker dev/prod compose setup | Infra |
| Automated database migration and seed scripts | Database |
| Skeleton loading states on admin pages | Admin UI |

### Fixed

| Change | Area |
|---|---|
| Post-defense bug fixes | Login, Admin, Payment, Reschedule |
| Image upload MIME type validation | Uploads |

### Changed

| Change | Area |
|---|---|
| Codebase formatted with Prettier | Tooling |
| Admin pages inline JS extracted into separate files | Admin |
| Navbar redesigned, feature static files reorganized | Landing |

---
