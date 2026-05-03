# Stage 3 And 4 Execution Plan

## Summary
Stage 3 adds route-aware rate limiting without changing successful response bodies. Stage 4 introduces a proper entitlement model based on the product-plan image, while keeping existing public tier names and preserving current endpoint response shapes.

## Stage 3: Rate Limiting
- Centralize all rate-limit presets in a new rate-limit config module, reusing the existing `RedisRateLimitContext`.
- Keep the current user-route rate limiter behavior compatible, then expand coverage by route category:
  - General authenticated routes: moderate per-user/per-IP limit.
  - Discovery `/users`: stricter per-user limit because it is expensive.
  - Interaction routes `/likes`, `/dislikes`, `/dislikes/rewind`: strict per-user action limits.
  - Boost and future entitlement-consumption routes: strict per-user limits.
  - Payment routes `/subscription`, `/customer`, future add-on checkout routes: strict per-user and per-IP limits.
  - Stripe webhook `/webhook`: high retry-friendly limit keyed by IP/signature-safe request metadata.
  - Public/help routes: spam-protection limits.
- Add stable key-generation helpers:
  - Prefer authenticated user id when available.
  - Fall back to request IP.
  - Avoid using raw auth headers, Stripe signatures, or body data in keys.
- Preserve existing response contracts:
  - Existing swipe-limit 429 remains `{ error: "Swipe limit reached", resetTime }`.
  - Transport-level rate limits should return the existing plugin/string response where already used, or `{ error: "Too many requests. Please slow down." }` for newly protected routes.
- Add tests for:
  - Rate-limit config shape and key generation.
  - Interaction/discovery/payment routes returning 429 when the limiter blocks.
  - Existing swipe-limit 429 remaining separate from transport rate limiting.

## Stage 4: Entitlement Model
- Treat the product-plan image as source of truth and replace mismatched hardcoded permission values.
- Keep public tier enum values unchanged:
  - `economy`
  - `premium`
  - `first-class`
  - `weekender`
- Create a single entitlement config that expresses:
  - Economy: 25 swipes/day, basic filters only, interests yes, basic visibility, verified profiles, chat/video with matches, 2 cruise calls total, ads on.
  - Premium Economy: unlimited swipes, advanced filters, full status, recall unlimited, profile view, last 20 sent likes, priority aisle, 5 super likes/week, 1 takeoff/week, 8 cruise calls/month, ads off.
  - First Class: unlimited swipes, all filters including Crew, unlimited recall/profile view/my likes/cruise, 10 super likes/week, 3 takeoff/week, 3 love letters/week, ads off.
  - Weekender: First-Class-style access for the weekly plan, no rollover, no monthly credits, ads off.
- Separate subscription allowances from paid add-on balances:
  - Subscription allowance resets by plan cadence.
  - Paid add-ons are additive and consumed only after subscription allowance.
  - Existing exposed wallet fields should remain shape-compatible by returning computed totals where currently returned.
- Update usage checks to call a shared entitlement service instead of reading raw tier constants directly.
- Preserve current endpoint response shapes:
  - Like/dislike success payloads stay unchanged.
  - Users discovery still returns `{ users, nextCursor }`.
  - Payment status still returns `{ subscriptionType, paymentStatus, nextBillingDate }`.
  - Existing wallet-style responses keep their current field names.
- Gate behavior internally:
  - Economy swipes cap at 25/day.
  - Advanced filters are ignored or downgraded internally for tiers that do not have access, without changing `/users` response shape.
  - My Likes visibility is capped to last 20 for Premium and unlimited for First Class/Weekender.
  - Recalls, super likes, takeoff boosts, love letters, and cruise calls consume allowance atomically.
- Add tests for:
  - Entitlement values for every tier.
  - Economy swipe limit of 25/day.
  - Premium last-20 my-likes cap.
  - First Class/Weekender unlimited behavior.
  - Subscription-first then add-on consumption.
  - Zero-balance failures returning existing error styles.

## Implementation Order
1. Add rate-limit config and key helpers.
2. Apply rate limits route group by route group, starting with low-risk payment/public routes, then discovery and interactions.
3. Add entitlement config and tests.
4. Introduce entitlement service with read-only resolution first.
5. Swap existing direct `TIER_PERMISSIONS` callers to the service.
6. Add allowance/add-on consumption primitives with atomic DB operations.
7. Wire behavior gates into interactions, discovery filters, boosts, recalls, and stream/cruise calls.

## Assumptions
- Stages 3 and 4 do not create new Stripe checkout endpoints yet; those belong to Stage 5.
- Any migration needed for separating subscription allowances from add-ons should be introduced in Stage 4 only after the entitlement config tests are passing.
- Existing frontend flows remain the compatibility boundary: new internals are allowed, but existing endpoint response bodies should not change unless a route is newly added.
