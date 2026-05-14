# Frontend Handoff: Auth-Owned Backend Routes

## What changed

All user-owned backend actions now derive the actor from the Clerk session token. During the transition, existing `userId`-style request fields and path params are still accepted for compatibility, but the backend ignores them when deciding who is acting.

Frontend requests to user-owned routes must include a valid Clerk session token, usually as:

```http
Authorization: Bearer <clerk-session-token>
```

Public routes that remain unchanged:

- `GET /api/v1/plans`
- `GET /api/v1/addons`
- `POST /api/v1/webhook` for Stripe, verified by Stripe signature
- `POST /api/v1/stream/*-webhook` for Stream, verified by Stream signature

## Actor fields now ignored

These fields may still be sent, but no longer control ownership:

- `userId`
- `clerkId`
- `likerId`
- `dislikerId`
- `viewerId`
- `blockerId`
- `reporterId`

Frontend should remove those actor fields over time. Keep target fields, such as `likedId`, `dislikedId`, `viewedId`, `blockedId`, `reportedId`, `favoriteUserId`, `priceId`, `packId`, `callId`, and `type`.

## Updated examples

### Stream token

```http
POST /api/v1/stream/token
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "legacy-value-ignored",
  "name": "Amina",
  "image": "https://cdn.example/avatar.jpg",
  "email": "amina@example.com"
}
```

```json
{
  "token": "stream-user-token",
  "userId": "clerk_user_id_from_session",
  "apiKey": "stream-api-key"
}
```

### Stream conversations

```http
GET /api/v1/stream/conversations/legacy-value-ignored?limit=20
Authorization: Bearer <token>
```

Returns conversations for the Clerk-authenticated user only.

### Stream call

```http
POST /api/v1/stream/call
Authorization: Bearer <token>
Content-Type: application/json

{
  "callId": "call_123",
  "type": "default",
  "userId": "legacy-value-ignored"
}
```

The backend consumes Cruise call allowance for the Clerk-authenticated user.

### Like without match

```json
{
  "like": {
    "likerId": "clerk_user_id_from_session",
    "likedId": "target_user_id",
    "superLike": false,
    "isLoveLetter": false
  },
  "matched": false
}
```

### Like with match

```json
{
  "like": {
    "likerId": "clerk_user_id_from_session",
    "likedId": "target_user_id",
    "superLike": false,
    "isLoveLetter": false
  },
  "matched": true,
  "match": {
    "id": "match_id",
    "user1Id": "clerk_user_id_from_session",
    "user2Id": "target_user_id"
  },
  "matchedUser": {
    "id": "target_user_id",
    "displayName": "Target User",
    "name": "Target User",
    "image": "https://cdn.example/target.jpg"
  }
}
```

### Paid feature blocked

```json
{
  "status": "fail",
  "message": "You are out of Super Likes. Please upgrade or buy more.",
  "code": "INSUFFICIENT_SUPERLIKES",
  "details": [
    {
      "message": "Super Like allowance has been exhausted.",
      "feature": "superlikes",
      "reason": "allowance_exhausted",
      "requiredPlan": "premium"
    }
  ],
  "requestId": "optional-request-id"
}
```

### Payments

These now operate on the Clerk-authenticated user:

- `POST /api/v1/subscription`
- `POST /api/v1/addons/checkout`
- `GET /api/v1/status/:userId`
- `GET /api/v1/customer/:userId`
- `POST /api/v1/customer`

Existing `userId` fields or path params are ignored for ownership during compatibility mode.
