# Changelog

All notable changes to this project are documented in this file.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Status](https://img.shields.io/badge/status-stable-brightgreen)
![Release Date](https://img.shields.io/badge/released-2026--09--11-informational)

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