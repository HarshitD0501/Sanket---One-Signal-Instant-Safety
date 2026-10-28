# Production Audit — Sanket SOS App

> [!CAUTION]
> **AUDIT RECONCILIATION NOTICE (AUDIT-011)**  
> This checklist is an earlier historical audit log that claimed 42/42 items were fixed. Subsequent comprehensive source audit (**2026-10-28**) established that several critical items were NOT resolved in the current source or referred to a superseded MongoDB architecture.  
> Examples of items that remain open in current source include:
> - Active tracking expiry enforcement in HTTP & Socket.IO (AUDIT-002)
> - Multi-write non-transactional SOS creation (AUDIT-001)
> - Post-mount SOS state hydration and socket connection lifecycle (AUDIT-003)
> - WhatsApp free-form emergency message fallbacks (AUDIT-004)
> - LiveKit room authorization & arbitrary client room naming (AUDIT-005)
> - iOS shake sensor permission and accessibility semantics (AUDIT-006)
> - Zero-coordinate handling on map view (AUDIT-007)
> - Tracking page static LIVE badge and missing terminal event handlers (AUDIT-008)
> - Rate limiter counter sharing across policies and memory unboundedness (AUDIT-009, AUDIT-012)
> - Twilio emergency call latency on AI/WhatsApp serialization (AUDIT-010)
> - Landing page assistant authentication mismatch (AUDIT-013)
> - 5xx exception message leaks (AUDIT-014)
> - Database startup automatic schema sync instead of versioned migrations (AUDIT-015)
>
> **Do NOT rely on this document as evidence of remediation.**  
> The authoritative sources of truth for active defects and remediation tasks are:  
> - [CODEBASE_AUDIT_REPORT.md](file:///C:/Users/harsh/Downloads/Project/Sanket_Pro/Sanket---One-Signal-Instant-Safety/CODEBASE_AUDIT_REPORT.md)  
> - [CODEBASE_REMEDIATION_PLAN.md](file:///C:/Users/harsh/Downloads/Project/Sanket_Pro/Sanket---One-Signal-Instant-Safety/CODEBASE_REMEDIATION_PLAN.md)  
> - [FEATURE_VERIFICATION_MATRIX.md](file:///C:/Users/harsh/Downloads/Project/Sanket_Pro/Sanket---One-Signal-Instant-Safety/FEATURE_VERIFICATION_MATRIX.md)

Living checklist of every issue found in the production-readiness audit (2026-09-24). Check the box and fill **Status** when an item is fixed.

**Legend:** `[ ]` open · `[x]` fixed · ✓ verified against source · ▸ reported by section audit with cited evidence
**Severity:** P0 critical (breaks core safety) · P1 high · P2 medium · P3 low/hygiene

**Progress:** Historical claim: 42 / 42 fixed. Current audited state: Reconciled per CODEBASE_AUDIT_REPORT.md.

---

## P0 — Critical (breaks the core safety promise)

- [x] **1. SOS fires with location (0,0) when GPS denied** ✓
  - `client/src/hooks/useGeolocation.ts:9` inits `{lat:0,lng:0}`; error cb `:23` only sets `loading=false`. `client/src/pages/Dashboard.tsx:22` guard uses `Number.isFinite(0) === true` → sends contacts a link to the Gulf of Guinea.
  - Fix: return `position: null` + `error` until a real fix; guard in Dashboard and MapView.
  - Status: FIXED — `useGeolocation` now returns `position: null` + `error` until a real fix and reports the geolocation error; `Dashboard.tsx` (guard, trigger, shake, render) and `MapView.tsx` handle null. (useGeolocation.ts, Dashboard.tsx, MapView.tsx)

- [x] **2. Shake-to-SOS dead on iOS 13+** ✓
  - `client/src/hooks/useShake.ts:25` adds the `devicemotion` listener but never calls `DeviceMotionEvent.requestPermission()` → zero motion events on iPhone.
  - Fix: request permission from the toggle user-gesture before subscribing.
  - Status: FIXED — added `requestMotionPermission()` in `useShake.ts`, called from the Shake toggle's click handler (`handleToggleShake`) in `Dashboard.tsx`; toggle only enables on grant. (useShake.ts, Dashboard.tsx)

- [x] **3. Shared rate-limit bucket can 429 the real SOS press** ✓
  - `server/middleware/rateLimit.middleware.js:1` module-scope `Map` shared across all limiters; `resetAt` set once, never refreshed → LiveKit's 5-min window can govern SOS's 60s window. Global `/api` + `authLimiter` also share `bucket[IP]`.
  - Fix: move `Map` inside the factory (private per instance).
  - Status: FIXED — `buckets` Map moved inside the factory so each limiter owns its store; also dropped the dead `x-forwarded-for` key fallback. Verified with an isolation check (map traffic no longer consumes the SOS bucket; SOS limiter still enforces its own max). (rateLimit.middleware.js)

---

## P1 — High

- [x] **4. SOS saved but no alert sent, then user locked out** ✓
  - `server/controllers/sos.controller.js` awaits `LocationHistory.create` + `User.findByIdAndUpdate` before `dispatchSOSNotifications` (:123); a throw persists the active SOS with zero alerts, and retry hits the "already active" guard.
  - Fix: dispatch immediately after `SOSEvent.create`, do ancillary writes after.
  - Status: FIXED — dispatch + address enrichment now fire right after `SOSEvent.create`; `LocationHistory.create` and `User.findByIdAndUpdate` are best-effort (`.catch`) and no longer block or gate notifications. (sos.controller.js)

- [x] **5. Gemini blocks every emergency call up to 10s** ✓
  - `server/services/twilio.service.js:137` `await generateSOSVoiceScript(...)` runs before `client.calls.create`. Static bilingual fallback already exists.
  - Fix: dial first with static TwiML; drop or pre-cache the AI wording.
  - Status: FIXED — removed the inline Gemini call + import; `makeEmergencyCall` now builds the static bilingual TwiML and dials immediately (no LLM in the call path). (twilio.service.js)

- [x] **6. `trust proxy` not set → limiter collapses all clients behind a proxy** ✓
  - `req.ip` fallback in `rateLimit.middleware.js:5` with no `app.set('trust proxy', ...)` in `server.js` → 10 combined login attempts locks out everyone.
  - Fix: `app.set('trust proxy', 1)`; remove dead `x-forwarded-for` branch.
  - Status: FIXED — `app.set('trust proxy', 1)` added in `server.js`; dead `x-forwarded-for` key fallback already removed with item 3. (server.js, rateLimit.middleware.js)

- [x] **7. `AUTH_DETACHED` bypass switch shipped in client** ✓
  - `client/src/config/authMode.ts` wired through `ProtectedRoute`, `App`, `AuthContext`, `api.ts`. One flip disables all auth.
  - Fix: delete it, or gate on `import.meta.env.DEV` so it can never ship.
  - Status: FIXED — `AUTH_DETACHED = import.meta.env.DEV && false`; production builds (`DEV===false`) force it off even if the toggle is flipped. Consumers unchanged. (authMode.ts)

- [x] **8. Location updates silently dropped if history doc missing** ▸
  - `server/controllers/tracking.controller.js:92` `findOneAndUpdate($push)` has no `{upsert:true}` and ignores result → responds `success:true` while writing nothing.
  - Fix: add `upsert:true`.
  - Status: FIXED — added `{ upsert: true }` + `$setOnInsert: { userId }` so a missing history doc is created on first update (complements item 4's best-effort create). (tracking.controller.js)

- [x] **9. Assistant mic keeps streaming after panel close** ▸
  - `client/src/components/VoiceAssistantWidget.tsx:208` `closeAssistant` stops recognition but never stops the LiveKit mic track / disconnects the room (only unmount does).
  - Fix: tear down track + room in `closeAssistant`.
  - Status: FIXED — `closeAssistant` now stops the mic track, disconnects the room, nulls both refs, and resets LiveKit status. (VoiceAssistantWidget.tsx)

- [x] **10. JWT in `localStorage`** ✓
  - `client/src/context/AuthContext.tsx:40` — any XSS exfiltrates it → full SOS/location/contact access.
  - Fix: add strict CSP at minimum; ideally move to an HttpOnly cookie.
  - Status: FIXED — JWT moved out of `localStorage` into an HttpOnly, SameSite=Lax cookie (`secure` in prod). Server: `utils/authCookie.js` (set/clear/parse helpers, no cookie-parser dep); `auth.controller` sets the cookie on login/register and no longer returns the token in the body; added `POST /auth/logout` to clear it; `auth.middleware` reads the cookie first (Bearer fallback kept for API clients); `locationSocket` reads it from the handshake; `server.js` Socket.IO CORS gets `credentials: true`. Client: `api.ts` uses `withCredentials: true`, dropped the localStorage request interceptor, and excludes `/auth/profile|logout` from the 401 redirect; `AuthContext` always probes `/auth/profile` on mount (HttpOnly cookie is unreadable by JS) and logout POSTs `/auth/logout`; `SOSContext` gates on `user` and hands the socket `withCredentials: true` instead of `auth: { token }`. XSS can no longer read the JWT. Same-origin deploy makes SameSite=Lax correct; switch to SameSite=None+Secure only if the API moves to a different origin. (authCookie.js, auth.controller.js, auth.routes.js, auth.middleware.js, locationSocket.js, server.js, api.ts, AuthContext.tsx, SOSContext.tsx)

---

## P2 — Medium

- [x] **11. Alerts say "Unknown location" despite valid GPS** ✓ — `sos.controller.js:123/127`: `enrichSOSAddress` races `dispatch`; reverse-geocoded address lands after the alert sent. Fix: await enrich (bounded) before dispatch, or geocode client-side.
  - Status: FIXED — kept dispatch immediate (item 4) and instead made the WhatsApp alert self-sufficient: location line falls back to `lat, lng` (never "Unknown") and always includes an actionable Google Maps link, so a still-pending reverse-geocode no longer degrades the alert. (whatsapp.service.js)

- [x] **12. Bad `triggerType` → 500, no SOS** ✓ — `sos.controller.js:100` passes client value into `enum:['tap','shake']`. Fix: coerce/validate to a known value.
  - Status: FIXED — `triggerType: triggerType === 'shake' ? 'shake' : 'tap'` — any non-`shake` value (garbage/undefined) coerces to `tap`, never violates the enum. (sos.controller.js)

- [x] **13. Redundant Gemini call per contact** ✓ — `sosNotification.service.js`: N contacts = N identical LLM requests (429 risk). Fix: generate script once, reuse.
  - Status: FIXED — resolved by item 5: the per-contact Gemini call was removed from `makeEmergencyCall` entirely, so N contacts no longer trigger N LLM requests. (twilio.service.js)

- [x] **14. Active SOS ignores `trackingExpiresAt`** ▸ — `tracking.controller.js:6` `isTrackingExpired` skips the check while `status==='active'` → indefinite public exposure of name + live GPS. Fix: honor expiry regardless of status.
  - Status: FIXED — `isTrackingExpired` now honors `trackingExpiresAt` for both active and resolved events (24h cap stops exposing name + live GPS even if the SOS is never resolved); legacy docs without an expiry keep the old active-only behavior. (tracking.controller.js)

- [x] **15. 500 handler echoes `err.message` to client** ✓ — `error.middleware.js:32`. Fix: return generic message for status ≥ 500, log real error + stack server-side.
  - Status: FIXED — logs `err.stack || err.message` server-side; client gets generic `Internal Server Error` for status ≥ 500, explicit message only for 4xx. (error.middleware.js)

- [x] **16. Contacts fetch swallows errors** ✓ — `Contacts.tsx` / `Dashboard.tsx:25` shows "No contacts, SOS disabled" on a network blip. Fix: distinguish error from empty; surface retry.
  - Status: FIXED — both fetches now `toast.error('Could not load contacts.')` on failure instead of silently swallowing, so a network blip is visible rather than masquerading as "no contacts". (Dashboard.tsx, Contacts.tsx)

- [x] **17. Unbounded coordinate array in one `LocationHistory` doc** ▸ — 16MB BSON cap on a long SOS. Fix: cap/rotate trail or use a capped/time-series collection.
  - Status: FIXED — `$push` now uses `$slice: -1000` to keep only the most recent 1000 points, bounding the doc well under the 16MB BSON cap. (tracking.controller.js)

- [x] **18. One malformed Places result wipes a safe-zone category** ▸ — `maps.service.js`. Fix: guard per-result, skip bad entries.
  - Status: FIXED — `getNearbyPlaces` filters each result on `Number.isFinite(place?.geometry?.location?.lat/lng)` before mapping, so one bad entry is skipped instead of throwing out the category. (maps.service.js)

- [x] **19. No timeout on Maps calls (can hang SOS path)** ▸ — `maps.service.js`. Fix: add axios timeout + fallback.
  - Status: FIXED — `getNearbyPlaces` (5s) and `reverseGeocode` (3s) now pass an axios `timeout`, so a hung Maps call can't stall the request. (maps.service.js)

- [x] **20. ~4s safe-zones latency from pagination sleeps** ▸ — `maps.service.js`. Fix: parallelize/limit pages or drop mandatory sleep.
  - Status: FIXED — removed the `sleep` helper and the multi-page next-page-token loop; `getNearbyPlaces` now does a single-page fetch (no mandatory 2s×N sleeps). (maps.service.js)

- [x] **21. Phone numbers have no format validation** ✓ — `contact.controller.js` / `EmergencyContact` model save garbage → alert silently dropped at SOS time. Fix: validate/normalize to E.164 on save.
  - Status: FIXED — added a Mongoose `validate` on `phone` (10–15 digits, optional country code) at the model level, so both add and update reject garbage with a 400 (via the ValidationError branch) before it can silently drop an alert. (EmergencyContact.js)

- [x] **22. `/sos/active` not hydrated after fresh login** ✓ — `SOSContext.tsx:22` effect runs once at mount with empty deps → socket stays null without a reload. Fix: re-run on token change; reset on logout.
  - Status: FIXED — effect now keys on `user` from `useAuth()`: reconnects the socket + re-fetches the active SOS on login, and clears `activeSOS`/socket on logout so no stale session leaks across users. (SOSContext.tsx)

- [x] **23. Live-tracking interval has no error cb/timeout** ✓ — `Dashboard.tsx:31` `getCurrentPosition` success-only → trail freezes silently mid-emergency. Fix: add error + timeout handling.
  - Status: FIXED — the 5s live-location `getCurrentPosition` now passes an error callback (logs the failure) plus `{ enableHighAccuracy, timeout: 10000, maximumAge: 5000 }` options. (Dashboard.tsx)

- [x] **24. `GEMINI_MODEL` defaults to a `-preview` model** ✓ — `gemini.service.js:31/75`. Fix: default to a stable GA model.
  - Status: FIXED — both defaults are now the GA `gemini-2.0-flash` (still overridable via `GEMINI_MODEL`). Only affects the safety-chat path; no LLM is in the SOS critical path. (gemini.service.js)

- [x] **25. No `engines` / Node version pin** ✓ — `package.json`. Fix: add `engines.node`.
  - Status: FIXED — added `"engines": { "node": ">=18" }` to the server `package.json`. (server/package.json)

- [x] **26. No test/lint scripts** ✓ — `package.json`. Fix: add lint + a minimal test script.
  - Status: FIXED — both packages now have `lint` + `test` scripts wired and green. Server: zero-dep `node --test` runner with a real suite (`server/test/authCookie.test.js` covers the hand-rolled cookie parser's edge cases + the auth-cookie HttpOnly/SameSite options) and ESLint 9 flat config (`eslint .`, recommended rules, 0 problems). Client: Vitest (`vitest run`) with a real unit test (`src/utils/savedAccounts.test.ts` for the `initials` helper) and ESLint 9 flat config (`eslint src`) with typescript-eslint + rules-of-hooks (error) / exhaustive-deps (warn); stylistic + advisory findings are warnings so the first lint of a previously-unlinted codebase exits 0 (15 warnings surfaced, 0 errors). Verified: `npm test`/`npm run lint` pass in both, client `tsc --noEmit` still clean. (server/package.json, server/eslint.config.js, server/test/authCookie.test.js, client/package.json, client/eslint.config.js, client/src/utils/savedAccounts.test.ts)

- [x] **27. `VITE_GOOGLE_MAPS_API_KEY` missing from `client/.env.example`** ✓ — deploy-from-example = blank tracking map. Fix: add the key to the example.
  - Status: FIXED — added `VITE_GOOGLE_MAPS_API_KEY=` (with a comment) to `client/.env.example`; matches the key read in `MapView.tsx`/`TrackingPage.tsx`. (client/.env.example)

- [x] **28. `useScrollAnimation` cleanup kills ALL ScrollTriggers globally** ▸ — `useScrollAnimation.ts:53` → unrelated landing sections blank on route change. Fix: kill only this hook's triggers.
  - Status: FIXED — captures the tween and cleans up with `tween.scrollTrigger?.kill(); tween.kill();` instead of `ScrollTrigger.getAll().kill()`, so unmounting one component no longer nukes every other section's animation. (useScrollAnimation.ts)

- [x] **29. SOS button state not announced to screen readers** ▸ — `SOSButton.tsx` no `aria-live`. Fix: add `aria-live`/role for state changes.
  - Status: FIXED — added a visually-hidden `role="status" aria-live="assertive"` region that announces triggering/active/safe state transitions. (SOSButton.tsx)

- [x] **30. Rate-limiter `buckets` Map never pruned (memory leak)** ✓ — `rateLimit.middleware.js:18` no TTL sweep; IP-keyed global limiter grows unbounded. Fix: add an `.unref()` sweep once each instance owns its Map (item 3).
  - Status: FIXED — each limiter instance runs a `setInterval` sweep (on its own `windowMs`) that deletes expired buckets; `.unref()`'d so it never keeps the process alive. (rateLimit.middleware.js)

---

## P3 — Low / hygiene

- [x] **31. Committed scratch scripts that shouldn't ship** ✓ — `check-db.js` (dumps DB), `test-trigger-sos.js` (can fire REAL alerts), `scratch_test-api.js`, `test-whatsapp.js`, `test-actual-whatsapp.js`. Fix: remove or move out of the deployable tree.
  - Status: FIXED — all 5 deleted (user-approved). None were referenced by the app; `test-trigger-sos.js`/`check-db.js` connected to the real DB and could dispatch real alerts, so they were the highest ship-risk. (server/)

- [x] **32. LiveKit token trusts client `roomName`** ▸ — `livekit.controller.js:17` not bound to `req.user._id` → join another user's room. Fix: derive room from the authenticated user.
  - Status: FIXED — room is now derived as `sanket-assistant-${req.user._id}`; the client-supplied `roomName` is ignored, so no user can request/join another user's room. (livekit.controller.js)

- [x] **33. Phone numbers + victim voice script logged to stdout** ✓ — `twilio.service.js:139/160`, `whatsapp.service.js:69`. Fix: redact PII from logs.
  - Status: FIXED — WhatsApp logs now only the message SID (phone removed); the Twilio voice-script log line was removed entirely with item 5. (whatsapp.service.js, twilio.service.js)

- [x] **34. Login timing enables email enumeration** ✓ — `auth.controller.js:86` fast path for unknown email. Fix: dummy bcrypt compare on the not-found path (also make register response generic).
  - Status: FIXED (login path) — the not-found branch now runs `bcrypt.compare` against a cost-12 `DUMMY_HASH` so its timing matches the wrong-password path. Register still returns "Email already registered" (kept for UX; register-side enumeration is a common accepted trade-off) — revisit if strict anti-enumeration is required. (auth.controller.js)

- [x] **35. HSTS header missing** ✓ — `securityHeaders.middleware.js`. Fix: add `Strict-Transport-Security` (effective over HTTPS).
  - Status: FIXED — added `Strict-Transport-Security: max-age=31536000; includeSubDomains` to the API security headers. (securityHeaders.middleware.js)

- [x] **36. `[object Object]` in voice-script log** ✓ — `twilio.service.js:139`. Fix: `JSON.stringify` the structured script.
  - Status: FIXED — resolved by item 5: the log line (and the whole Gemini branch that produced `[object Object]`) was removed. (twilio.service.js)

- [x] **37. MapView `0,0` truthiness breaks on prime meridian/equator** ▸ — `MapView.tsx:72`. Fix: explicit `null`/finite checks, not truthiness.
  - Status: FIXED — `hasUserLocation` now uses `position !== null && Number.isFinite(...)` instead of `Boolean(position.lat && position.lng)` (fixed alongside item 1). (MapView.tsx)

- [x] **38. WebGL contexts leaked** ▸ — `DarkVeil.tsx` / `MagicRings.tsx` don't dispose → eventual black screen. Fix: dispose renderer/context on unmount.
  - Status: FIXED — `DarkVeil` now calls `WEBGL_lose_context.loseContext()` on cleanup; `MagicRings` (already disposed renderer+material) now also disposes the geometry and calls `renderer.forceContextLoss()`, so remounts don't exhaust the browser's ~16-context limit. (DarkVeil.tsx, MagicRings.tsx)

- [x] **39. Client trail array unbounded** ▸ — `TrackingPage.tsx`. Fix: cap points rendered.
  - Status: FIXED — the socket `location-updated` handler now caps `trail` with `.slice(-1000)` (matches the server-side `$slice`). (TrackingPage.tsx)

- [x] **40. Dead socket `location-update` handler** ▸ — unused listener. Fix: remove or wire it.
  - Status: FIXED — removed the never-emitted `location-update` socket handler (live updates flow through the authenticated HTTP `POST /tracking/update-location`, which persists + broadcasts) and the now-unused `parseCoordinate` helper. (locationSocket.js)

- [x] **41. Public tracking endpoint has no rate limit** ✓ — `tracking.routes.js`. Fix: add a limiter to the public GET.
  - Status: FIXED — public `GET /tracking/:trackingId` now runs `rateLimit({ windowMs: 60s, max: 60 })` per IP so the unauthenticated endpoint can't be scraped/hammered. (tracking.routes.js)

- [x] **42. Context values not memoized + `@gsap/react` unused dep** ▸✓ — re-render churn; dead dependency. Fix: `useMemo` provider values; drop unused dep.
  - Status: FIXED — `AuthContext` (functions `useCallback`'d, value `useMemo`'d) and `SOSContext` (value `useMemo`'d) no longer hand a fresh object to every consumer each render; removed the unused `@gsap/react` dependency from `client/package.json`. (AuthContext.tsx, SOSContext.tsx, client/package.json)

---

_When an item is fixed: change `[ ]` → `[x]`, replace `Status: _open_` with `Status: FIXED — <what changed> (<file>)`, and update the **Progress** counters at the top._

