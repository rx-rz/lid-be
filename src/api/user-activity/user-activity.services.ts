import { userActivityRepo } from "../../repo/user-activity.repo";
import { logger } from "../../utils/logger";
import { ably } from "../../utils/websocket";

const presenceChannel = ably.channels.get("user-presence");

export const userActivityService = {
  updateUserStatus: async (userId: string, onlineStatus: boolean) => {
    try {
      await userActivityRepo.upsertUserStatus(userId, onlineStatus);

      await presenceChannel.publish("onlineStatusUpdated", {
        userId,
        onlineStatus,
      });
    } catch (error) {
      logger.error(
        { err: error, userId, onlineStatus },
        "[UserActivity] Failed to update user status",
      );
    }
  },
};
