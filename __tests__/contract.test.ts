import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://user:password@localhost:5432/test";
process.env.STRIPE_SECRET_KEY = "sk_test_contract";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_contract";
process.env.STREAM_API_KEY = "stream_key";
process.env.STREAM_API_SECRET = "stream_secret";
process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
process.env.UPSTASH_REDIS_REST_TOKEN = "redis_token";

mock.module("elysia-clerk", () => ({
  clerkPlugin: () => new Elysia({ name: "mock.clerk" }),
  clerkClient: {
    users: {
      deleteUser: mock(async () => undefined),
    },
  },
}));

mock.module("elysia-rate-limit", () => ({
  rateLimit: (options: any = {}) => {
    const counters = new Map<string, number>();

    return new Elysia({ name: `mock.rate-limit.${Math.random()}` }).onBeforeHandle(
      async ({ request, set }: any) => {
        const key = options.generator
          ? await options.generator(request, null, {})
          : "ip:test";
        const count = (counters.get(key) || 0) + 1;
        counters.set(key, count);

        if (options.max && count > options.max) {
          set.status = 429;
          return options.errorResponse || "rate-limit reached";
        }
      },
    );
  },
}));

mock.module("firebase-admin", () => ({
  default: {
    apps: [{}],
    initializeApp: mock(),
    credential: {
      cert: mock((value) => value),
    },
    messaging: () => ({
      send: mock(async () => "message-id"),
    }),
  },
}));

mock.module("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      incr: mock(async () => 1),
      pexpire: mock(async () => 1),
      pttl: mock(async () => 60000),
      decr: mock(async () => 0),
      del: mock(async () => 1),
      get: mock(async () => null),
      set: mock(async () => "OK"),
    }),
  },
}));

mock.module("stream-chat", () => ({
  StreamChat: {
    getInstance: () => ({
      verifyWebhook: mock(() => true),
    }),
  },
}));

let app: Awaited<ReturnType<typeof import("../src/index")["createApp"]>>;
let userService: typeof import("../src/api/user/user.services")["userService"];
let calculateVisibilityScore: typeof import("../src/api/user/user.services")["calculateVisibilityScore"];
let rankUsers: typeof import("../src/api/user/user.services")["rankUsers"];
let interactionService: typeof import("../src/api/interaction/interaction.services")["interactionService"];
let paymentService: typeof import("../src/api/payment/payment.services")["paymentService"];
let preferenceService: typeof import("../src/api/preference/preference.services")["preferenceService"];
let premiumService: typeof import("../src/api/premium/premium.services")["premiumService"];
let rouletteService: typeof import("../src/api/roulette/roulette.services")["rouletteService"];
let entitlementService: typeof import("../src/services/entitlements")["entitlementService"];
let stableRateLimitKey: typeof import("../src/config/rate-limits")["stableRateLimitKey"];
let rateLimitPresets: typeof import("../src/config/rate-limits")["rateLimitPresets"];

const jsonRequest = (path: string, init: RequestInit = {}) =>
  new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

beforeAll(async () => {
  const modules = await Promise.all([
    import("../src/index"),
    import("../src/api/user/user.services"),
    import("../src/api/interaction/interaction.services"),
    import("../src/api/payment/payment.services"),
    import("../src/api/preference/preference.services"),
    import("../src/api/premium/premium.services"),
    import("../src/api/roulette/roulette.services"),
    import("../src/services/entitlements"),
    import("../src/config/rate-limits"),
  ]);

  app = modules[0].createApp();
  userService = modules[1].userService;
  calculateVisibilityScore = modules[1].calculateVisibilityScore;
  rankUsers = modules[1].rankUsers;
  interactionService = modules[2].interactionService;
  paymentService = modules[3].paymentService;
  preferenceService = modules[4].preferenceService;
  premiumService = modules[5].premiumService;
  rouletteService = modules[6].rouletteService;
  entitlementService = modules[7].entitlementService;
  stableRateLimitKey = modules[8].stableRateLimitKey;
  rateLimitPresets = modules[8].rateLimitPresets;
});

