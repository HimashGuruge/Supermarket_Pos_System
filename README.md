# Supermarket POS System

A point-of-sale system for a supermarket. The POS screen bills items fast (barcode or search), keeps stock counts accurate, and prints thermal receipts. Sales, products, customers, purchases, returns, and a dashboard are all managed from one app.

## Tech stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS, React Router, axios, recharts        |
| Backend  | Node.js, Express 5, Mongoose (MongoDB), JWT auth, Socket.IO        |
| Database | MongoDB                                                             |

```
Browser (React, :5173)
        │  HTTP + WebSocket
        ▼
Express server (:3000)  ── JWT auth, routes per feature
        │
        ▼
MongoDB (:27017)
```

## Project structure

```
POS Sytem/
├── Backend/    Node + Express API
│   ├── index.js            Server entry: DB connect, seed, Socket.IO, routes
│   ├── config/db.js        Mongoose connection (reads MONGO_URI)
│   ├── seed/seed.js        Fills an empty DB with demo data (users, products, ...)
│   ├── controllers/        One file per feature: auth, products, sales, ...
│   ├── middleware/         auth (JWT check) and authorize (role check)
│   ├── models/             Mongoose schemas: User, Product, Sale, ...
│   └── routes/             Express routers mounted under /api/*
└── Frontend/   React app
    ├── src/pages/          PosPage, SalesHistoryPage, DashboardPage, ...
    ├── src/lib/            printReceipt.js (shared receipt printer), api.js
    └── src/components/     Layout, sidebar, charts, ...
```

## Setup

Prerequisites: Node.js 18+, MongoDB running locally (port 27017).

### 1. Backend

```bash
cd Backend
npm install
```

Create `Backend/.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/posdb
JWT_SECRET=pick-a-long-random-string
PORT=3000
```

Start it:

```bash
node index.js
```

On first start it connects to MongoDB and fills an empty database with seed data (3 users, 8 categories, 38 products with barcodes and stock levels, suppliers, customers, store settings). Running it again never creates duplicates.

### 2. Frontend

```bash
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in.

## Default logins (seed data)

| Role           | Email             | Password   | Can do                                                        |
| -------------- | ----------------- | ---------- | ------------------------------------------------------------- |
| Admin          | admin@pos.com     | admin123   | Everything: billing, products, purchases, reports, settings    |
| Cashier        | cashier@pos.com   | cashier123 | POS billing and sales history only                             |
| Stock manager  | stock@pos.com     | stock123   | Products, stock movements, purchases, returns                  |

## Features

- **POS billing** — barcode input, product search, cart, line discounts, cash or card payment, change due, receipt print (58/80 mm thermal layout).
- **Sales history** — date filter, receipt view, cancel a sale (stock is restored), print any old receipt.
- **Products & stock** — barcodes, expiry dates, stock-in/out movements, low-stock visibility.
- **Purchases & returns** — stock-in from suppliers, returns recorded against products.
- **Customers** — customer list for sales.
- **Dashboard** — sales and revenue charts (recharts).
- **Settings** — store name, tax rate, receipt footer, currency (LKR).
- **Roles** — JWT-protected API; sidebar menus change per role.
- **Live updates** — Socket.IO broadcasts new sales and stock alerts to open browsers.

## API overview

All endpoints return JSON and need a `Authorization: Bearer <token>` header (login is the exception).

| Base URL               | What it covers                                        |
| ---------------------- | ----------------------------------------------------- |
| `POST /api/auth/login`  | Log in, get a JWT token                               |
| `/api/products`         | Products: list, create, update, delete, barcode lookup|
| `/api/categories`       | Product categories                                    |
| `/api/customers`        | Customers                                             |
| `/api/suppliers`        | Suppliers                                             |
| `/api/sales`            | Sales: create, list (date filter), cancel (restock)   |
| `/api/purchases`        | Purchase orders / stock-in                            |
| `/api/returns`          | Product returns                                       |
| `/api/users`            | User management                                       |
| `/api/stock-movements`  | Stock in/out log                                      |
| `/api/dashboard`        | Totals and chart data                                 |
| `/api/settings`         | Store settings                                        |
| `/api/notifications`    | Notifications                                         |

Quick test from the command line:

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@pos.com\",\"password\":\"admin123\"}"
```

The response includes `token` — send it back as `Authorization: Bearer <token>`.

## Printing

Receipts use one shared helper (`Frontend/src/lib/printReceipt.js`) so new sales (POS page) and old sales (Sales History) print identically. The layout is sized for 58/80 mm thermal printers and opens in a print window — it also works with "Save as PDF".

## Environment variables

| Variable     | Where   | Meaning                          | Default                              |
| ------------ | ------- | -------------------------------- | ------------------------------------ |
| `MONGO_URI`  | Backend | MongoDB connection string        | `mongodb://127.0.0.1:27017/posdb`    |
| `JWT_SECRET` | Backend | Secret used to sign login tokens | `pos-super-secret-change-me` (change it!) |
| `PORT`       | Backend | API port                         | `3000`                               |

`Backend/.env` is git-ignored, so secrets never go to git.
