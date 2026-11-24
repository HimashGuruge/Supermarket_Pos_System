# AGENTS.md

Supermarket POS: two independent apps in one repo — `Backend/` (Express 5 + Mongoose + JWT + Socket.IO, port 3000) and `Frontend/` (React 19 + Vite + Tailwind, port 5173). No monorepo tooling, no root package.json, no CI, no test framework.

## Running

- Prereq: MongoDB running locally on port 27017 (server does not start without it).
- Backend: `cd Backend && npm install && node index.js` (no dev script; run the file directly).
- Frontend: `cd Frontend && npm install && npm run dev`.
- Backend seeds demo data on boot (`seed/seed.js`, idempotent — safe to re-run). It **refuses to start without `JWT_SECRET`** in `Backend/.env`.
- Backend has no test script; Frontend has `npm run lint` (eslint) and `npm run build`. There is no unit-test or typecheck step anywhere in the repo.
- Verify backend changes by hitting the API: `curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@pos.com\",\"password\":\"admin123\"}"` → use returned `token` as `Authorization: Bearer <token>`.

## Key files

- `Backend/index.js` — server entry: DB connect, seed, Socket.IO, routes, CORS
- `Backend/config/db.js` — Mongoose connection (reads `MONGO_URI`)
- `Backend/seed/seed.js` — idempotent demo data (users, categories, products)
- `Backend/middleware/auth.js` — JWT check; `Backend/middleware/authorize.js` — role check
- `Backend/models/` — Mongoose schemas: `User.js`, `Product.js`, `Category.js`, `Sale.js` (items embedded), `Purchase.js`, `Return.js`, `StockMovement.js`, `Settings.js`, `Customer.js`, `Supplier.js`, `Notification.js`
- `Backend/controllers/saleController.js` — core sale/cancel/restock logic (largest controller)
- `Backend/controllers/returnController.js` — returns logic
- `Backend/controllers/dashboardController.js` — totals/charts, Asia/Colombo TZ bucketing
- `Backend/routes/` — one router per feature, mounted under `/api/*`
- `Frontend/src/App.jsx` — router + auth gate; `Frontend/src/main.jsx` — entry
- `Frontend/src/contexts/AuthContext.jsx` — session state
- `Frontend/src/lib/api.js` — axios client with JWT interceptor + 401 auto-logout
- `Frontend/src/lib/roles.js` — role-based sidebar/menu logic
- `Frontend/src/lib/printReceipt.js` — shared 58/80 mm thermal receipt printer
- `Frontend/src/pages/PosPage.jsx` — POS billing UI (largest page, barcode scanner)
- `Frontend/src/pages/DashboardPage.jsx` — stat cards, 7-day chart, live Socket.IO updates
- `Frontend/src/pages/SalesHistoryPage.jsx`, `ReturnsPage.jsx`, `PurchasesPage.jsx`, `ProductsPage.jsx`, `CustomersPage.jsx`, `SettingsPage.jsx`, `LoginPage.jsx`
- `Frontend/src/components/ui/` — shared wrappers: `Badge`, `Button`, `Card`, `Input`, `Modal`, `Select`, `Stat`, `Table`
- `Frontend/src/pages/AboutPage.jsx`, `ProfilePage.jsx` — stubs (placeholder text only)
- Debug artifacts: `Backend/dbg_return.js`, `Backend/repro_return.js`, `Backend/e2e_test.ps1`, `Backend/return_test.ps1`

## Architecture notes

- Every route is behind `middleware/auth.js` (JWT) + `middleware/authorize.js` (`authorize(...roles)`). Roles: `admin`, `cashier`, `stock`. The frontend mirrors these checks in `Frontend/src/lib/roles.js` and per-page; keep both sides in sync when adding permissions.
- `Backend/index.js` is the only entrypoint: DB connect, seed-on-boot, Socket.IO, route mounting, CORS.
- Sale and return logic in `controllers/saleController.js` / `returnController.js` uses MongoDB transactions (`withTransaction`). Note: Mongoose session objects are not JSON-serializable — keep sessions out of anything that gets logged or stored.
- Sale documents snapshot product name/price/costPerUnit per item; stock movements (`in`/`out`/`adjust`) are written alongside sales, purchases, and returns.
- `Settings` is a single cached document (store name, tax rate, discount, receipt footer, low-stock threshold, logo).
- Receipt printing: one shared helper `Frontend/src/lib/printReceipt.js` (58/80 mm thermal layout). Both POS and Sales History must print through it — don't duplicate the layout.
- Store logo uploads go to `Backend/uploads/` (gitignored), via multer.

## Gotchas

- CORS is locked to `localhost:5173` and `localhost:5174` in `Backend/index.js`. If you test from another port or origin, update the CORS list or requests fail silently (401/403).
- Backend is Express **5** (not 4): async route handlers reject to the error middleware automatically; no `next(err)` needed for async errors.
- Backend is CommonJS (`"type": "commonjs"`); Frontend is ESM.
- `Backend/.env` holds `MONGO_URI` and `JWT_SECRET`; it is gitignored per-package (there is no root `.gitignore`).
- Dashboard controller buckets by Asia/Colombo timezone — date-based queries should use the same TZ, or chart data shifts.
- Untracked debug artifacts at `Backend/` (`dbg_return.js`, `repro_return.js`, `e2e_test.ps1`, `return_test.ps1`) and stray `*.log` files are leftovers from returns-feature debugging; safe to delete, but don't delete them mid-investigation of returns bugs.
- `Frontend/src/pages/AboutPage.jsx` and `ProfilePage.jsx` are stubs (placeholder text only).
