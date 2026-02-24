import { profileViewsRepo } from "../../repo/profile-views.repo";
import { userRepo } from "../../repo/user.repo";
import { logger } from "../../utils/logger";
import { ably } from "../../utils/websocket";

export const profileViewsService = {
  recordView: async (viewerId: string, viewedId: string) => {
    if (viewerId === viewedId) throw new Error("Cannot view your own profile");

    const viewerExists = await userRepo.getUserById(viewerId);
    const viewedExists = await userRepo.checkUserExists(viewedId);

    if (!viewerExists || !viewedExists) {
      throw new Error("One or both users not found");
    }

    const view = await profileViewsRepo.upsertProfileView(viewerId, viewedId);

    try {
      const channel = ably.channels.get(`user:${viewedId}:views`);
      await channel.publish("new-view", {
        viewerId,
        viewedId,
        viewedAt: view.viewedAt,
        viewerName: viewerExists.displayName,
        viewerImage: viewerExists.image, 
      });
    } catch (ablyError) {
      logger.error({ err: ablyError }, "Ably notification failed");
    }

    return view;
  },

  getViews: async (
    userId: string,
    limit: number,
    offset: number,
    markAsSeen: boolean,
  ) => {
    const userExists = await userRepo.checkUserExists(userId);
    if (!userExists) throw new Error("User does not exist");

    const allViews = await profileViewsRepo.getProfileViewsByUserId(userId);

    // Process in JavaScript to get unique viewers with their most recent view
    const viewerMap = new Map();
    for (const view of allViews) {
      if (!viewerMap.has(view.viewerId)) {
        viewerMap.set(view.viewerId, view);
      }
    }

    // Convert map values to array, sort, paginate, and strip viewerId
    const uniqueViews = Array.from(viewerMap.values())
      .sort(
        (a, b) =>
          new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime(),
      )
      .slice(offset, offset + limit)
      .map(({ viewerId, ...rest }) => rest);

    if (markAsSeen) {
      await profileViewsRepo.markViewsAsSeen(userId);
    }

    return uniqueViews;
  },

  clearOldViews: async () => {
    return await profileViewsRepo.deleteOldViews(7); // Clear views older than 7 days
  },
};
