# Changelog

All notable changes to this project are documented in this file.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Status](https://img.shields.io/badge/status-stable-brightgreen)
![Release Date](https://img.shields.io/badge/released-2026--11--08-informational)

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

