import { interactionRepo } from "../../repo/interaction.repo";
import { matchRepo } from "../../repo/match.repo";
import { userRepo } from "../../repo/user.repo";
import { fcmAdmin } from "../../services/fcm";
import { logger } from "../../utils/logger";
import { getAge } from "../user/user.services";
import type { SubscriptionTier } from "../../db/schema";
import { TIER_PERMISSIONS } from "../../utils/permissions";
import { premiumFeatureRepo } from "../../repo/premium.repo";

const enforceSwipeLimit = async (
  userId: string,
  subscriptionType: string | null,
) => {
  const tier = (subscriptionType as SubscriptionTier) || "economy";
  const limit = TIER_PERMISSIONS[tier].dailySwipes;

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

export const sendLikeNotification = async (
  targetFcmToken: string,
  likerName: string,
  isSuperLike: boolean,
) => {
  if (!targetFcmToken) return;

  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: isSuperLike
          ? `🌟 Super Like from ${likerName}!`
          : `New Like 💖 from ${likerName}`,
        body: `${likerName} just liked you! Open the app to check.`,
      },
      token: targetFcmToken,
    });
    logger.info(`Like push notification sent successfully`);
  } catch (err) {
    logger.error({ err }, "[Interaction] Error sending FCM like notification");
  }
};

export const sendMatchNotification = async (
  targetFcmToken: string,
  partnerName: string,
) => {
  if (!targetFcmToken) return;

  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: `It's a Match! 🎉`,
        body: `You and ${partnerName} liked each other. Send a message!`,
      },
      token: targetFcmToken,
    });
    logger.info(`Match push notification sent successfully`);
  } catch (err) {
    logger.error({ err }, "[Interaction] Error sending FCM match notification");
  }
};

export const interactionService = {
  likeUser: async (
    likerId: string,
    likedId: string,
    superLike: boolean = false,
  ) => {
    if (likerId === likedId) throw new Error("You cannot like yourself");

    const likerExists = await userRepo.getUserById(likerId);
    const likedExists = await userRepo.getUserById(likedId);

    if (!likerExists || !likedExists) {
      throw new Error("One or both users do not exist");
    }

    const existingLike = await interactionRepo.getExistingLike(
      likerId,
      likedId,
    );
    if (existingLike) {
      throw new Error("Like already exists");
    }

    if (superLike) {
      const updatedWallet = await premiumFeatureRepo.useSuperLike(likerId);
      if (!updatedWallet) {
        throw new Error("INSUFFICIENT_SUPERLIKES");
      }
    }

    await enforceSwipeLimit(likerId, likerExists.subscription);

    const like = await interactionRepo.createLike(likerId, likedId, superLike);
    if (!like) throw new Error("Failed to create like");

    const mutualLike = await interactionRepo.getExistingLike(likedId, likerId);

    if (mutualLike) {
      const encounter = await matchRepo.getRouletteEncounter(likerId, likedId);

      if (encounter?.endedAt) {
        const encounterEnd = encounter.endedAt;
        const currentLikeIsAfter = like.likedAt! >= encounterEnd;
        const mutualLikeIsAfter = mutualLike.likedAt! >= encounterEnd;

        if (!currentLikeIsAfter || !mutualLikeIsAfter) {
          if (likedExists.fcmToken) {
            sendLikeNotification(
              likedExists.fcmToken,
              likerExists.displayName || "Someone",
              superLike,
            );
          }
          return { like };
        }
      }

      const newMatch = await matchRepo.createMatch(likerId, likedId);
      if (!newMatch) throw new Error("Failed to create match");

      if (likedExists.fcmToken) {
        sendMatchNotification(
          likedExists.fcmToken,
          likerExists.displayName || "Someone",
        );
      }
      if (likerExists.fcmToken) {
        sendMatchNotification(
          likerExists.fcmToken,
          likedExists.displayName || "Someone",
        );
      }

      logger.info({ likerId, likedId }, "It's a match!");
      return { like, match: newMatch };
    }

    if (likedExists.fcmToken) {
      sendLikeNotification(
        likedExists.fcmToken,
        likerExists.displayName || "Someone",
        superLike,
      );
    }

    return { like };
  },

  dislikeUser: async (dislikerId: string, dislikedId: string) => {
    if (dislikerId === dislikedId)
      throw new Error("You cannot dislike yourself");

    const dislikerExists = await userRepo.getUserById(dislikerId);
    const dislikedExists = await userRepo.checkUserExists(dislikedId);

    if (!dislikerExists || !dislikedExists) {
      throw new Error("One or both users do not exist");
    }

    const existingLike = await interactionRepo.getExistingLike(
      dislikerId,
      dislikedId,
    );
    if (existingLike) {
      throw new Error("Cannot dislike a user you have already liked");
    }

    const existingDislike = await interactionRepo.getExistingDislike(
      dislikerId,
      dislikedId,
    );
    if (existingDislike) {
      throw new Error("Dislike already exists");
    }

    await enforceSwipeLimit(dislikerId, dislikerExists.subscription);

    const dislike = await interactionRepo.createDislike(dislikerId, dislikedId);
    if (!dislike) throw new Error("Failed to create dislike");

    return dislike;
  },

  getLikedUsers: async (userId: string) => {
    const likedUsers = await interactionRepo.getLikedUsers(userId);
    return likedUsers.map(formatUserWithAge);
  },

  getReceivedLikes: async (userId: string) => {
    const receivedLikes = await interactionRepo.getReceivedLikes(userId);
    return receivedLikes.map(formatUserWithAge);
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
      throw new Error("Dislike not found or already rewound");
    }

    const updatedWallet = await premiumFeatureRepo.useRecall(dislikerId);
    if (!updatedWallet) {
      throw new Error("INSUFFICIENT_RECALLS");
    }

    await interactionRepo.deleteDislike(dislikerId, dislikedId);

    logger.info(
      `[Interaction] User ${dislikerId} rewound dislike for ${dislikedId}. ${updatedWallet.recallsRemaining} recalls left.`,
    );

    return {
      success: true,
      message: "Successfully rewound dislike",
      recallsRemaining: updatedWallet.recallsRemaining,
    };
  },
};
