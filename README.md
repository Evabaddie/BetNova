# BetNova Phase 3

A starter for turning the prototype into a real web application.

## Included
- Express API
- SQLite database
- Secure password hashing with bcrypt
- HTTP-only admin session cookie with JWT
- Prediction CRUD API
- Public prediction filtering
- Production cookie security when `NODE_ENV=production`

## Run locally
1. Install Node.js 18+.
2. Extract this project.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Change `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
6. Run `npm start`.
7. Open `http://localhost:3000`.

## Important
This starter is for a prediction/content platform. It does not implement real-money betting, deposits, withdrawals, or payment processing.

Before production deployment, add HTTPS, rate limiting, CSRF protection appropriate to the final auth architecture, database backups, audit logs, validation, monitoring, and a proper production database such as PostgreSQL.


## Phase 4
The public dashboard is now connected to the API. Admin login, prediction CRUD, filtering, statistics, details, and league/market views use server data.
