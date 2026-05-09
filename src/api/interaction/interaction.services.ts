import { Expo, type ExpoPushMessage } from "expo-server-sdk";

import { interactionRepo } from "../../repo/interaction.repo";
import { matchRepo } from "../../repo/match.repo";
import { userRepo } from "../../repo/user.repo";
import { fcmAdmin } from "../../services/fcm";
import { logger } from "../../utils/logger";
import { getAge } from "../user/user.services";
import { premiumFeatureRepo } from "../../repo/premium.repo";
import { entitlementService, resolveTier } from "../../services/entitlements";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  PaymentRequiredError,
} from "../../middleware/error";

const expo = new Expo();

const enforceSwipeLimit = async (
  userId: string,
  subscriptionType: string | null,
) => {
  const limit = entitlementService.getDailySwipeLimit(subscriptionType);

  if (limit !== "unlimited") {
    await interactionRepo.checkAndIncrementSwipeLimit(userId, limit);
  }
};

const formatUserWithAge = ({ user, ...rest }: any) => {
  if (!user) {
    return { ...rest, user: null };
  }

  const { birthday, ...userRest } = user;

  return {
    ...rest,
    user: {
      ...userRest,
      age: getAge(birthday),
    },
  };
};

type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const sendExpoNotifications = async (
  targetUserId: string,
  payload: NotificationPayload,
) => {
  const pushTokens = await userRepo.getEnabledPushTokensByUserId(targetUserId);

  const expoMessages: ExpoPushMessage[] = pushTokens
    .filter((pushToken) => pushToken.provider === "expo")
    .filter((pushToken) => Expo.isExpoPushToken(pushToken.token))
    .map((pushToken) => ({
      to: pushToken.token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }));

  if (!expoMessages.length) return;

  const chunks = expo.chunkPushNotifications(expoMessages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      logger.info(
        {
          notificationProvider: "expo",
          targetUserId,
          tickets,
        },
        "expo push notification sent",
      );
    } catch (err) {
      logger.error(
        { err, targetUserId },
        "[Interaction] Error sending Expo push notification",
      );
    }
  }
};

const sendLegacyFcmNotification = async (
  targetFcmToken: string | null | undefined,
  payload: NotificationPayload,
) => {
  if (!targetFcmToken) return;

  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: Object.fromEntries(
        Object.entries(payload.data ?? {}).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
      token: targetFcmToken,
    });

    logger.info(
      { notificationProvider: "fcm" },
      "legacy fcm push notification sent",
    );
  } catch (err) {
    logger.error(
      { err },
      "[Interaction] Error sending legacy FCM push notification",
    );
  }
};

const sendPushNotificationToUser = async (
  targetUser: {
    id: string;
    fcmToken?: string | null;
  },
  payload: NotificationPayload,
) => {
  await Promise.all([
    sendExpoNotifications(targetUser.id, payload),
    sendLegacyFcmNotification(targetUser.fcmToken, payload),
  ]);
};

export const sendLikeNotification = async (
  targetUser: {
    id: string;
    fcmToken?: string | null;
  },
  likerName: string,
  isSuperLike: boolean,
) => {
  await sendPushNotificationToUser(targetUser, {
    title: isSuperLike
      ? `🌟 Super Like from ${likerName}!`
      : `New Like 💖 from ${likerName}`,
    body: `${likerName} just liked you! Open the app to check.`,
    data: {
      type: "LIKE",
      isSuperLike,
    },
  });
};

export const sendMatchNotification = async (
  targetUser: {
    id: string;
    fcmToken?: string | null;
  },
  partnerName: string,
) => {
  await sendPushNotificationToUser(targetUser, {
    title: "It's a Match! 🎉",
    body: `You and ${partnerName} liked each other. Send a message!`,
    data: {
      type: "MATCH",
    },
  });
};

