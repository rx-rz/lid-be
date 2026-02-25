import { rouletteRepo } from "../../repo/roulette.repo";

const MATCH_DURATION_MS = 2 * 60 * 1000;
const REMATCH_PREVENTION_COUNT = 5;

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return "less than a minute";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes <= 0) return `${seconds} seconds`;
  if (minutes === 1)
    return seconds > 0 ? `1 minute ${seconds} seconds` : "1 minute";
  return seconds > 0
    ? `${minutes} minutes ${seconds} seconds`
    : `${minutes} minutes`;
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return "less than a second";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const getStatusText = (match: any): string => {
  if (!match.endedAt && match.timeRemaining > 0) return "Active";
  if (!match.endedAt) return "Ending soon";
  return "Completed";
};

const getUserDetails = async (userId: string) => {
  try {
    return {
      id: userId,
      displayName: "User " + userId.substring(0, 5),
      avatarUrl: `/api/placeholder/40/40`,
    };
  } catch (error) {
    return null;
  }
};

const scheduleMatchEnd = (matchId: string, endTime: Date) => {
  const timeUntilEnd = endTime.getTime() - Date.now();
  if (timeUntilEnd <= 0) {
    rouletteService.endSession(matchId);
    return;
  }
  setTimeout(async () => {
    try {
      await rouletteService.endSession(matchId);
      console.log(`Match ${matchId} automatically ended as scheduled.`);
    } catch (error) {
      console.error(`Failed to end match ${matchId}:`, error);
    }
  }, timeUntilEnd);
};

