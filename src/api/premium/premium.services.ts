import { premiumFeatureRepo } from "../../repo/premium.repo";
import { userRepo } from "../../repo/user.repo";
import { fcmAdmin } from "../../services/fcm";
import { cacheUtils } from "../../utils/cache.utils";
import { logger } from "../../utils/logger";
import { resolveTier } from "../../services/entitlements";

const sendBoostStartedNotification = async (targetFcmToken: string) => {
  if (!targetFcmToken) return;
  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: "Takeoff Boost Activated! 🚀",
        body: "Your profile is now being prioritized in discovery for the next 30 minutes.",
      },
      token: targetFcmToken,
    });
  } catch (err) {
    logger.error({ err }, "[Premium] Error sending boost started notification");
  }
};

const sendBoostEndedNotification = async (targetFcmToken: string) => {
  if (!targetFcmToken) return;
  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: "Boost Complete 🛬",
        body: "Your 30-minute Takeoff Boost has ended. Check your matches!",
      },
      token: targetFcmToken,
    });
  } catch (err) {
    logger.error({ err }, "[Premium] Error sending boost ended notification");
  }
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
      throw new Error("INSUFFICIENT_BOOSTS");
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
      .getUserDetailsById(userId)
      .then((user) => {
        if (user?.fcmToken) {
          sendBoostStartedNotification(user.fcmToken);
        }
      })
      .catch((err) =>
        logger.error(
          { err },
          "[Premium] Failed to fetch user for boost notification",
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

    let multiplier = 3;
    if (
      premium.lastBoostedAt &&
      new Date(premium.lastBoostedAt) >
        new Date(Date.now() - 24 * 60 * 60 * 1000)
    ) {
      multiplier = 4;
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

      let multiplier = 3;
      if (
        premium.lastBoostedAt &&
        new Date(premium.lastBoostedAt) > oneDayAgo
      ) {
        multiplier = 4;
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

      if (expiredUsers.length > 0) {
        logger.info(
          { expiredBoostCount: expiredUsers.length },
          "deactivated expired boosts",
        );
        await Promise.all(
          expiredUsers.map(async (u) => {
            await cacheUtils.invalidateUserDiscoveryCache(u.userId);
            const user = await userRepo.getUserDetailsById(u.userId);
            if (user?.fcmToken) {
              await sendBoostEndedNotification(user.fcmToken);
            }
          }),
        );
      }
    } catch (error) {
      logger.error({ error }, "[Premium] Error cleaning up expired boosts");
    }
  },
};
