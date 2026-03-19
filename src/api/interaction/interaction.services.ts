import { interactionRepo } from "../../repo/interaction.repo";
import { matchRepo } from "../../repo/match.repo";
import { userRepo } from "../../repo/user.repo";
import { fcmAdmin } from "../../services/fcm";
import { logger } from "../../utils/logger";
import { getAge } from "../user/user.services";
import type { SubscriptionTier } from "../../db/schema"; // NEW
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

    // NEW: Handle Super Like deduction before creating the like
    if (superLike) {
      const updatedWallet = await premiumFeatureRepo.useSuperLike(likerId);
      if (!updatedWallet) {
        throw new Error("INSUFFICIENT_SUPERLIKES");
      }
    }

    await enforceSwipeLimit(likerId, likerExists.subscription);

    const like = await interactionRepo.createLike(likerId, likedId, superLike);
    if (!like) throw new Error("Failed to create like");

    const targetFcmToken = likedExists.fcmToken;
    if (targetFcmToken) {
      try {
        await fcmAdmin.messaging().send({
          notification: {
            title: superLike
              ? `🌟 Super Like from ${likerExists.displayName}!`
              : `New Like 💖 from ${likerExists.displayName}`,
            body: `${likerExists.displayName} just liked you! Open the app to check.`,
          },
          token: targetFcmToken,
        });
        logger.info(`Push notification sent to ${likedId}`);
      } catch (err) {
        logger.error({ err }, "[Interaction] Error sending FCM notification");
      }
    }

    const mutualLike = await interactionRepo.getExistingLike(likedId, likerId);
    if (mutualLike) {
      const encounter = await matchRepo.getRouletteEncounter(likerId, likedId);

      if (encounter?.endedAt) {
        const encounterEnd = encounter.endedAt;
        const currentLikeIsAfter = like.likedAt! >= encounterEnd;
        const mutualLikeIsAfter = mutualLike.likedAt! >= encounterEnd;

        if (!currentLikeIsAfter || !mutualLikeIsAfter) {
          return { like };
        }
      }

      const newMatch = await matchRepo.createMatch(likerId, likedId);
      if (!newMatch) throw new Error("Failed to create match");

      logger.info({ likerId, likedId }, "It's a match!");
      return { like, match: newMatch };
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
  // Add this inside interactionService
  rewindDislike: async (dislikerId: string, dislikedId: string) => {
    // 1. Verify the dislike actually exists
    const existingDislike = await interactionRepo.getExistingDislike(
      dislikerId,
      dislikedId,
    );

    if (!existingDislike) {
      throw new Error("Dislike not found or already rewound");
    }

    // 2. Attempt to deduct a Recall from the wallet
    // If they have 0, the repo returns undefined and we throw the payment error
    const updatedWallet = await premiumFeatureRepo.useRecall(dislikerId);
    if (!updatedWallet) {
      throw new Error("INSUFFICIENT_RECALLS");
    }

    // 3. Delete the dislike to return the user to the matching pool
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
