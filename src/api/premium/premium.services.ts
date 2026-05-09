import { Expo, type ExpoPushMessage } from "expo-server-sdk";

import { premiumFeatureRepo } from "../../repo/premium.repo";
import { userRepo } from "../../repo/user.repo";
import { fcmAdmin } from "../../services/fcm";
import { cacheUtils } from "../../utils/cache.utils";
import { logger } from "../../utils/logger";
import { resolveTier } from "../../services/entitlements";
import { PaymentRequiredError } from "../../middleware/error";

const expo = new Expo();

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const normalizePushData = (data?: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [key, String(value)]),
  );
};

const sendExpoPushToUser = async (userId: string, payload: PushPayload) => {
  const pushTokens = await userRepo.getEnabledPushTokensByUserId(userId);

  const messages: ExpoPushMessage[] = pushTokens
    .filter((pushToken) => pushToken.provider === "expo")
    .filter((pushToken) => Expo.isExpoPushToken(pushToken.token))
    .map((pushToken) => ({
      to: pushToken.token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }));

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      logger.info(
        {
          provider: "expo",
          tickets,
          userId,
        },
        "[Premium] Expo push notification sent",
      );
    } catch (err) {
      logger.error(
        { err, userId },
        "[Premium] Error sending Expo push notification",
      );
    }
  }
};

const sendLegacyFcmPush = async (
  fcmToken: string | null | undefined,
  payload: PushPayload,
) => {
  if (!fcmToken) return;

  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: normalizePushData(payload.data),
      token: fcmToken,
    });

    logger.info(
      { provider: "fcm" },
      "[Premium] Legacy FCM push notification sent",
    );
  } catch (err) {
    logger.error(
      { err },
      "[Premium] Error sending legacy FCM push notification",
    );
  }
};

const sendPushToUser = async (
  user: {
    id: string;
    fcmToken?: string | null;
  },
  payload: PushPayload,
) => {
  await Promise.all([
    sendExpoPushToUser(user.id, payload),
    sendLegacyFcmPush(user.fcmToken, payload),
  ]);
};

const sendBoostStartedNotification = async (user: {
  id: string;
  fcmToken?: string | null;
}) => {
  await sendPushToUser(user, {
    title: "Takeoff Boost Activated! 🚀",
    body: "Your profile is now being prioritized in discovery for the next 30 minutes.",
    data: {
      type: "BOOST_STARTED",
      action: "OPEN_DISCOVERY",
    },
  });
};

const sendBoostEndedNotification = async (user: {
  id: string;
  fcmToken?: string | null;
}) => {
  await sendPushToUser(user, {
    title: "Boost Complete 🛬",
    body: "Your 30-minute Takeoff Boost has ended. Check your matches!",
    data: {
      type: "BOOST_ENDED",
      action: "OPEN_MATCHES",
    },
  });
};

export const premiumService = {
  boostUser: async (userId: string) => {
    const user = await userRepo.getUserById(userId);

    await premiumFeatureRepo.ensureSubscriptionAllowances(
      userId,
      resolveTier(user?.subscriptionType),
    );

    const updatedWallet = await premiumFeatureRepo.useBoost(userId, 30);

    if (!updatedWallet) {
      throw new PaymentRequiredError(
        "You are out of Takeoff boosts. Please upgrade or buy more.",
        { code: "INSUFFICIENT_BOOSTS" },
      );
    }

    logger.info(
      {
        userId,
        feature: "boosts",
        boostsRemaining: updatedWallet.boostsRemaining,
        addOnBoostsRemaining: updatedWallet.addOnBoostsRemaining,
      },
      "takeoff boost activated",
    );

    await cacheUtils.invalidateUserDiscoveryCache(userId);

    userRepo
      .getUserById(userId)
      .then((user) => {
        if (!user) return;
        return sendBoostStartedNotification(user);
      })
      .catch((err) =>
        logger.error(
          { err, userId },
          "[Premium] Failed to send boost started notification",
        ),
      );

    return updatedWallet;
  },

  getBoostMultiplier: async (userId: string): Promise<number> => {
    const premium = await premiumFeatureRepo.getFeaturesByUserId(userId);

    if (!premium || !premium.visibilityBoost) return 1;

    if (premium.expiresAt && new Date(premium.expiresAt) < new Date()) {
      return 1;
    }

    let multiplier = 6;

    if (
      premium.lastBoostedAt &&
      new Date(premium.lastBoostedAt) >
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    ) {
      multiplier = 8;
    }

    return multiplier;
  },

  getBoostMultipliers: async (
    userIds: string[],
  ): Promise<Record<string, number>> => {
    if (!userIds.length) return {};

    const statuses = await premiumFeatureRepo.getFeaturesByUserIds(userIds);

    const now = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const multipliersMap: Record<string, number> = {};

    for (const premium of statuses) {
      if (!premium.visibilityBoost) {
        multipliersMap[premium.userId] = 1;
        continue;
      }

      if (premium.expiresAt && new Date(premium.expiresAt) < now) {
        multipliersMap[premium.userId] = 1;
        continue;
      }

      let multiplier = 6;

      if (
        premium.lastBoostedAt &&
        new Date(premium.lastBoostedAt) > oneDayAgo
      ) {
        multiplier = 8;
      }

      multipliersMap[premium.userId] = multiplier;
    }

    for (const id of userIds) {
      if (!(id in multipliersMap)) {
        multipliersMap[id] = 1;
      }
    }

    return multipliersMap;
  },

  cleanupExpiredBoosts: async () => {
    try {
      const expiredUsers = await premiumFeatureRepo.deactivateExpiredBoosts();

      if (!expiredUsers.length) return;

      logger.info(
        { expiredBoostCount: expiredUsers.length },
        "deactivated expired boosts",
      );

      await Promise.all(
        expiredUsers.map(async (expiredUser) => {
          await cacheUtils.invalidateUserDiscoveryCache(expiredUser.userId);

          const user = await userRepo.getUserById(expiredUser.userId);
          if (!user) return;

          await sendBoostEndedNotification(user);
        }),
      );
    } catch (error) {
      logger.error({ error }, "[Premium] Error cleaning up expired boosts");
    }
  },
};