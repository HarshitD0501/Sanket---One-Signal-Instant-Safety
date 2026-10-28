# 🛡️ Sanket — Instant Safety & SOS System

Sanket is a rapid-response emergency safety application designed to provide immediate alerts and real-time situational awareness during crisis situations. It enables one-tap or motion-activated SOS alerts, multi-channel emergency notification dispatch, public live tracking, safe-zone discovery, and AI-assisted safety guidance.

---

## 🏗️ Architecture & Technology Stack

The active codebase is organized as a decoupled React client and Express backend:

| Layer | Technologies | Role & Integration |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, React Router 6 | Responsive web application; Dashboard, SOS button, live map, tracking viewer, and assistant widget. |
| **Styling & Motion** | CSS design tokens, GSAP, OGL | Dark-themed accessible UI with responsive layouts and motion-sensor triggers. |
| **Maps & Routing** | Leaflet, React Leaflet, OpenStreetMap, OSRM | Visual map rendering, nearby police/hospital safe zones, and routing navigation (no Google Maps API key required). |
| **Backend API** | Node.js (>= 18), Express 4 | REST API handling authentication, contacts, SOS events, tracking tokens, and assistant endpoints. |
| **Database & ORM** | PostgreSQL, Sequelize 6 | Relational persistence for users, emergency contacts, SOS events, notifications, and location trails. |
| **Realtime** | Socket.IO 4 | WebSocket server for live location broadcasting to tracking rooms and authenticated SOS state sync. |
| **Messaging** | Meta WhatsApp Business Cloud API (Graph API) | Outbound automated WhatsApp emergency alerts and all-clear notifications to trusted contacts. |
| **Voice Calls** | Twilio Voice SDK | Outbound emergency automated phone calls to emergency contacts with bilingual TwiML. |
| **AI Assistant** | Google Gemini REST API | Real-time safety advice and situational crisis guidance. |
| **Live Audio** | LiveKit Client & Server SDK | Token-based WebRTC audio room infrastructure. |

> [!NOTE]
> **Stack Reconciliation Notice (AUDIT-011)**  
> Early project drafts (including `plan.md`) referenced MongoDB, Mongoose, and Google Maps. The project transitioned to **PostgreSQL + Sequelize 6** and **OpenStreetMap (Overpass & Nominatim)**. For full audit findings and remediation plans, refer to [CODEBASE_AUDIT_REPORT.md](file:///C:/Users/harsh/Downloads/Project/Sanket_Pro/Sanket---One-Signal-Instant-Safety/CODEBASE_AUDIT_REPORT.md) and [CODEBASE_REMEDIATION_PLAN.md](file:///C:/Users/harsh/Downloads/Project/Sanket_Pro/Sanket---One-Signal-Instant-Safety/CODEBASE_REMEDIATION_PLAN.md).

---

## 📋 Prerequisites

- **Node.js**: `v18.0.0` or higher (Node 20 LTS recommended).
- **npm**: `v9.0.0` or higher.
- **PostgreSQL**: `v14` or higher (local instance, Docker container, or managed instance such as Supabase/Neon).

---

## ⚙️ Configuration & Environment Variables

Copy the template `.env.example` in the project root to `.env`:

```bash
cp .env.example .env
```

### Environment Settings Reference

| Category | Variables | Description |
|---|---|---|
| **Server** | `PORT`, `NODE_ENV`, `CLIENT_URL` | Port (`5000`), environment (`development`), and client origin for CORS/links (`http://localhost:5173`). |
| **Database** | `DATABASE_URL` or `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PG_SSL` | PostgreSQL connection string or discrete parameters. Set `PG_SSL=true` for SSL-required hosted databases. |
| **JWT** | `JWT_SECRET`, `JWT_EXPIRE` | Secret key for signing bearer tokens and token expiration (e.g., `7d`). |
| **Twilio Voice** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Twilio account credentials and verified outbound phone number for emergency voice calls. |
| **WhatsApp Cloud API** | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`, `WHATSAPP_SOS_TEMPLATE`, `WHATSAPP_ALLCLEAR_TEMPLATE` | Meta Graph API credentials and approved template names for business-initiated emergency alerts. |
| **Tracking TTL** | `TRACKING_LINK_TTL_HOURS`, `RESOLVED_TRACKING_TTL_MINUTES`, `SOS_NOTIFICATION_MAX_ATTEMPTS` | Public tracking URL lifetime and notification retry limits. |
| **LiveKit** | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit cloud/self-hosted credentials for WebRTC room token issuance. |
| **Gemini AI** | `GEMINI_API_KEY`, `GEMINI_MODEL` | Google Gemini API key and model identifier (e.g., `gemini-2.0-flash` or `gemini-3-flash-preview`). |
| **Test Safety** | `ALLOW_DESTRUCTIVE_DB_TEST` | Safety switch (`false` by default). Set to `true` ONLY when running `server/test-db-smoke.js` on an isolated scratch DB. |

> [!CAUTION]
> Never commit `.env` or paste real secrets, authentication tokens, API keys, or personal phone numbers into version control or issues.

---

## 🚀 Getting Started

### 1. Install Dependencies

Install packages in both `server` and `client` directories:

```bash
# Backend dependencies
cd server
npm install

# Frontend dependencies
cd ../client
npm install
```

### 2. Start the Backend API

From the `server` directory:

```bash
# Development (with node --watch)
npm run dev

# Or standard production start
npm start
```
The server will start on port `5000` (or `PORT` in `.env`), connect to PostgreSQL, and initialize the Socket.IO listener.

### 3. Start the Frontend Client

From the `client` directory:

```bash
# Vite development server
npm run dev
```
The client runs at `http://localhost:5173`. Vite proxies `/api` and `/socket.io` requests to `http://localhost:5000`.

To build the client for production:
```bash
npm run build
```

---

## 🧪 Safe Diagnostics & Testing

The repository provides non-destructive diagnostics and strictly guarded test scripts:

### 1. Read-Only Database Diagnostic
Inspects current database records, masks phone numbers, and verifies tables without altering any data:
```bash
node server/check-db.js
```

### 2. Offline WhatsApp Cloud Self-Check
Runs an offline unit test for phone normalization (E.164 conversion) and ensures unconfigured environments fail safely without throwing:
```bash
node server/test-whatsapp-cloud.js
```

### 3. Guarded Database Smoke Test
> [!WARNING]
> `server/test-db-smoke.js` runs `sequelize.sync({ force: true })`, which **DROPS ALL TABLES** in the target database.  
> It has an explicit safety guard requiring `ALLOW_DESTRUCTIVE_DB_TEST=true` and blocks execution in `NODE_ENV=production`.  
> Run ONLY against a dedicated, disposable local test database:
```bash
ALLOW_DESTRUCTIVE_DB_TEST=true node server/test-db-smoke.js
```

### 4. Legacy SOS Diagnostic
`server/test-trigger-sos.js` is an obsolete prototype script from the earlier MongoDB prototype. It has been disabled with an execution guard to prevent accidental notifications or crashes.

---

## 🔒 Safety & Operational Rules

1. **No External Paid Calls in Tests**: Never trigger live WhatsApp messages or Twilio phone calls to real contacts during automated tests.
2. **PII Redaction**: Do not log tokens, passwords, phone numbers, or user coordinates in server output.
3. **Audit Compliance**: All bug fixes and enhancements follow the phased plan in [CODEBASE_REMEDIATION_PLAN.md](file:///C:/Users/harsh/Downloads/Project/Sanket_Pro/Sanket---One-Signal-Instant-Safety/CODEBASE_REMEDIATION_PLAN.md).