beforeEach(() => {
  userService.getFilteredUsersList = mock(async () => ({
    users: [],
    nextCursor: null,
  })) as any;

  interactionService.likeUser = mock(async () => ({
    like: { likerId: "u1", likedId: "u2", superLike: false },
  })) as any;
  interactionService.dislikeUser = mock(async () => ({
    dislikerId: "u1",
    dislikedId: "u2",
  })) as any;

  paymentService.getPlans = mock(async () => [
    {
      id: "price_123",
      nickname: "Diaspora: Premium",
      amount: 14.99,
      interval: "month",
      intervalCount: 1,
      product: "Diaspora: Premium",
      tier: "premium",
      metadata: {},
    },
  ]) as any;
  paymentService.createPaymentIntent = mock(async () => ({
    subscriptionId: "sub_123",
    clientSecret: "pi_secret",
  })) as any;
  paymentService.getPaymentStatus = mock(async () => ({
    subscriptionType: "premium",
    paymentStatus: "active",
    nextBillingDate: new Date("2026-06-01T00:00:00.000Z"),
  })) as any;
  paymentService.getCustomer = mock(async () => ({
    customerId: "cus_123",
  })) as any;
  paymentService.getOrCreateCustomer = mock(async () => ({
    customerId: "cus_123",
    isNew: false,
  })) as any;
  paymentService.getAddons = mock(async () => [
    {
      id: "recall_5",
      type: "recalls",
      name: "Recall x5",
      quantity: 5,
      unitLabel: "recalls",
      amount: 1.99,
      currency: "usd",
    },
  ]) as any;
  paymentService.createAddonCheckout = mock(async () => ({
    sessionId: "cs_123",
    url: "https://checkout.stripe.test/session",
  })) as any;

  preferenceService.create = mock(async (userId: string, data: any) => ({
    id: 1,
    userId,
    ...data,
  })) as any;
  preferenceService.update = mock(async (userId: string, data: any) => ({
    id: 1,
    userId,
    ...data,
  })) as any;
  preferenceService.get = mock(async (userId: string) => ({
    id: 1,
    userId,
    interests: [],
  })) as any;

  premiumService.boostUser = mock(async (userId: string) => ({
    userId,
    visibilityBoost: true,
    boostsRemaining: 0,
  })) as any;

  rouletteService.findMatch = mock(async () => ({
    matched: false,
    message: "queued",
  })) as any;
  rouletteService.getDetails = mock(async () => ({
    success: true,
    exists: false,
    message: "No active session found",
  })) as any;
});

