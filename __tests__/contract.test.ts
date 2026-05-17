import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  setDefaultTimeout,
  test,
} from "bun:test";
import { Elysia } from "elysia";

setDefaultTimeout(30000);

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://user:password@localhost:5432/test";
process.env.STRIPE_SECRET_KEY = "sk_test_contract";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_contract";
process.env.STREAM_API_KEY = "stream_key";
process.env.STREAM_API_SECRET = "stream_secret";
process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
process.env.UPSTASH_REDIS_REST_TOKEN = "redis_token";

let streamWebhookValid = true;
let clerkAuthUserId: string | null = "u1";
const verifyWebhookMock = mock((rawBody: string, signature: string) => {
  return streamWebhookValid && rawBody.length > 0 && signature.length > 0;
});
const queryChannelsRequestMock = mock(async () => []);

mock.module("elysia-clerk", () => ({
  clerkPlugin: () =>
    new Elysia({ name: "mock.clerk" })
      .decorate("clerk", {
        users: {
          getUser: mock(async (userId: string) => ({ id: userId })),
        },
      })
      .resolve(() => ({
        auth: () => ({ userId: clerkAuthUserId }),
      }))
      .as("scoped"),
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
      verifyWebhook: verifyWebhookMock,
      queryChannelsRequest: queryChannelsRequestMock,
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
let profileService: typeof import("../src/api/profile/profile.services")["profileService"];
let profileViewsService: typeof import("../src/api/profile/profile-views.services")["profileViewsService"];
let imageService: typeof import("../src/api/image/image.services")["imageService"];
let favoriteService: typeof import("../src/api/favorite/favorite.services")["favoriteService"];
let blockService: typeof import("../src/api/block/block.services")["blockService"];
let reportService: typeof import("../src/api/report/report.services")["reportService"];
let locationService: typeof import("../src/api/location/location.services")["locationService"];
let rouletteService: typeof import("../src/api/roulette/roulette.services")["rouletteService"];
let entitlementService: typeof import("../src/services/entitlements")["entitlementService"];
let stableRateLimitKey: typeof import("../src/config/rate-limits")["stableRateLimitKey"];
let rateLimitPresets: typeof import("../src/config/rate-limits")["rateLimitPresets"];
let streamService: typeof import("../src/api/stream/stream.services")["streamService"];
let matchService: typeof import("../src/api/match/match.services")["matchService"];
let matchRepo: typeof import("../src/repo/match.repo")["matchRepo"];
let interactionRepo: typeof import("../src/repo/interaction.repo")["interactionRepo"];
let rouletteRepo: typeof import("../src/repo/roulette.repo")["rouletteRepo"];
let userRepo: typeof import("../src/repo/user.repo")["userRepo"];
let premiumFeatureRepo: typeof import("../src/repo/premium.repo")["premiumFeatureRepo"];
let dbModule: typeof import("../src/db/db");
let actualLikeUser: typeof import("../src/api/interaction/interaction.services")["interactionService"]["likeUser"];
let actualGetReceivedLikes: typeof import("../src/api/interaction/interaction.services")["interactionService"]["getReceivedLikes"];
let actualGetFilteredUsersList: typeof import("../src/api/user/user.services")["userService"]["getFilteredUsersList"];
let actualGetConversations: typeof import("../src/api/stream/stream.services")["streamService"]["getConversations"];
let actualFindRouletteMatch: typeof import("../src/api/roulette/roulette.services")["rouletteService"]["findMatch"];

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
    import("../src/api/profile/profile.services"),
    import("../src/api/profile/profile-views.services"),
    import("../src/api/image/image.services"),
    import("../src/api/favorite/favorite.services"),
    import("../src/api/block/block.services"),
    import("../src/api/report/report.services"),
    import("../src/api/location/location.services"),
    import("../src/api/roulette/roulette.services"),
    import("../src/services/entitlements"),
    import("../src/config/rate-limits"),
    import("../src/api/stream/stream.services"),
    import("../src/api/match/match.services"),
    import("../src/repo/match.repo"),
    import("../src/repo/interaction.repo"),
    import("../src/repo/roulette.repo"),
    import("../src/repo/user.repo"),
    import("../src/repo/premium.repo"),
    import("../src/db/db"),
  ]);

  app = modules[0].createApp();
  userService = modules[1].userService;
  calculateVisibilityScore = modules[1].calculateVisibilityScore;
  rankUsers = modules[1].rankUsers;
  interactionService = modules[2].interactionService;
  paymentService = modules[3].paymentService;
  preferenceService = modules[4].preferenceService;
  premiumService = modules[5].premiumService;
  profileService = modules[6].profileService;
  profileViewsService = modules[7].profileViewsService;
  imageService = modules[8].imageService;
  favoriteService = modules[9].favoriteService;
  blockService = modules[10].blockService;
  reportService = modules[11].reportService;
  locationService = modules[12].locationService;
  rouletteService = modules[13].rouletteService;
  entitlementService = modules[14].entitlementService;
  stableRateLimitKey = modules[15].stableRateLimitKey;
  rateLimitPresets = modules[15].rateLimitPresets;
  streamService = modules[16].streamService;
  matchService = modules[17].matchService;
  matchRepo = modules[18].matchRepo;
  interactionRepo = modules[19].interactionRepo;
  rouletteRepo = modules[20].rouletteRepo;
  userRepo = modules[21].userRepo;
  premiumFeatureRepo = modules[22].premiumFeatureRepo;
  dbModule = modules[23];
  actualLikeUser = interactionService.likeUser;
  actualGetReceivedLikes = interactionService.getReceivedLikes;
  actualGetFilteredUsersList = userService.getFilteredUsersList;
  actualGetConversations = streamService.getConversations;
  actualFindRouletteMatch = rouletteService.findMatch;
});

