# API Repair Design

Date: 2026-07-06

## Goal

Stabilize the current Sanket website API flow by fixing the user-visible failures first, then hardening provider integrations and map behavior.

## Repair Order

1. Fix login credential failures by normalizing email input before database lookup and adding safer JWT configuration handling.
2. Improve SOS trigger responsiveness by removing blocking provider calls from the critical response path.
3. Consolidate WhatsApp delivery around Twilio and remove old WhatsApp Business API confusion from code/docs.
4. Fix map/location bugs and document the required browser map key.
5. Namespace rate-limit buckets so unrelated API routes do not throttle each other.
6. Plan map-provider migration separately, with MapTiler/MapLibre as the preferred rendering replacement.

## First Implementation

The first change is intentionally narrow: update the auth controller so login and registration use a shared email normalizer. This prevents stored lowercase emails from failing when the login form sends uppercase or whitespace-padded values.