export const interactionService = {
  likeUser: async (
    likerId: string,
    likedId: string,
    superLike: boolean = false,
  ) => {
    if (likerId === likedId) {
      throw new BadRequestError("You cannot like yourself.", {
        code: "INVALID_SELF_INTERACTION",
      });
    }

    const likerExists = await userRepo.getUserDetailsById(likerId);
    const likedExists = await userRepo.getUserDetailsById(likedId);

    if (!likerExists || !likedExists) {
      throw new NotFoundError("One or both users do not exist.", {
        code: "INTERACTION_USER_NOT_FOUND",
      });
    }

    const existingLike = await interactionRepo.getExistingLike(
      likerId,
      likedId,
    );

    if (existingLike) {
      throw new ConflictError("Like already exists.", {
        code: "LIKE_ALREADY_EXISTS",
      });
    }

    if (superLike) {
      await premiumFeatureRepo.ensureSubscriptionAllowances(
        likerId,
        resolveTier(likerExists.subscription),
      );

      const updatedWallet = await premiumFeatureRepo.useSuperLike(likerId);

      if (!updatedWallet) {
        throw new PaymentRequiredError(
          "You are out of Super Likes. Please upgrade or buy more.",
          { code: "INSUFFICIENT_SUPERLIKES" },
        );
      }

      logger.info(
        {
          userId: likerId,
          feature: "superlikes",
          remaining: updatedWallet.superlikesRemaining,
        },
        "usage consumed",
      );
    }

    await enforceSwipeLimit(likerId, likerExists.subscription);

    const like = await interactionRepo.createLike(likerId, likedId, superLike);
    if (!like) throw new InternalServerError("Failed to create like.");

    const mutualLike = await interactionRepo.getExistingLike(likedId, likerId);

    if (mutualLike) {
      const encounter = await matchRepo.getRouletteEncounter(likerId, likedId);

      if (encounter?.endedAt) {
        const encounterEnd = encounter.endedAt;
        const currentLikeIsAfter = like.likedAt! >= encounterEnd;
        const mutualLikeIsAfter = mutualLike.likedAt! >= encounterEnd;

        if (!currentLikeIsAfter || !mutualLikeIsAfter) {
          void sendLikeNotification(
            likedExists,
            likerExists.displayName || "Someone",
            superLike,
          );

          return { like };
        }
      }

      const newMatch = await matchRepo.createMatch(likerId, likedId);
      if (!newMatch) throw new InternalServerError("Failed to create match.");

      void sendMatchNotification(
        likedExists,
        likerExists.displayName || "Someone",
      );

      void sendMatchNotification(
        likerExists,
        likedExists.displayName || "Someone",
      );

      logger.info({ likerId, likedId }, "It's a match!");

      return { like, match: newMatch };
    }

    void sendLikeNotification(
      likedExists,
      likerExists.displayName || "Someone",
      superLike,
    );

    return { like };
  },

  dislikeUser: async (dislikerId: string, dislikedId: string) => {
    if (dislikerId === dislikedId) {
      throw new BadRequestError("You cannot dislike yourself.", {
        code: "INVALID_SELF_INTERACTION",
      });
    }

    const dislikerExists = await userRepo.getUserDetailsById(dislikerId);
    const dislikedExists = await userRepo.checkUserExists(dislikedId);

    if (!dislikerExists || !dislikedExists) {
      throw new NotFoundError("One or both users do not exist.", {
        code: "INTERACTION_USER_NOT_FOUND",
      });
    }

    const existingLike = await interactionRepo.getExistingLike(
      dislikerId,
      dislikedId,
    );

    if (existingLike) {
      throw new ConflictError("Cannot dislike a user you have already liked.", {
        code: "LIKE_ALREADY_EXISTS",
      });
    }

    const existingDislike = await interactionRepo.getExistingDislike(
      dislikerId,
      dislikedId,
    );

    if (existingDislike) {
      throw new ConflictError("Dislike already exists.", {
        code: "DISLIKE_ALREADY_EXISTS",
      });
    }

    await enforceSwipeLimit(dislikerId, dislikerExists.subscription);

    const dislike = await interactionRepo.createDislike(dislikerId, dislikedId);
    if (!dislike) throw new InternalServerError("Failed to create dislike.");

    return dislike;
  },

  getLikedUsers: async (userId: string) => {
    const likedUsers = await interactionRepo.getLikedUsers(userId);
    return likedUsers.map(formatUserWithAge);
  },

  getReceivedLikes: async (userId: string) => {
    const user = await userRepo.getUserById(userId);
    const limit = entitlementService.getMyLikesLimit(user?.subscriptionType);
    const receivedLikes = await interactionRepo.getReceivedLikes(userId);
    const visibleLikes =
      limit === false ? receivedLikes : receivedLikes.slice(0, limit);

    return visibleLikes.map(formatUserWithAge);
  },

  getMutualLikes: async (userId: string) => {
    const mutualLikes = await interactionRepo.getMutualLikes(userId);
    return mutualLikes.map(formatUserWithAge);
  },

  rewindDislike: async (dislikerId: string, dislikedId: string) => {
    const existingDislike = await interactionRepo.getExistingDislike(
      dislikerId,
      dislikedId,
    );

    if (!existingDislike) {
      throw new NotFoundError("Dislike not found or already rewound.", {
        code: "DISLIKE_NOT_FOUND",
      });
    }

    const user = await userRepo.getUserById(dislikerId);
    const recallAllowance = entitlementService.getSubscriptionAllowance(
      user?.subscriptionType,
      "recalls",
    );

    if (recallAllowance === "unlimited") {
      await interactionRepo.deleteDislike(dislikerId, dislikedId);

      logger.info(
        {
          dislikerId,
          dislikedId,
          recallsRemaining: 0,
        },
        "dislike rewound",
      );

      return {
        success: true,
        message: "Successfully rewound dislike",
        recallsRemaining: 0,
      };
    }

    await premiumFeatureRepo.ensureSubscriptionAllowances(
      dislikerId,
      resolveTier(user?.subscriptionType),
    );

    const updatedWallet = await premiumFeatureRepo.useRecall(dislikerId);

    if (!updatedWallet) {
      throw new PaymentRequiredError(
        "You are out of Recalls. Please upgrade or buy more.",
        { code: "INSUFFICIENT_RECALLS" },
      );
    }

    await interactionRepo.deleteDislike(dislikerId, dislikedId);

    logger.info(
      {
        dislikerId,
        dislikedId,
        recallsRemaining: updatedWallet.recallsRemaining,
      },
      "dislike rewound",
    );

    return {
      success: true,
      message: "Successfully rewound dislike",
      recallsRemaining: updatedWallet.recallsRemaining,
    };
  },
};