# SOS Trigger Latency Design

## Goal

Make the SOS button respond immediately when tapped, while keeping the backend as the source of truth for whether an SOS was actually created and notifications were queued.

## Chosen Approach

Use optimistic UI on the dashboard:

- The button enters a pending emergency state as soon as the user taps it.
- The frontend calls `/api/sos/trigger` immediately instead of waiting on contact-list UI state.
- The backend still validates contacts, active SOS state, coordinates, and authentication.
- If the backend succeeds, the real SOS response replaces the pending state.
- If the backend fails, the UI rolls back and shows the error.

## Why This Approach

The backend already avoids blocking on reverse geocoding and notification delivery. The remaining user-visible delay is mostly frontend feedback timing. Optimistic UI gives immediate confirmation without weakening backend safety checks.

## Error Handling

The pending state is local only. It does not expose a tracking link or mark a real SOS active until the server returns the real event. Duplicate taps are disabled while pending.

## Verification

Run the client build after implementation and check that the backend SOS controller still passes syntax checks.