export const rouletteService = {
  findMatch: async (userId: string) => {
    const existing = await rouletteRepo.findSessionByUserId(userId);

    if (existing) {
      if (existing.status === "matched") {
        const match = await rouletteRepo.getActiveMatchForSession(existing.id);
        if (match) {
          const now = new Date();
          if (match.scheduledEndTime && match.scheduledEndTime < now) {
            await rouletteService.endSession(match.id);
            return {
              message:
                "Your previous match has ended. Looking for a new match now.",
              previousMatchEnded: true,
            };
          }

          const partnerSessionId =
            match.session1Id === existing.id
              ? match.session2Id
              : match.session1Id;
          const partnerSession = await rouletteRepo.getSessionById(
            partnerSessionId!,
          );

          return {
            alreadyMatched: true,
            message: "You're already in an active match!",
            matchDetails: match,
            partnerId: partnerSession?.userId,
          };
        } else {
          await rouletteRepo.updateSession(existing.id, { status: "waiting" });
        }
      }

      if (existing.status === "waiting") {
        return {
          alreadyWaiting: true,
          message: "You're already in the waiting queue. Please be patient!",
        };
      }
    }

    const previousPartners = existing?.previousPartners || [];
    const session = await rouletteRepo.upsertWaitingSession(
      userId,
      previousPartners,
    );

    const partner = await rouletteRepo.findCompatiblePartner(
      userId,
      session.previousPartners || [],
    );
    if (!partner) {
      return {
        matched: false,
        message:
          "You've been added to the waiting queue. We'll match you as soon as possible!",
      };
    }

    const updatedPartner = await rouletteRepo.claimPartner(partner.id);
    if (!updatedPartner) {
      return {
        matched: false,
        message:
          "You've been added to the waiting queue. We'll match you as soon as possible!",
      };
    }

    const updatedPreviousPartners = [
      ...(session.previousPartners || []),
      partner.userId,
    ].slice(-REMATCH_PREVENTION_COUNT);
    await rouletteRepo.updateSession(session.id, {
      status: "matched",
      previousPartners: updatedPreviousPartners,
    });

    const partnerPreviousPartners = [
      ...(partner.previousPartners || []),
      userId,
    ].slice(-REMATCH_PREVENTION_COUNT);
    await rouletteRepo.updateSession(partner.id, {
      previousPartners: partnerPreviousPartners,
    });

    const roomId = crypto.randomUUID();
    const scheduledEndTime = new Date(Date.now() + MATCH_DURATION_MS);

    const matchRecord = await rouletteRepo.createMatchRecord(
      session.id,
      partner.id,
      roomId,
      scheduledEndTime,
    );

    scheduleMatchEnd(matchRecord.id, scheduledEndTime);

    return {
      matched: true,
      message: "Match found! Starting your chat session now.",
      roomId,
      partnerId: partner.userId,
      matchId: matchRecord.id,
      endsAt: scheduledEndTime,
    };
  },

  getDetails: async (userId: string) => {
    const session = await rouletteRepo.findSessionByUserId(userId);
    if (!session) {
      return {
        success: true,
        exists: false,
        message: "No active session found",
      };
    }

    const response: any = {
      success: true,
      exists: true,
      session: {
        id: session.id,
        userId: session.userId,
        partnerId: session.previousPartners?.pop(),
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    };

    if (session.status === "matched") {
      const match = await rouletteRepo.getActiveMatchForSession(session.id);
      if (match) {
        const partnerSessionId =
          match.session1Id === session.id ? match.session2Id : match.session1Id;
        const partnerSession = await rouletteRepo.getSessionById(
          partnerSessionId!,
        );

        const now = Date.now();
        const timeRemaining = match.scheduledEndTime
          ? Math.max(0, match.scheduledEndTime.getTime() - now)
          : 0;

        response.match = {
          id: match.id,
          roomId: match.roomId,
          startedAt: match.startedAt,
          scheduledEndTime: match.scheduledEndTime,
          timeRemaining,
          timeRemainingFormatted: formatTimeRemaining(timeRemaining),
          partnerId: partnerSession?.userId,
        };
      }
    }

    return response;
  },

  endSession: async (matchId?: string, userId?: string) => {
    let targetMatchId = matchId;

    if (!targetMatchId && userId) {
      const session = await rouletteRepo.findSessionByUserId(userId);
      if (!session || session.status !== "matched") {
        return {
          success: false,
          error: "no_active_match",
          message: "User does not have an active match to end",
        };
      }

      const match = await rouletteRepo.getActiveMatchForSession(session.id);
      if (!match) {
        return {
          success: false,
          error: "no_active_match",
          message: "No active match found for this user",
        };
      }
      targetMatchId = match.id;
    }

    if (!targetMatchId) {
      return {
        success: false,
        error: "invalid_request",
        message: "Either matchId or userId is required",
      };
    }

    const existingMatch = await rouletteRepo.getMatchById(targetMatchId);
    if (!existingMatch) return { success: false, message: "Match not found" };

    if (!existingMatch.endedAt) {
      await rouletteRepo.endMatch(targetMatchId);
      await Promise.all([
        rouletteRepo.updateSession(existingMatch.session1Id!, {
          status: "completed",
        }),
        rouletteRepo.updateSession(existingMatch.session2Id!, {
          status: "completed",
        }),
      ]);
      return { success: true, message: "Match ended successfully" };
    }

    return { success: false, message: "Match already ended" };
  },

  getStatus: async (userId: string) => {
    const session = await rouletteRepo.findSessionByUserId(userId);
    if (!session) {
      return {
        success: true,
        exists: false,
        message: "No active session found",
      };
    }

    // Compute status message directly for the return object
    let statusMessage = `Session status: ${session.status}`;
    if (session.status === "waiting")
      statusMessage = "Looking for a match. Please wait...";
    if (session.status === "completed")
      statusMessage = "Your previous session has ended.";

    let matchDetails = null;
    if (session.status === "matched") {
      const match = await rouletteRepo.getActiveMatchForSession(session.id);

      if (match) {
        const now = new Date();

        if (match.scheduledEndTime && match.scheduledEndTime < now) {
          await rouletteService.endSession(match.id);
          return {
            success: true,
            exists: true,
            session: {
              ...session,
              status: "completed",
              statusMessage: "Match completed - time expired",
            },
            message: "Your match has ended due to time expiration.",
          };
        }

        const partnerSessionId =
          match.session1Id === session.id ? match.session2Id : match.session1Id;
        const partnerSession = await rouletteRepo.getSessionById(
          partnerSessionId!,
        );

        const timeRemaining = Math.max(
          0,
          match.scheduledEndTime!.getTime() - now.getTime(),
        );
        const totalDuration =
          match.scheduledEndTime && match.startedAt
            ? match.scheduledEndTime.getTime() - match.startedAt.getTime()
            : MATCH_DURATION_MS;
        const progress =
          totalDuration > 0
            ? Math.min(
                100,
                ((totalDuration - timeRemaining) / totalDuration) * 100,
              )
            : 100;

        let partnerDetails = null;
        if (partnerSession?.userId) {
          partnerDetails = await getUserDetails(partnerSession.userId);
        }

        statusMessage = "In active match";
        if (timeRemaining < 30000)
          statusMessage = "In active match with less than 30 seconds remaining";
        else if (timeRemaining < 60000)
          statusMessage = "In active match with less than a minute remaining";
        else
          statusMessage = `In active match with ${Math.ceil(timeRemaining / 60000)} minutes remaining`;

        matchDetails = {
          id: match.id,
          roomId: match.roomId,
          startedAt: match.startedAt,
          scheduledEndTime: match.scheduledEndTime,
          timeRemaining,
          progress,
          timeRemainingFormatted: formatTimeRemaining(timeRemaining),
          partnerId: partnerSession?.userId,
          partner: partnerDetails,
        };
      } else {
        await rouletteRepo.updateSession(session.id, { status: "completed" });
        statusMessage = "Previous match has ended.";
      }
    }

    return {
      success: true,
      exists: true,
      session: { ...session, statusMessage },
      match: matchDetails,
    };
  },

  cancelSearch: async (userId: string) => {
    const session = await rouletteRepo.findSessionByUserId(userId);
    if (!session)
      return {
        success: false,
        action: "no_session",
        message: "No active session found to cancel",
      };

    if (session.status === "matched") {
      const match = await rouletteRepo.getActiveMatchForSession(session.id);
      if (match) {
        await rouletteService.endSession(match.id);
        return {
          success: true,
          action: "match_ended",
          message: "Successfully left the current match",
        };
      }
      await rouletteRepo.updateSession(session.id, { status: "completed" });
      return {
        success: true,
        action: "session_updated",
        message: "Session status updated",
      };
    }

    if (session.status === "waiting") {
      await rouletteRepo.updateSession(session.id, { status: "completed" });
      return {
        success: true,
        action: "search_cancelled",
        message: "Successfully cancelled search",
      };
    }

    return {
      success: true,
      action: "already_completed",
      message: "Session was already completed",
    };
  },

  getHistory: async (userId: string, limit: number) => {
    const matches = await rouletteRepo.getUserMatchHistory(userId, limit);

    const formattedHistory = await Promise.all(
      matches.map(async (match) => {
        const session = await rouletteRepo.findSessionByUserId(userId);
        const isSession1 = session && match.session1Id === session.id;
        const partnerSessionId = isSession1
          ? match.session2Id
          : match.session1Id;

        let partnerSession = null;
        if (partnerSessionId)
          partnerSession = await rouletteRepo.getSessionById(partnerSessionId);

        let partnerDetails = null;
        if (partnerSession?.userId)
          partnerDetails = await getUserDetails(partnerSession.userId);

        let duration = null;
        let status = "active";

        if (match.endedAt && match.startedAt) {
          duration = match.endedAt.getTime() - match.startedAt.getTime();
          status = "completed";
        } else if (
          match.scheduledEndTime &&
          match.scheduledEndTime < new Date()
        ) {
          status = "expired";
          if (match.startedAt)
            duration =
              match.scheduledEndTime.getTime() - match.startedAt.getTime();
        }

        let timeRemaining = 0;
        if (status === "active" && match.scheduledEndTime) {
          timeRemaining = Math.max(
            0,
            match.scheduledEndTime.getTime() - Date.now(),
          );
        }

        return {
          id: match.id,
          roomId: match.roomId,
          startedAt: match.startedAt,
          endedAt: match.endedAt,
          scheduledEndTime: match.scheduledEndTime,
          status,
          duration,
          durationFormatted: duration ? formatDuration(duration) : null,
          timeRemaining,
          timeRemainingFormatted: timeRemaining
            ? formatTimeRemaining(timeRemaining)
            : null,
          statusText: getStatusText({ endedAt: match.endedAt, timeRemaining }),
          partner: {
            userId: partnerSession?.userId,
            ...partnerDetails,
          },
        };
      }),
    );

    return { success: true, history: formattedHistory };
  },

  cleanupExpired: async () => {
    const expiredMatches = await rouletteRepo.getExpiredMatches(new Date());

    const results = await Promise.all(
      expiredMatches.map((match) => rouletteService.endSession(match.id)),
    );

    const successful = results.filter((r) => r.success).length;

    return {
      success: true,
      ended: successful,
      message:
        successful > 0
          ? `Successfully ended ${successful} expired matches`
          : "No expired matches needed ending",
    };
  },

  getStats: async () => {
    const stats = await rouletteRepo.getSystemStats();
    return { success: true, stats };
  },
};
