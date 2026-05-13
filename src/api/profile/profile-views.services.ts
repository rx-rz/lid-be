import { profileViewsRepo } from "../../repo/profile-views.repo";
import { userRepo } from "../../repo/user.repo";
import { entitlementService } from "../../services/entitlements";
import { logger } from "../../utils/logger";
import { ably } from "../../utils/websocket";
import { BadRequestError, NotFoundError } from "../../middleware/error";

export const profileViewsService = {
  recordView: async (viewerId: string, viewedId: string) => {
    if (viewerId === viewedId) {
      throw new BadRequestError("Cannot view your own profile.", {
        code: "INVALID_SELF_INTERACTION",
      });
    }

    const viewerExists = await userRepo.getUserDetailsById(viewerId);
    const viewedExists = await userRepo.checkUserExists(viewedId);

    if (!viewerExists || !viewedExists) {
      throw new NotFoundError("One or both users not found.", {
        code: "PROFILE_VIEW_USER_NOT_FOUND",
      });
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
    const user = await userRepo.getUserById(userId);
    if (!user) {
      throw new NotFoundError("User does not exist.", {
        code: "USER_NOT_FOUND",
      });
    }

    const entitlements = entitlementService.getEntitlementsForTier(
      user.subscriptionType,
    );

    if (!entitlements.profileViews) {
      return [];
    }

    const allViews = await profileViewsRepo.getProfileViewsByUserId(userId);

    const viewerMap = new Map();
    for (const view of allViews) {
      if (!viewerMap.has(view.viewerId)) {
        viewerMap.set(view.viewerId, view);
      }
    }

    const calculateAge = (birthdayString: string | null): number | null => {
      if (!birthdayString) return null;
      const today = new Date();
      const birthDate = new Date(birthdayString);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();

      if (
        monthDifference < 0 ||
        (monthDifference === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
      return age;
    };

    const uniqueViews = Array.from(viewerMap.values())
      .sort(
        (a, b) =>
          new Date(b.viewedAt || 0).getTime() -
          new Date(a.viewedAt || 0).getTime(),
      )
      .slice(offset, offset + limit)
      .map(({ viewerId, viewer, ...rest }) => {
        const { birthday, ...viewerRest } = viewer;

        return {
          ...rest,
          viewer: {
            ...viewerRest,
            age: calculateAge(birthday),
          },
        };
      });

    if (markAsSeen) {
      await profileViewsRepo.markViewsAsSeen(userId);
    }

    return uniqueViews;
  },

  clearOldViews: async () => {
    return await profileViewsRepo.deleteOldViews(7); 
  },
};
