# Serein House — hotel guest and operations starter

A new hotel project foundation with:

- A responsive, image-led hotel website with an animated hero slideshow, room gallery, contact form, accessibility controls, and a public booking request.
- A staff workspace preview with color-coded room status, booking views, daily operations, revenue, expenses, and team access screens.
- A PHP 8.1+ API and MySQL 8 schema for roles/permissions, guests, rooms and amenities, reservations, payments, expenses, settings, and operation history.
- An Expo companion app for staff to view room readiness and mark rooms ready.

The sample property identity, contact details, prices, and room data are demonstration content; replace them with the hotel's actual information before launch.

## Web preview

```powershell
npm install
npm run dev
```

The web preview defaults to **demo mode**. Booking, room, team, role-permission, and expense edits are stored in that browser's local storage only; this is not database-backed login or production storage. Use the Staff login button and choose a role to preview the views. The login form explicitly identifies this as demo access.

To point the web app to the PHP API, copy `.env.example` to `.env.local`, configure `VITE_API_BASE` for your API URL, and set `VITE_DEMO_MODE=false`. The API origin must match `HOTEL_ALLOWED_ORIGIN` in the PHP configuration. Live API-backed screens include login, bookings, room status, guest notes, contact requests, expenses, team accounts/role assignment, and revenue CSV export. The mobile app is not yet connected to live authentication or data.

## PHP and MySQL

1. Install PHP 8.1+ with PDO MySQL and MySQL 8.
2. Import `database/schema.sql` into the MySQL server.
3. Copy `api/config.example.php` to `api/config.php` and set `HOTEL_DB_DSN`, `HOTEL_DB_USER`, `HOTEL_DB_PASSWORD`, `HOTEL_ALLOWED_ORIGIN`, and `HOTEL_SESSION_SECURE` in the PHP environment.
4. Configure Apache/Nginx to route `/api/*` to `api/index.php`; serve the Vite production `dist` directory for the website. For local API development, point the web client at the PHP API URL in `.env.local`.
5. Create the first super-admin from the project directory using the one-time CLI bootstrap. Set `HOTEL_ADMIN_NAME`, `HOTEL_ADMIN_EMAIL`, and a unique password of at least 12 characters in your local environment, then run `php api/create_admin.php`. The bootstrap is CLI-only, refuses to run if a super-admin already exists, and does not provide a default password. Remove the password environment variable after the command completes.

The API uses prepared queries, password hashes, HTTP-only sessions, CSRF tokens for signed-in writes, role-permission checks, and audit records. Public booking requests are saved as `pending` until staff confirms them. Guest accounts must be linked to their matching `guests.user_id` record before the guest portal is enabled. Keep the API behind HTTPS and configure backups, mail delivery, upload scanning, and rate limiting before production use.

### API starter endpoints

- `GET /api/health`
- `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout`
- `POST /api/bookings` (public request or authenticated booking creation)
- `GET /api/bookings`, `PATCH /api/bookings/{id}`
- `GET /api/rooms`, `PATCH /api/rooms/{id}`
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/{id}`
- `GET /api/roles`, `POST /api/roles`, `PATCH /api/roles/{id}/permissions`
- `GET /api/expenses`, `POST /api/expenses`
- `GET /api/reports/revenue.csv` (CSV report that opens in spreadsheet applications)
- `GET|POST /api/bookings/{id}/notes`, `POST /api/bookings/{id}/payments`
- `POST /api/contact`

All IDs are auto-increment primary keys; reservation references are separate human-friendly codes. API checks permissions server-side and guest booking reads are scoped to the guest linked to their account.

## Expo staff app

```powershell
Set-Location mobile
npm install
npm start
```

The mobile app currently runs as a standalone interface preview with local room-status state. Connect it to the API and authenticated staff session before using it with live hotel data.

## Validation

```powershell
npm run build
npm run lint
Set-Location mobile
npx expo export --platform web
```

The PHP runtime is not installed in the current development environment, so PHP/MySQL endpoint execution must be verified in the target server environment.
