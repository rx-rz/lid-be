# Endpoint Testing Guide

## Seed the database

Run migrations first, then seed stable test users:

```sh
bun run db:migrate
bun run db:seed:reset
```

Useful variants:

```sh
bun run db:seed
bun run db:seed:small
bun src/db/seeder.ts --count 75 --seed 12345 --reset
```

The scenario users are always available after seeding:

```txt
seed_amina   premium
seed_kwame   first-class
seed_zara    economy
seed_chidi   weekender
seed_nala    premium
seed_tomi    economy
```

Generated users are named `seed_generated_001`, `seed_generated_002`, and so on.

## Run endpoint checks manually

Start the app:

```sh
bun run dev
```

Use `docs/api-test-payloads.json` as the request catalog. Each object has a `method`, `path`, and optional `body`. For example:

```sh
curl -sS http://localhost:8000/api/v1/user/seed_amina
```

```sh
curl -sS -X POST http://localhost:8000/api/v1/likes \
  -H "content-type: application/json" \
  -d '{"likerId":"seed_amina","likedId":"seed_generated_001","superLike":true}'
```

```sh
curl -sS "http://localhost:8000/api/v1/users?userId=seed_amina&radius=[0,150]&age=[22,40]&minPhotos=2"
```

## What to test

1. Happy paths: create/update/get for users, profiles, preferences, locations, images, likes, favorites, reports, support, payments, stream, and roulette.
2. Validation: remove required fields from request bodies and confirm the API returns a normalized `VALIDATION_ERROR`.
3. Conflicts: repeat likes, blocks, favorites, and profile creation calls to confirm duplicate handling.
4. Entitlements: call super-like, boost, rewind, and stream call endpoints with economy and premium seed users.
5. Discovery: compare `/users` results for different `radius`, `age`, `gender`, and `minPhotos` query values.
6. Safety flows: block a user, then re-run discovery and interaction paths involving the same pair.

## Automated checks

The repo already has a contract suite:

```sh
bun test
```

Add new tests there when an endpoint response shape must not change. Keep database-backed smoke checks separate from the mocked contract tests unless you intentionally want them to require Postgres.
