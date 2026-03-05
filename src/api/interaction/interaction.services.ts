import { interactionRepo } from "../../repo/interaction.repo";
import { matchRepo } from "../../repo/match.repo";
import { userRepo } from "../../repo/user.repo";
import { fcmAdmin } from "../../services/fcm";
import { logger } from "../../utils/logger";

const enforceSwipeLimit = async (
  userId: string,
  subscriptionType: string | null,
) => {
  if (subscriptionType === "free" || subscriptionType === null) {
    await interactionRepo.checkAndIncrementSwipeLimit(userId);
  }
};
export const interactionService = {
  likeUser: async (
    likerId: string,
    likedId: string,
    superLike: boolean = false,
  ) => {
    if (likerId === likedId) throw new Error("You cannot like yourself");

    const likerExists = await userRepo.getUserWithFcmToken(likerId);
    const likedExists = await userRepo.getUserWithFcmToken(likedId);

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

    const like = await interactionRepo.createLike(likerId, likedId, superLike);
    await enforceSwipeLimit(likerId, likerExists.subscription);

    if (!like) throw new Error("Failed to create like");

    const targetFcmToken = likedExists.fcmToken;
    if (targetFcmToken) {
      try {
        await fcmAdmin.messaging().send({
          notification: {
            title: `New Like 💖 from ${likerExists.displayName}`,
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

    const dislikerExists = await userRepo.getUserWithFcmToken(dislikerId);
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
    return await interactionRepo.getLikedUsers(userId);
  },

  getReceivedLikes: async (userId: string) => {
    return await interactionRepo.getReceivedLikes(userId);
  },
};