describe("contract shapes", () => {
  test("entitlement values match stage 4 public tiers", () => {
    expect(entitlementService.getDailySwipeLimit("economy")).toBe(25);
    expect(entitlementService.getEntitlementsForTier("premium")).toMatchObject({
      dailySwipes: "unlimited",
      hasAdvancedFilters: true,
      myLikesLimit: 20,
      superLikesPerWeek: 5,
      boostsPerWeek: 1,
      videoCalls: 8,
      ads: false,
    });
    expect(
      entitlementService.getEntitlementsForTier("first-class"),
    ).toMatchObject({
      myLikesLimit: false,
      videoCalls: "unlimited",
      superLikesPerWeek: 10,
      boostsPerWeek: 3,
      loveLettersPerWeek: 3,
    });
    expect(entitlementService.getEntitlementsForTier("weekender")).toMatchObject(
      {
        myLikesLimit: false,
        monthlyCredits: false,
        rollover: false,
        ads: false,
      },
    );
  });

  test("rate-limit key prefers auth identity and falls back to IP headers", async () => {
    const request = jsonRequest("/api/v1/users", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    }) as any;

    expect(stableRateLimitKey(request, null, { user: { id: "u1" } })).toBe(
      "user:u1",
    );
    expect(stableRateLimitKey(request, null, {})).toBe(
      "ip:203.0.113.10",
    );
  });

  test("user discovery returns users and nextCursor", async () => {
    userService.getFilteredUsersList = mock(async () => ({
      users: [
        {
          id: "u2",
          birthday: "1996-01-01",
          hasLikedLoggedInUser: true,
          preferences: {
            userId: "u2",
            lookingToDate: "WOMAN",
          },
        },
      ],
      nextCursor: null,
    })) as any;

    const response = await app.handle(
      jsonRequest("/api/v1/users?userId=u1&radius=[0,100]&age=[18,40]"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      users: [
        {
          id: "u2",
          birthday: "1996-01-01",
          hasLikedLoggedInUser: true,
        },
      ],
      nextCursor: null,
    });
    expect(body.users[0]).not.toHaveProperty("preferences");
  });

  test("discovery scoring treats visibility boosts and super likes as deck lifts", () => {
    const bareScore = calculateVisibilityScore({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      verified: false,
      onlineStatus: false,
      lastLogin: new Date("2025-01-01T00:00:00.000Z"),
      images: [],
      profile: { bio: "" },
    } as any);

    const visibleScore = calculateVisibilityScore({
      createdAt: new Date(),
      verified: true,
      onlineStatus: true,
      lastLogin: new Date(),
      images: [{ imageUrl: "one" }, { imageUrl: "two" }, { imageUrl: "three" }],
      profile: { bio: "A thoughtful profile with enough detail to matter." },
    } as any);

    expect(visibleScore - bareScore).toBeGreaterThan(60);

    const ranked = rankUsers([
      {
        id: "plain-strong",
        superLike: false,
        likedAt: null,
        totalScore: 160,
      },
      {
        id: "boosted",
        superLike: false,
        likedAt: null,
        totalScore: 320,
      },
      {
        id: "older-super-like",
        superLike: true,
        likedAt: new Date("2026-05-01T00:00:00.000Z"),
        totalScore: 1,
      },
      {
        id: "newer-super-like",
        superLike: true,
        likedAt: new Date("2026-05-03T00:00:00.000Z"),
        totalScore: 1,
      },
    ] as any).map((user) => user.id);

    expect(ranked).toEqual([
      "newer-super-like",
      "older-super-like",
      "boosted",
      "plain-strong",
    ]);
  });

  test("route rate-limit presets cover discovery interactions payments and public routes", () => {
    expect(rateLimitPresets.discovery).toMatchObject({
      duration: 60000,
      max: 30,
      prefix: "rl:discovery:",
    });
    expect(rateLimitPresets.interactions.max).toBeLessThan(
      rateLimitPresets.generalAuthenticated.max,
    );
    expect(rateLimitPresets.payments.prefix).toBe("rl:payments:");
    expect(rateLimitPresets.webhook.max).toBeGreaterThan(
      rateLimitPresets.payments.max,
    );
    expect(rateLimitPresets.public.prefix).toBe("rl:public:");
  });

  test("likes and dislikes keep current success shapes", async () => {
    const likeResponse = await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({ likerId: "u1", likedId: "u2" }),
      }),
    );
    expect(likeResponse.status).toBe(201);
    expect(await likeResponse.json()).toEqual({
      like: { likerId: "u1", likedId: "u2", superLike: false },
    });
    expect(interactionService.likeUser).toHaveBeenLastCalledWith(
      "u1",
      "u2",
      undefined,
      undefined,
    );

    const loveLetterLikeResponse = await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({
          likerId: "u1",
          likedId: "u2",
          isLoveLetter: true,
        }),
      }),
    );
    expect(loveLetterLikeResponse.status).toBe(201);
    expect(interactionService.likeUser).toHaveBeenLastCalledWith(
      "u1",
      "u2",
      undefined,
      true,
    );

    const dislikeResponse = await app.handle(
      jsonRequest("/api/v1/dislikes", {
        method: "POST",
        body: JSON.stringify({ dislikerId: "u1", dislikedId: "u2" }),
      }),
    );
    expect(dislikeResponse.status).toBe(201);
    expect(await dislikeResponse.json()).toEqual({
      dislikerId: "u1",
      dislikedId: "u2",
    });
  });

  test("like route returns normalized swipe-limit 429 envelope", async () => {
    interactionService.likeUser = mock(async () => {
      throw new Error("SWIPE_LIMIT_REACHED:2026-05-04T00:00:00.000Z");
    }) as any;

    const response = await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({ likerId: "u1", likedId: "u2" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      status: "fail",
      message: "Swipe limit reached.",
      code: "SWIPE_LIMIT_REACHED",
      details: [
        {
          message: "Daily swipe allowance has been reached.",
          resetTime: "2026-05-04T00:00:00.000Z",
        },
      ],
      requestId: expect.any(String),
    });
  });

  test("typebox validation errors use normalized details", async () => {
    const response = await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({ likerId: "u1" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      status: "fail",
      message: "Request validation failed.",
      code: "VALIDATION_ERROR",
      requestId: expect.any(String),
    });
    expect(body.details.length).toBeGreaterThan(0);
  });

  test("query parser bad requests use normalized details", async () => {
    const response = await app.handle(
      jsonRequest("/api/v1/users?userId=u1&radius=[0]&age=[18,40]"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      status: "fail",
      message: "Invalid range.",
      code: "INVALID_RANGE",
      details: [
        {
          path: "query.radius",
          message: "Expected a JSON array with minimum and maximum values.",
        },
        {
          path: "query.age",
          message: "Expected a JSON array with minimum and maximum values.",
        },
      ],
    });
  });

  test("domain errors use status code and error code", async () => {
    interactionService.likeUser = mock(async () => {
      const { ConflictError } = await import("../src/middleware/error");
      throw new ConflictError("Like already exists.", {
        code: "LIKE_ALREADY_EXISTS",
      });
    }) as any;

    const response = await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({ likerId: "u1", likedId: "u2" }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      status: "fail",
      message: "Like already exists.",
      code: "LIKE_ALREADY_EXISTS",
    });
  });

  test("database errors are translated before responding", async () => {
    const { errorMiddleware } = await import("../src/middleware/error");
    const dbErrorApp = new Elysia()
      .use(errorMiddleware)
      .get("/unique", () => {
        const err: any = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        err.constraint = "users_email_unique";
        throw err;
      })
      .get("/foreign-key", () => {
        const err: any = new Error("insert or update violates foreign key constraint");
        err.code = "23503";
        throw err;
      });

    const unique = await dbErrorApp.handle(new Request("http://localhost/unique"));
    expect(unique.status).toBe(409);
    expect(await unique.json()).toMatchObject({
      status: "fail",
      message: "Email is already in use.",
      code: "USER_ALREADY_EXISTS",
    });

    const foreignKey = await dbErrorApp.handle(
      new Request("http://localhost/foreign-key"),
    );
    expect(foreignKey.status).toBe(400);
    expect(await foreignKey.json()).toMatchObject({
      status: "fail",
      message: "Referenced record does not exist.",
      code: "DATABASE_FOREIGN_KEY_VIOLATION",
    });
  });

  test("unhandled errors use normalized fallback with debug in test", async () => {
    const { errorMiddleware } = await import("../src/middleware/error");
    const failureApp = new Elysia().use(errorMiddleware).get("/boom", () => {
      throw new Error("Unexpected failure");
    });

    const response = await failureApp.handle(new Request("http://localhost/boom"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      status: "error",
      message: "Unexpected failure",
      code: "INTERNAL_SERVER_ERROR",
      debug: {
        name: "Error",
      },
    });
    expect(body.stack).toContain("Unexpected failure");
  });

  test("payment route response shapes are stable", async () => {
    const plans = await app.handle(jsonRequest("/api/v1/plans"));
    expect(plans.status).toBe(200);
    expect(await plans.json()).toEqual([
      {
        id: "price_123",
        nickname: "Diaspora: Premium",
        amount: 14.99,
        interval: "month",
        intervalCount: 1,
        product: "Diaspora: Premium",
        tier: "premium",
        metadata: {},
      },
    ]);

    const subscription = await app.handle(
      jsonRequest("/api/v1/subscription", {
        method: "POST",
        body: JSON.stringify({ userId: "u1", priceId: "price_123" }),
      }),
    );
    expect(subscription.status).toBe(200);
    expect(await subscription.json()).toEqual({
      subscriptionId: "sub_123",
      clientSecret: "pi_secret",
    });

    const status = await app.handle(jsonRequest("/api/v1/status/u1"));
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      subscriptionType: "premium",
      paymentStatus: "active",
    });

    const customer = await app.handle(jsonRequest("/api/v1/customer/u1"));
    expect(customer.status).toBe(200);
    expect(await customer.json()).toEqual({ customerId: "cus_123" });

    const createCustomer = await app.handle(
      jsonRequest("/api/v1/customer", {
        method: "POST",
        body: JSON.stringify({ userId: "u1", email: "u1@example.com" }),
      }),
    );
    expect(createCustomer.status).toBe(200);
    expect(await createCustomer.json()).toEqual({
      customerId: "cus_123",
      isNew: false,
    });
  });

  test("add-on payment routes expose pack list and checkout session", async () => {
    const addons = await app.handle(jsonRequest("/api/v1/addons"));
    expect(addons.status).toBe(200);
    expect(await addons.json()).toEqual([
      {
        id: "recall_5",
        type: "recalls",
        name: "Recall x5",
        quantity: 5,
        unitLabel: "recalls",
        amount: 1.99,
        currency: "usd",
      },
    ]);

    const checkout = await app.handle(
      jsonRequest("/api/v1/addons/checkout", {
        method: "POST",
        body: JSON.stringify({ userId: "u1", packId: "recall_5" }),
      }),
    );

    expect(checkout.status).toBe(200);
    expect(await checkout.json()).toEqual({
      sessionId: "cs_123",
      url: "https://checkout.stripe.test/session",
    });
  });

  test("preference create update and get keep route shapes", async () => {
    const create = await app.handle(
      jsonRequest("/api/v1/preference", {
        method: "POST",
        body: JSON.stringify({ userId: "u1", interests: ["music"] }),
      }),
    );
    expect(create.status).toBe(201);
    expect(await create.json()).toEqual({
      id: 1,
      userId: "u1",
      interests: ["music"],
    });

    const update = await app.handle(
      jsonRequest("/api/v1/preference/u1", {
        method: "PATCH",
        body: JSON.stringify({ bio: "hello" }),
      }),
    );
    expect(update.status).toBe(200);
    expect(await update.json()).toEqual({
      id: 1,
      userId: "u1",
      bio: "hello",
    });

    const get = await app.handle(jsonRequest("/api/v1/preference/u1"));
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual({
      id: 1,
      userId: "u1",
      interests: [],
    });
  });

  test("boost and roulette routes keep current body patterns", async () => {
    const boost = await app.handle(
      jsonRequest("/api/v1/boost/u1", { method: "POST" }),
    );
    expect(boost.status).toBe(200);
    expect(await boost.json()).toEqual({
      userId: "u1",
      visibilityBoost: true,
      boostsRemaining: 0,
    });

    const roulette = await app.handle(
      jsonRequest("/api/v1/roulette/start", {
        method: "POST",
        body: JSON.stringify({ userId: "u1" }),
      }),
    );
    expect(roulette.status).toBe(200);
    expect(await roulette.json()).toEqual({
      success: true,
      matched: false,
      message: "queued",
    });

    const details = await app.handle(jsonRequest("/api/v1/roulette/details/u1"));
    expect(details.status).toBe(200);
    expect(await details.json()).toEqual({
      success: true,
      exists: false,
      message: "No active session found",
    });
  });
});
