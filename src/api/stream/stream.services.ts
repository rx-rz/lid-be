import { StreamClient } from "@stream-io/node-sdk";
import { BadRequestError, InternalServerError } from "../../middleware/error";
import { interactionRepo } from "../../repo/interaction.repo";
import { matchRepo } from "../../repo/match.repo";
import { userRepo, type UserConversationProfile } from "../../repo/user.repo";
import { streamClient } from "../../services/stream.services";
import { decodeCursor, encodeCursor } from "../../utils/cursor";

const apiKey = process.env.STREAM_API_KEY;
const secret = process.env.STREAM_API_SECRET;

if (!apiKey || !secret) {
  throw new InternalServerError("Stream configuration missing.", {
    code: "STREAM_CONFIGURATION_MISSING",
  });
}

const client = new StreamClient(apiKey, secret);

type ConversationsCursor = {
  offset: number;
};

type StreamMember = {
  user_id?: string;
  user?: {
    id?: string;
    name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type ConversationParticipant = {
  id: string;
  name: string | null;
  displayName: string | null;
  imageUrl: string | null;
};

const getConversationAccess = async (userId: string, participantId: string) => {
  const [match, loveLetterSent, loveLetterReceived] = await Promise.all([
    matchRepo.getMatchBetweenUsers(userId, participantId),
    interactionRepo.getExistingLoveLetterLike(userId, participantId),
    interactionRepo.getExistingLoveLetterLike(participantId, userId),
  ]);

  const hasMatch = Boolean(match);
  const hasLoveLetter = Boolean(loveLetterSent || loveLetterReceived);

  return {
    isMatched: hasMatch,
    hasLoveLetter,
    canChat: hasMatch,
    chatUnlockReason: hasMatch
      ? "match"
      : hasLoveLetter
        ? "love_letter_pending_match"
        : null,
    matchId: match?.id ?? null,
  };
};

const clampLimit = (limit?: number) => {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(Math.max(Number(limit), 1), 50);
};

const decodeConversationsCursor = (cursor?: string | null) => {
  if (!cursor) return { offset: 0 };

  const decoded = decodeCursor<ConversationsCursor>(cursor);
  if (!decoded || !Number.isInteger(decoded.offset) || decoded.offset < 0) {
    throw new BadRequestError("Invalid conversations cursor.", {
      code: "INVALID_CONVERSATIONS_CURSOR",
    });
  }

  return decoded;
};

const getMemberUserId = (member: StreamMember) =>
  member.user_id ?? member.user?.id ?? "";

const getMemberName = (member?: StreamMember) =>
  member?.user?.name ?? (member?.user as any)?.displayName ?? null;

const getLatestMessage = (messages: any[] = []) => {
  if (messages.length <= 1) return messages[0] ?? null;

  return [...messages].sort((a, b) => {
    const aTime = new Date(a?.created_at ?? 0).getTime();
    const bTime = new Date(b?.created_at ?? 0).getTime();
    return bTime - aTime;
  })[0];
};

const buildParticipant = (
  member: StreamMember | undefined,
  dbProfile: UserConversationProfile | undefined,
): ConversationParticipant | null => {
  const id = member ? getMemberUserId(member) : dbProfile?.id;
  if (!id) return null;

  return {
    id,
    name: getMemberName(member),
    displayName: dbProfile?.displayName ?? null,
    imageUrl: dbProfile?.images[0]?.imageUrl ?? null,
  };
};

export const streamService = {
  getApiKey: () => apiKey,

  generateToken: async (data: {
    userId: string;
    name?: string;
    image?: string;
    email?: string;
  }) => {
    const { userId, name, image, email } = data;

    await client.upsertUsers([
      {
        id: userId,
        role: "user",
        name: name || userId,
        image: image || "",
        custom: { email: email || "" },
      },
    ]);
    const validityInSeconds = 10 * 365 * 24 * 60 * 60;

    const token = client.generateUserToken({
      user_id: userId,
      validity_in_seconds: validityInSeconds,
    });

    return { token, userId, apiKey };
  },

  getConversations: async (data: {
    userId: string;
    cursor?: string | null;
    limit?: number;
  }) => {
    const userExists = await userRepo.checkUserExists(data.userId);
    if (!userExists) {
      throw new BadRequestError("User not found.", {
        code: "USER_NOT_FOUND",
      });
    }

    const limit = clampLimit(data.limit);
    const { offset } = decodeConversationsCursor(data.cursor);

    const channels = await streamClient.queryChannelsRequest(
      {
        type: "messaging",
        members: { $in: [data.userId] },
      } as any,
      [{ last_message_at: -1 }] as any,
      {
        limit,
        offset,
        message_limit: 1,
        member_limit: 30,
        state: true,
        watch: false,
        presence: false,
      },
    );

    const otherMembersByChannel = channels.map((channel: any) => {
      const members: StreamMember[] = channel.members ?? [];
      return members.find((member) => getMemberUserId(member) !== data.userId);
    });

    const participantIds = otherMembersByChannel
      .map((member) => (member ? getMemberUserId(member) : ""))
      .filter(Boolean);

    const profilesById =
      await userRepo.getConversationProfilesByIds(participantIds);

    const conversations = await Promise.all(
      channels.map(async (channel: any, index: number) => {
        const participantMember = otherMembersByChannel[index];
        const participantId = participantMember
          ? getMemberUserId(participantMember)
          : "";
        const participant = buildParticipant(
          participantMember,
          profilesById[participantId],
        );

        return {
          cid: channel.cid,
          id: channel.id,
          type: channel.type,
          participant,
          lastMessage: getLatestMessage(channel.messages ?? []),
          access: participantId
            ? await getConversationAccess(data.userId, participantId)
            : {
                isMatched: false,
                hasLoveLetter: false,
                canChat: false,
                chatUnlockReason: null,
                matchId: null,
              },
        };
      }),
    );

    return {
      conversations,
      nextCursor:
        channels.length === limit
          ? encodeCursor<ConversationsCursor>({ offset: offset + limit })
          : null,
    };
  },
};
