# Backend Cleanse Test Plan

## Summary
This test plan protects the frontend contract while the backend is cleaned up, rate-limited, and monetized. Tests should favor mocked external services and deterministic DB fixtures over real Stripe, Redis, FCM, Stream, Clerk, or network calls.

## Contract Tests
- Keep existing response shapes stable for:
  - `GET /users` returning `{ users, nextCursor }`.
  - `POST /likes` success returning the current like/match shape.
  - `POST /dislikes` success returning the current dislike shape.
  - Swipe-limit failures returning `{ error: "Swipe limit reached", resetTime }`.
  - Payment status/customer/subscription routes returning their current shapes.
  - Preference create/update/get routes returning their current shapes.
  - Boost and roulette route success/error patterns.
- Add contract tests before behavior changes when touching any existing endpoint.
- New endpoints may define new response shapes, but must have explicit tests from day one.

## Logging Tests
- Assert request logging middleware:
  - Propagates incoming `x-request-id`.
  - Generates `x-request-id` when missing.
  - Does not add request metadata to JSON response bodies.
- Assert redaction behavior for:
  - Authorization headers.
  - Cookies.
  - Stripe signatures.
  - FCM tokens.
  - Stream tokens.
  - Client secrets.
- Verify target runtime files no longer use `console.*`, excluding migration/seeder/sync scripts.

## Rate-Limit Tests
- Unit-test rate-limit config:
  - Preset names and values.
  - Key generation from user id.
  - Fallback key generation from IP.
  - No secrets or raw signatures in keys.
- Route tests:
  - Discovery route returns 429 when transport limiter blocks.
  - Interaction routes return 429 when transport limiter blocks.
  - Payment checkout routes return 429 when transport limiter blocks.
  - Stripe webhook allows expected retry volume.
- Regression test:
  - Swipe-limit 429 remains distinct from transport-level 429.

## Entitlement Tests
- Tier config tests:
  - Economy has 25 swipes/day, basic filters, 2 total Cruise calls, ads on.
  - Premium has unlimited swipes, advanced filters, 5 super likes/week, 1 takeoff/week, 8 Cruise calls/month, last 20 My Likes, ads off.
  - First Class has all filters including Crew, 10 super likes/week, 3 takeoff/week, 3 love letters/week, unlimited My Likes/Cruise, ads off.
  - Weekender matches First Class access but follows weekly/no-rollover behavior.
- Consumption tests:
  - Subscription allowance is consumed before paid add-on balance.
  - Paid add-on balance is consumed after subscription allowance reaches zero.
  - Zero balance returns the expected existing error style or new `402 { error }`.
  - Unlimited entitlements do not decrement counters.
  - Atomic decrement prevents double-spend under concurrent calls.

## Payment And Webhook Tests
- Stripe plan sync tests:
  - Creates/returns the four subscription plans with image-accurate prices.
  - Preserves existing `/plans` response shape.
- Add-on checkout tests:
  - `GET /addons` returns all configured packs.
  - `POST /addons/checkout` rejects unknown packs.
  - `POST /addons/checkout` creates a checkout session with user id, pack type, and quantity metadata.
- Webhook tests:
  - Missing Stripe signature returns existing 400 string.
  - Invalid signature returns existing webhook error string.
  - Subscription success activates tier and credits subscription allowances.
  - Subscription update syncs tier/payment status.
  - Subscription delete downgrades to Economy.
  - Add-on checkout completion credits paid add-on balance.
  - Duplicate Stripe event id is ignored safely.

## Usage Enforcement Tests
- Interaction:
  - Economy hits 25 daily swipes then receives swipe-limit response.
  - Paid tiers have unlimited swipes.
  - Super Like decrements the right balance source.
- Recall:
  - Economy without add-on fails.
  - Paid/unlimited recall succeeds without decrement.
  - Add-on recall decrements paid balance.
- Takeoff:
  - Boost consumes weekly allowance then add-on balance.
  - Expired boost cleanup disables visibility and invalidates cache.
- Cruise/Stream:
  - Economy consumes 2 total calls then fails.
  - Premium consumes 8 monthly calls.
  - First Class/Weekender/Cruise Pass do not decrement normal call counters.
- Discovery:
  - Lower-tier advanced filters are ignored or downgraded internally.
  - `/users` response shape remains `{ users, nextCursor }`.

## Reset And Expiry Tests
- Weekly reset:
  - Resets weekly allowances to plan values.
  - Does not roll over unused subscription allowances.
  - Is idempotent within the same reset window.
- Monthly reset:
  - Resets Premium Cruise calls monthly.
  - Does not affect paid add-ons.
- Downgrade/cancel:
  - Removes subscription allowance.
  - Preserves paid add-on balance.
  - Stops future subscription resets.
- Cruise Pass:
  - Grants Cruise-only unlimited access while active.
  - Expiry removes only pass access.

## Verification Commands
- Run contract tests: `bun test`.
- Run typecheck: `bunx tsc --noEmit`.
- Confirm no accidental migrations unless the stage intentionally adds one: `git status --short migrations`.
- Confirm runtime console cleanup: `rg --line-number "console\\." src`.