beforeEach(() => {
  streamWebhookValid = true;
  clerkAuthUserId = "u1";
  verifyWebhookMock.mockClear();
  queryChannelsRequestMock.mockClear();

  userService.getFilteredUsersList = mock(async () => ({
    users: [],
    nextCursor: null,
  })) as any;

  interactionService.likeUser = mock(async () => ({
    like: { likerId: "u1", likedId: "u2", superLike: false },
    matched: false,
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

  profileService.createProfile = mock(async (userId: string, bio: string, interests: string[]) => ({
    userId,
    bio,
    interests,
  })) as any;
  profileService.getProfile = mock(async (userId: string) => ({
    userId,
    bio: "hello",
    interests: [],
  })) as any;
  profileService.updateProfile = mock(async (userId: string, bio?: string, interests?: string[]) => ({
    userId,
    bio,
    interests,
  })) as any;
  profileService.deleteProfile = mock(async (userId: string) => ({
    userId,
  })) as any;

  profileViewsService.recordView = mock(async (viewerId: string, viewedId: string) => ({
    viewerId,
    viewedId,
  })) as any;
  profileViewsService.getViews = mock(async (userId: string) => [
    { viewedId: userId, viewer: { id: "viewer" } },
  ]) as any;

  imageService.processAndSyncImages = mock(async (userId: string, images: any[]) =>
    images.map((image) => ({ ...image, userId })),
  ) as any;
  imageService.generateUploadSignature = mock(() => ({
    cloudName: "cloud",
    apiKey: "key",
    timestamp: 1,
    signature: "sig",
    folder: "user_uploads",
    upload_preset: "diaspora",
  })) as any;

  favoriteService.add = mock(async (userId: string, favoriteUserId: string) => ({
    userId,
    favoriteUserId,
  })) as any;
  favoriteService.get = mock(async (userId: string) => [{ userId }]) as any;
  favoriteService.remove = mock(async (userId: string, favoriteUserId: string) => ({
    success: true,
    userId,
    favoriteUserId,
  })) as any;

  blockService.blockUser = mock(async (blockerId: string, blockedId: string) => ({
    blockerId,
    blockedId,
  })) as any;
  blockService.getBlockedIds = mock(async () => []) as any;

  reportService.create = mock(async (data: any) => data) as any;
  locationService.createLocation = mock(async (userId: string, latitude: string, longitude: string) => ({
    userId,
    latitude,
    longitude,
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
  rouletteService.endSession = mock(async (matchId?: string, userId?: string) => ({
    success: true,
    matchId,
    userId,
  })) as any;
  rouletteService.getStatus = mock(async (userId: string) => ({
    success: true,
    userId,
  })) as any;
  rouletteService.cancelSearch = mock(async (userId: string) => ({
    success: true,
    userId,
  })) as any;
  rouletteService.getHistory = mock(async (userId: string) => [{ userId }]) as any;

  streamService.generateToken = mock(async (data: any) => ({
    token: "stream-token",
    userId: data.userId,
    apiKey: "stream_key",
  })) as any;
  streamService.getConversations = mock(async () => ({
    conversations: [],
    nextCursor: null,
  })) as any;

  matchService.getMatches = mock(async () => []) as any;
});

describe("contract shapes", () => {
  test("entitlement values match stage 4 public tiers", () => {
    expect(entitlementService.getDailySwipeLimit("economy")).toBe(25);
    expect(entitlementService.getEntitlementsForTier("economy")).toMatchObject({
      myLikesLimit: 0,
      profileViews: false,
      superLikesPerWeek: 0,
      boostsPerWeek: 0,
      recallsPerWeek: 0,
    });
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

  test("authenticated routes ignore spoofed actor ids", async () => {
    clerkAuthUserId = "auth_user";

    await app.handle(
      jsonRequest("/api/v1/stream/token", {
        method: "POST",
        body: JSON.stringify({ userId: "spoof_user", name: "Spoof" }),
      }),
    );
    expect(streamService.generateToken).toHaveBeenLastCalledWith({
      userId: "auth_user",
      name: "Spoof",
    });

    await app.handle(jsonRequest("/api/v1/stream/conversations/spoof_user"));
    expect(streamService.getConversations).toHaveBeenLastCalledWith({
      userId: "auth_user",
      cursor: undefined,
      limit: undefined,
    });

    userRepo.getUserById = mock(async () => ({
      id: "auth_user",
      subscriptionType: "premium",
    })) as any;
    premiumFeatureRepo.ensureSubscriptionAllowances = mock(async () => ({
      userId: "auth_user",
    })) as any;
    premiumFeatureRepo.consumeFeature = mock(async (userId: string, feature: string) => ({
      source: "subscription",
      features: { userId, videoCallsRemaining: 7 },
    })) as any;
    await app.handle(
      jsonRequest("/api/v1/stream/call", {
        method: "POST",
        body: JSON.stringify({
          callId: "call_123",
          type: "default",
          userId: "spoof_user",
        }),
      }),
    );
    expect(premiumFeatureRepo.consumeFeature).toHaveBeenLastCalledWith(
      "auth_user",
      "videoCalls",
      { unlimited: false },
    );

    await app.handle(
      jsonRequest("/api/v1/subscription", {
        method: "POST",
        body: JSON.stringify({ userId: "spoof_user", priceId: "price_123" }),
      }),
    );
    expect(paymentService.createPaymentIntent).toHaveBeenLastCalledWith(
      "auth_user",
      "price_123",
    );

    await app.handle(jsonRequest("/api/v1/status/spoof_user"));
    expect(paymentService.getPaymentStatus).toHaveBeenLastCalledWith(
      "auth_user",
    );

    await app.handle(
      jsonRequest("/api/v1/addons/checkout", {
        method: "POST",
        body: JSON.stringify({ userId: "spoof_user", packId: "recall_5" }),
      }),
    );
    expect(paymentService.createAddonCheckout).toHaveBeenLastCalledWith(
      "auth_user",
      "recall_5",
      undefined,
      undefined,
    );

    await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({ likerId: "spoof_user", likedId: "target" }),
      }),
    );
    expect(interactionService.likeUser).toHaveBeenLastCalledWith(
      "auth_user",
      "target",
      undefined,
      undefined,
    );

    await app.handle(
      jsonRequest("/api/v1/dislikes", {
        method: "POST",
        body: JSON.stringify({ dislikerId: "spoof_user", dislikedId: "target" }),
      }),
    );
    expect(interactionService.dislikeUser).toHaveBeenLastCalledWith(
      "auth_user",
      "target",
    );

    await app.handle(jsonRequest("/api/v1/users?userId=spoof_user&radius=[0,100]&age=[18,40]"));
    expect(userService.getFilteredUsersList).toHaveBeenLastCalledWith(
      "auth_user",
      expect.any(Object),
      [0, 100],
      [18, 40],
      undefined,
    );

    await app.handle(jsonRequest("/api/v1/boost/spoof_user", { method: "POST" }));
    expect(premiumService.boostUser).toHaveBeenLastCalledWith("auth_user");

    await app.handle(jsonRequest("/api/v1/matches/spoof_user"));
    expect(matchService.getMatches).toHaveBeenLastCalledWith("auth_user");
  });

  test("adjacent user-owned routes ignore spoofed actor ids", async () => {
    clerkAuthUserId = "auth_user";

    await app.handle(
      jsonRequest("/api/v1/preference", {
        method: "POST",
        body: JSON.stringify({ userId: "spoof_user", interests: ["music"] }),
      }),
    );
    expect(preferenceService.create).toHaveBeenLastCalledWith("auth_user", {
      interests: ["music"],
    });

    await app.handle(
      jsonRequest("/api/v1/profile/spoof_user", {
        method: "PUT",
        body: JSON.stringify({ bio: "updated" }),
      }),
    );
    expect(profileService.updateProfile).toHaveBeenLastCalledWith(
      "auth_user",
      "updated",
      undefined,
    );

    await app.handle(
      jsonRequest("/api/v1/images", {
        method: "POST",
        body: JSON.stringify({
          userId: "spoof_user",
          images: [{ imageUrl: "https://cdn.test/1.jpg", order: 1 }],
        }),
      }),
    );
    expect(imageService.processAndSyncImages).toHaveBeenLastCalledWith(
      "auth_user",
      [{ imageUrl: "https://cdn.test/1.jpg", order: 1 }],
    );

    await app.handle(
      jsonRequest("/api/v1/profile-views", {
        method: "POST",
        body: JSON.stringify({ viewerId: "spoof_user", viewedId: "target" }),
      }),
    );
    expect(profileViewsService.recordView).toHaveBeenLastCalledWith(
      "auth_user",
      "target",
    );

    await app.handle(
      jsonRequest("/api/v1/favorites", {
        method: "POST",
        body: JSON.stringify({ userId: "spoof_user", favoriteUserId: "target" }),
      }),
    );
    expect(favoriteService.add).toHaveBeenLastCalledWith("auth_user", "target");

    await app.handle(
      jsonRequest("/api/v1/block", {
        method: "POST",
        body: JSON.stringify({ blockerId: "spoof_user", blockedId: "target" }),
      }),
    );
    expect(blockService.blockUser).toHaveBeenLastCalledWith(
      "auth_user",
      "target",
    );

    await app.handle(
      jsonRequest("/api/v1/report", {
        method: "POST",
        body: JSON.stringify({
          reporterId: "spoof_user",
          reportedId: "target",
          reason: "abuse",
        }),
      }),
    );
    expect(reportService.create).toHaveBeenLastCalledWith({
      reporterId: "auth_user",
      reportedId: "target",
      reason: "abuse",
    });

    await app.handle(
      jsonRequest("/api/v1/location", {
        method: "POST",
        body: JSON.stringify({
          userId: "spoof_user",
          latitude: "6.45",
          longitude: "3.39",
        }),
      }),
    );
    expect(locationService.createLocation).toHaveBeenLastCalledWith(
      "auth_user",
      "6.45",
      "3.39",
    );

    await app.handle(
      jsonRequest("/api/v1/roulette/start", {
        method: "POST",
        body: JSON.stringify({ userId: "spoof_user" }),
      }),
    );
    expect(rouletteService.findMatch).toHaveBeenLastCalledWith("auth_user");
  });

  test("user-owned routes require Clerk auth while public webhooks stay unauthenticated", async () => {
    clerkAuthUserId = null;

    const protectedResponse = await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({ likerId: "u1", likedId: "u2" }),
      }),
    );
    expect(protectedResponse.status).toBe(401);
    expect(await protectedResponse.json()).toMatchObject({
      status: "fail",
      code: "AUTHENTICATION_REQUIRED",
    });

    const webhookResponse = await app.handle(
      new Request("http://localhost/api/v1/stream/new-message-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": "sig-message",
        },
        body: '{"type":"message.new","members":[]}',
      }),
    );
    expect(webhookResponse.status).toBe(200);
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
      matched: false,
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

  test("like route exposes explicit mutual match result", async () => {
    interactionService.likeUser = mock(async () => ({
      like: { likerId: "u1", likedId: "u2", superLike: false },
      matched: true,
      match: { id: "match_1", user1Id: "u1", user2Id: "u2" },
      matchedUser: {
        id: "u2",
        displayName: "Kwame",
        name: "Kwame",
        image: "https://cdn.test/u2.png",
      },
    })) as any;

    const response = await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({ likerId: "u1", likedId: "u2" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      like: { likerId: "u1", likedId: "u2", superLike: false },
      matched: true,
      match: { id: "match_1", user1Id: "u1", user2Id: "u2" },
      matchedUser: {
        id: "u2",
        displayName: "Kwame",
        name: "Kwame",
        image: "https://cdn.test/u2.png",
      },
    });
  });

  test("paid feature denial includes feature metadata", async () => {
    interactionService.likeUser = mock(async () => {
      const { PaymentRequiredError } = await import("../src/middleware/error");
      throw new PaymentRequiredError(
        "You are out of Super Likes. Please upgrade or buy more.",
        {
          code: "INSUFFICIENT_SUPERLIKES",
          details: [
            {
              message: "Super Like allowance has been exhausted.",
              feature: "superlikes",
              reason: "allowance_exhausted",
              requiredPlan: "premium",
            },
          ],
        },
      );
    }) as any;

    const response = await app.handle(
      jsonRequest("/api/v1/likes", {
        method: "POST",
        body: JSON.stringify({
          likerId: "u1",
          likedId: "u2",
          superLike: true,
        }),
      }),
    );

    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({
      status: "fail",
      code: "INSUFFICIENT_SUPERLIKES",
      details: [
        {
          feature: "superlikes",
          reason: "allowance_exhausted",
          requiredPlan: "premium",
        },
      ],
    });
  });

  test("super-like denial happens before swipe increment or like insert", async () => {
    interactionService.likeUser = actualLikeUser;

    userRepo.getUserDetailsById = mock(async (userId: string) => ({
      id: userId,
      displayName: userId === "u1" ? "Amina" : "Kwame",
      email: `${userId}@example.test`,
      birthday: "1995-01-01",
      onboardingPage: null,
      fcmToken: null,
      subscription: "economy",
      image: null,
    })) as any;
    userRepo.getEnabledPushTokensByUserId = mock(async () => []) as any;
    interactionRepo.getExistingLike = mock(async () => null) as any;
    interactionRepo.getExistingDislike = mock(async () => null) as any;
    interactionRepo.checkAndIncrementSwipeLimit = mock(async () => undefined) as any;
    interactionRepo.createLike = mock(async () => ({
      likerId: "u1",
      likedId: "u2",
      likedAt: new Date("2026-05-01T00:00:00.000Z"),
      superLike: true,
      isLoveLetter: false,
    })) as any;
    premiumFeatureRepo.ensureSubscriptionAllowances = mock(async () => ({
      userId: "u1",
      superlikesRemaining: 0,
      addOnSuperlikesRemaining: 0,
      loveLettersRemaining: 0,
      addOnLoveLettersRemaining: 0,
    })) as any;
    premiumFeatureRepo.getFeaturesByUserId = mock(async () => ({
      userId: "u1",
      superlikesRemaining: 0,
      addOnSuperlikesRemaining: 0,
      loveLettersRemaining: 0,
      addOnLoveLettersRemaining: 0,
    })) as any;
    (dbModule.db as any).transaction = mock(async (callback: any) =>
      callback(dbModule.db),
    );

    await expect(interactionService.likeUser("u1", "u2", true)).rejects.toMatchObject({
      code: "INSUFFICIENT_SUPERLIKES",
      statusCode: 402,
    });
    expect(interactionRepo.checkAndIncrementSwipeLimit).not.toHaveBeenCalled();
    expect(interactionRepo.createLike).not.toHaveBeenCalled();
  });

  test("duplicate love letter likes use a specific conflict code", async () => {
    interactionService.likeUser = actualLikeUser;

    userRepo.getUserDetailsById = mock(async (userId: string) => ({
      id: userId,
      displayName: userId,
      email: `${userId}@example.test`,
      birthday: "1995-01-01",
      onboardingPage: null,
      fcmToken: null,
      subscription: "first-class",
      image: null,
    })) as any;
    interactionRepo.getExistingLike = mock(async () => ({
      likerId: "u1",
      likedId: "u2",
      superLike: false,
      isLoveLetter: true,
    })) as any;

    await expect(
      interactionService.likeUser("u1", "u2", false, true),
    ).rejects.toMatchObject({
      code: "LOVE_LETTER_ALREADY_EXISTS",
      statusCode: 409,
    });
  });

  test("unpaid received likes return privacy-safe placeholders", async () => {
    interactionService.getReceivedLikes = actualGetReceivedLikes;
    userRepo.getUserById = mock(async () => ({
      id: "u1",
      subscriptionType: "economy",
    })) as any;
    interactionRepo.getReceivedLikes = mock(async () => [
      {
        likedId: "liker_1",
        likedAt: new Date("2026-05-01T00:00:00.000Z"),
        superLike: true,
        isLoveLetter: false,
        images: ["https://cdn.test/private.jpg"],
        user: {
          id: "liker_1",
          name: "Private",
          email: "private@example.test",
          birthday: "1995-01-01",
        },
      },
    ]) as any;

    expect(await interactionService.getReceivedLikes("u1")).toEqual([
      {
        likedId: undefined,
        likedAt: new Date("2026-05-01T00:00:00.000Z"),
        superLike: true,
        isLoveLetter: false,
        images: [],
        user: null,
        hidden: true,
        revealRequiredPlan: "premium",
      },
    ]);
  });

  test("unpaid advanced discovery filters return paid feature errors", async () => {
    userService.getFilteredUsersList = actualGetFilteredUsersList;
    userRepo.getUserById = mock(async () => ({
      id: "u1",
      subscriptionType: "economy",
    })) as any;

    await expect(
      userService.getFilteredUsersList(
        "u1",
        {
          currentUserId: "u1",
          smoking: true,
        },
        [0, 100],
        [18, 40],
      ),
    ).rejects.toMatchObject({
      code: "ADVANCED_FILTERS_REQUIRED",
      statusCode: 402,
      details: [
        expect.objectContaining({
          path: "smoking",
          feature: "advancedFilters",
          requiredPlan: "premium",
        }),
      ],
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

  test("roulette start consumes Cruise allowance for new sessions", async () => {
    rouletteService.findMatch = actualFindRouletteMatch;
    userRepo.getUserById = mock(async () => ({
      id: "u1",
      subscriptionType: "economy",
    })) as any;
    premiumFeatureRepo.ensureSubscriptionAllowances = mock(async () => ({
      userId: "u1",
      videoCallsRemaining: 2,
    })) as any;
    premiumFeatureRepo.consumeFeature = mock(async () => ({
      source: "subscription",
      features: {
        userId: "u1",
        videoCallsRemaining: 1,
        addOnVideoCallsRemaining: 0,
      },
    })) as any;
    rouletteRepo.findSessionByUserId = mock(async () => null) as any;
    rouletteRepo.upsertWaitingSession = mock(async () => ({
      id: "session_1",
      userId: "u1",
      status: "waiting",
      previousPartners: [],
    })) as any;
    rouletteRepo.findCompatiblePartner = mock(async () => null) as any;

    await expect(rouletteService.findMatch("u1")).resolves.toMatchObject({
      matched: false,
    });
    expect(premiumFeatureRepo.consumeFeature).toHaveBeenLastCalledWith(
      "u1",
      "videoCalls",
      { unlimited: false },
    );
  });

  test("roulette start rejects exhausted Cruise allowance before queueing", async () => {
    rouletteService.findMatch = actualFindRouletteMatch;
    userRepo.getUserById = mock(async () => ({
      id: "u1",
      subscriptionType: "economy",
    })) as any;
    premiumFeatureRepo.ensureSubscriptionAllowances = mock(async () => ({
      userId: "u1",
      videoCallsRemaining: 0,
    })) as any;
    premiumFeatureRepo.consumeFeature = mock(async () => null) as any;
    rouletteRepo.findSessionByUserId = mock(async () => null) as any;
    rouletteRepo.upsertWaitingSession = mock(async () => {
      throw new Error("should not queue");
    }) as any;

    await expect(rouletteService.findMatch("u1")).rejects.toMatchObject({
      code: "INSUFFICIENT_CRUISE_SESSIONS",
      statusCode: 402,
    });
    expect(rouletteRepo.upsertWaitingSession).not.toHaveBeenCalled();
  });

  test("matches route remains mounted", async () => {
    const response = await app.handle(jsonRequest("/api/v1/matches/u1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(matchService.getMatches).toHaveBeenCalledWith("u1");
  });

  test("match repo normalizes pair ordering before persistence", () => {
    expect(matchRepo.normalizePair("u2", "u1")).toEqual({
      user1Id: "u1",
      user2Id: "u2",
    });
    expect(matchRepo.normalizePair("u1", "u2")).toEqual({
      user1Id: "u1",
      user2Id: "u2",
    });
  });

  test("stream conversations route exposes conversations and nextCursor", async () => {
    streamService.getConversations = mock(async () => ({
      conversations: [
        {
          cid: "messaging:u1-u2",
          id: "u1-u2",
          type: "messaging",
          participant: {
            id: "u2",
            name: "Stream Name",
            displayName: "DB Name",
            images: [{ imageUrl: "https://cdn.test/u2.png", order: 1 }],
          },
          lastMessage: {
            id: "msg-1",
            text: "hello",
            user: { id: "u2" },
            custom: { mood: "bright" },
          },
        },
      ],
      nextCursor: "opaque-cursor",
    })) as any;

    const response = await app.handle(
      jsonRequest("/api/v1/stream/conversations/u1?limit=1"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      conversations: [
        {
          cid: "messaging:u1-u2",
          id: "u1-u2",
          type: "messaging",
          participant: {
            id: "u2",
            name: "Stream Name",
            displayName: "DB Name",
            images: [{ imageUrl: "https://cdn.test/u2.png", order: 1 }],
          },
          lastMessage: {
            id: "msg-1",
            text: "hello",
            user: { id: "u2" },
            custom: { mood: "bright" },
          },
        },
      ],
      nextCursor: "opaque-cursor",
    });
    expect(streamService.getConversations).toHaveBeenCalledWith({
      userId: "u1",
      cursor: undefined,
      limit: 1,
    });
  });

  test("stream conversations include backend chat access metadata", async () => {
    streamService.getConversations = actualGetConversations;
    userRepo.checkUserExists = mock(async () => true) as any;
    userRepo.getConversationProfilesByIds = mock(async () => ({
      u2: {
        id: "u2",
        displayName: "DB Name",
        images: [{ imageUrl: "https://cdn.test/u2.png", order: 1 }],
      },
    })) as any;
    matchRepo.getMatchBetweenUsers = mock(async () => ({
      id: "match_1",
      user1Id: "u1",
      user2Id: "u2",
    })) as any;
    interactionRepo.getExistingLoveLetterLike = mock(async () => null) as any;
    (queryChannelsRequestMock as any).mockImplementationOnce(async () => [
      {
        cid: "messaging:u1-u2",
        id: "u1-u2",
        type: "messaging",
        members: [
          { user_id: "u1", user: { id: "u1", name: "Amina" } },
          { user_id: "u2", user: { id: "u2", name: "Kwame" } },
        ],
        messages: [{ id: "msg-1", text: "hello" }],
      },
    ]);

    expect(await streamService.getConversations({ userId: "u1" })).toEqual({
      conversations: [
        {
          cid: "messaging:u1-u2",
          id: "u1-u2",
          type: "messaging",
          participant: {
            id: "u2",
            name: "Kwame",
            displayName: "DB Name",
            imageUrl: "https://cdn.test/u2.png",
          },
          lastMessage: { id: "msg-1", text: "hello" },
          access: {
            isMatched: true,
            hasLoveLetter: false,
            canChat: true,
            chatUnlockReason: "match",
            matchId: "match_1",
          },
        },
      ],
      nextCursor: null,
    });
  });

  test("stream call setup rejects unmatched recipients before consuming allowance", async () => {
    matchRepo.getMatchBetweenUsers = mock(async () => null) as any;
    premiumFeatureRepo.consumeFeature = mock(async () => {
      throw new Error("should not consume");
    }) as any;

    const response = await app.handle(
      jsonRequest("/api/v1/stream/call", {
        method: "POST",
        body: JSON.stringify({
          callId: "call_123",
          recipientId: "u2",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      status: "fail",
      code: "CALL_REQUIRES_MATCH",
      details: [
        {
          feature: "chat",
          reason: "match_required",
        },
      ],
    });
    expect(premiumFeatureRepo.consumeFeature).not.toHaveBeenCalled();
  });

  test("stream webhooks verify the raw body before parsing", async () => {
    const messagePayload =
      '{ "type": "message.new", "user": { "id": "u1", "name": "Amina" }, "message": { "text": "hi" }, "members": [] }';

    const messageResponse = await app.handle(
      new Request("http://localhost/api/v1/stream/new-message-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": "sig-message",
        },
        body: messagePayload,
      }),
    );

    expect(messageResponse.status).toBe(200);
    expect(await messageResponse.json()).toEqual({ ok: true });
    expect(verifyWebhookMock).toHaveBeenLastCalledWith(
      messagePayload,
      "sig-message",
    );

    const callPayload =
      '{ "type": "call.ring", "call": { "id": "call-1", "type": "default", "members": [] }, "user": { "id": "u1", "name": "Amina" } }';

    const callResponse = await app.handle(
      new Request("http://localhost/api/v1/stream/call-ring-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": "sig-call",
        },
        body: callPayload,
      }),
    );

    expect(callResponse.status).toBe(200);
    expect(await callResponse.json()).toEqual({ ok: true });
    expect(verifyWebhookMock).toHaveBeenLastCalledWith(callPayload, "sig-call");
  });

  test("stream webhook invalid signatures return 401", async () => {
    streamWebhookValid = false;

    const response = await app.handle(
      new Request("http://localhost/api/v1/stream/new-message-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": "bad-signature",
        },
        body: '{"type":"message.new"}',
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      status: "fail",
      code: "INVALID_STREAM_SIGNATURE",
    });
  });
});
