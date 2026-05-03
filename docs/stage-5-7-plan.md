# Stage 5, 6, And 7 Execution Plan

## Summary
Stages 5 through 7 complete the monetization work: Stripe plans and add-on checkout, entitlement usage enforcement, and scheduled allowance resets/expiry. Existing endpoint responses remain stable unless a route is newly introduced for add-on checkout.

## Stage 5: Payments And Add-ons
- Update Stripe plan sync to match the product-plan image:
  - Economy: free.
  - Premium Economy: `$14.99/month`.
  - First Class: `$24.99/month`.
  - Weekender: `$9.99/week`.
- Keep public tier values unchanged:
  - `economy`
  - `premium`
  - `first-class`
  - `weekender`
- Add backend add-on product definitions:
  - Recall: 5 for `$1.99`, 15 for `$4.99`, 30 for `$7.99`.
  - Super Likes: 5 for `$4.99`, 15 for `$12.99`, 30 for `$21.99`.
  - Takeoff: 1 for `$3.99`, 5 for `$16.99`, 10 for `$29.99`.
  - Love Letters: 3 for `$4.99`, 10 for `$12.99`, 25 for `$24.99`.
  - Cruise: 10 calls for `$5.99`, 30 calls for `$14.99`, unlimited Cruise Pass for `$17.99/month`.
- Add new add-on endpoints without changing existing payment endpoints:
  - `GET /addons` returns available add-on packs.
  - `POST /addons/checkout` creates a Stripe checkout session for a selected pack.
- Preserve current payment response shapes:
  - `/plans` keeps the current plan object shape.
  - `/subscription` keeps `{ subscriptionId, clientSecret }`.
  - `/status/:userId` keeps `{ subscriptionType, paymentStatus, nextBillingDate }`.
  - `/customer/:userId` keeps `{ customerId }`.
  - `/customer` keeps `{ customerId, isNew }`.
- Harden Stripe webhooks:
  - Verify signatures exactly as today.
  - Add idempotency by Stripe event id.
  - Handle subscription create/update/delete, invoice success/failure, add-on checkout completion, and Stripe retries.
  - Log structured webhook events without logging raw bodies, secrets, signatures, or client secrets.

## Stage 6: Usage Enforcement
- Add a shared entitlement-consumption service used by interactions, boosts, stream/cruise calls, and future love-letter routes.
- Consumption order:
  - Use subscription allowance first.
  - Then use paid add-on balance.
  - Fail only when both are unavailable.
- Make all decrement operations atomic at the repository/database layer to prevent double-spend under concurrent requests.
- Enforce plan behavior:
  - Economy swipes: 25/day.
  - Premium, First Class, Weekender swipes: unlimited.
  - Super Likes: Premium 5/week, First Class and Weekender 10/week.
  - Takeoff: Premium 1/week, First Class and Weekender 3/week.
  - Love Letters: First Class and Weekender 3/week; unavailable for Economy/Premium unless paid add-on or future policy permits.
  - Recall: unavailable for Economy unless add-on; unlimited for paid subscription tiers.
  - Cruise: Economy 2 calls total, Premium 8/month, First Class/Weekender unlimited, Cruise Pass applies only to Cruise.
- Preserve existing route response contracts:
  - Like/dislike success payloads stay unchanged.
  - Existing insufficient-balance errors keep current status/body where already defined.
  - New usage failures use `402` with `{ error }`.
- Gate discovery and visibility internally:
  - Paid-only filters are downgraded or ignored internally for lower tiers.
  - `/users` still returns `{ users, nextCursor }`.
  - My Likes cap limits visible history, not the number of actual likes sent.
- Add structured logging for every usage event:
  - `userId`
  - feature consumed
  - source consumed from subscription/add-on/unlimited
  - remaining computed balance when applicable
  - failure reason when denied

## Stage 7: Scheduled Resets, Expiry, And Downgrades
- Replace top-up/no-rollover ambiguity with explicit reset behavior:
  - Weekly allowances reset every 7 days with no rollover.
  - Weekender resets weekly.
  - Premium cruise allowance resets monthly.
  - Paid add-ons persist unless a future expiry/refund policy says otherwise.
- Add reset metadata to entitlement storage:
  - Last reset timestamp per cadence or feature group.
  - Next reset timestamp where useful for internal jobs.
- Make scheduled jobs idempotent:
  - Running the same job twice in the same reset window must not double-credit.
  - Failed partial runs should be safe to retry.
- Subscription downgrade/cancel behavior:
  - Set user tier back to Economy.
  - Remove subscription allowances.
  - Preserve paid add-on balances by default.
  - Stop future subscription resets.
- Cruise Pass behavior:
  - Cruise Pass affects Cruise calls only.
  - It does not grant love letters, takeoff, recalls, super likes, or tier upgrades.
  - Expiry/cancel removes only pass-based unlimited Cruise access.
- Boost expiry cleanup remains, but continues using structured logs and cache invalidation.

## Implementation Order
1. Update Stripe plan and add-on definitions.
2. Add add-on listing and checkout-session endpoints.
3. Add Stripe webhook idempotency storage.
4. Wire checkout completion to paid add-on balances.
5. Add atomic entitlement-consumption repository methods.
6. Wire consumption into likes/super likes, recalls, boosts, stream/cruise calls, and love letters when route support exists.
7. Add reset metadata and scheduled reset jobs.
8. Wire subscription downgrade/cancel cleanup.
9. Run full contract, payment, entitlement, and reset tests.

## Assumptions
- Existing subscription payment flow remains Stripe subscription based.
- Add-ons use Stripe Checkout sessions.
- Paid add-ons remain available after subscription downgrade unless refund/admin policy changes.
- Love-letter enforcement should be implemented where backend route support exists; if no route exists yet, prepare the entitlement service and defer route wiring.
