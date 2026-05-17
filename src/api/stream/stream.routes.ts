import { Elysia, t } from "elysia";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";

import { streamService } from "./stream.services";
import { streamClient } from "../../services/stream.services";
import { fcmAdmin } from "../../services/fcm";
import { logger } from "../../utils/logger";
import { matchRepo } from "../../repo/match.repo";
import { userRepo } from "../../repo/user.repo";
import { entitlementService, resolveTier } from "../../services/entitlements";
import { premiumFeatureRepo } from "../../repo/premium.repo";
import {
  BadRequestError,
  ForbiddenError,
  PaymentRequiredError,
  UnauthorizedError,
} from "../../middleware/error";
import { authMiddleware } from "../../middleware/auth";

const expo = new Expo();

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const normalizePushData = (data?: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [key, String(value)]),
  );
};

const sendExpoPushToUser = async (userId: string, payload: PushPayload) => {
  const pushTokens = await userRepo.getEnabledPushTokensByUserId(userId);

  const messages: ExpoPushMessage[] = pushTokens
    .filter((pushToken) => pushToken.provider === "expo")
    .filter((pushToken) => Expo.isExpoPushToken(pushToken.token))
    .map((pushToken) => ({
      to: pushToken.token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }));

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);

      logger.info(
        {
          provider: "expo",
          userId,
          tickets,
        },
        "[Stream] Expo push notification sent",
      );
    } catch (err) {
      logger.error(
        { err, userId },
        "[Stream] Error sending Expo push notification",
      );
    }
  }
};

const sendLegacyFcmPush = async (
  fcmToken: string | null | undefined,
  payload: PushPayload,
  options?: {
    highPriority?: boolean;
  },
) => {
  if (!fcmToken) return;

  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: normalizePushData(payload.data),
      token: fcmToken,
      ...(options?.highPriority
        ? {
            android: {
              priority: "high" as const,
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
            },
          }
        : {}),
    });

    logger.info(
      { provider: "fcm" },
      "[Stream] Legacy FCM push notification sent",
    );
  } catch (err) {
    logger.error(
      { err },
      "[Stream] Error sending legacy FCM push notification",
    );
  }
};

const sendPushToUser = async (
  user: {
    id: string;
    fcmToken?: string | null;
  },
  payload: PushPayload,
  options?: {
    highPriority?: boolean;
  },
) => {
  await Promise.all([
    sendExpoPushToUser(user.id, payload),
    // sendLegacyFcmPush(user.fcmToken, payload, options),
  ]);
};

const parseVerifiedStreamWebhookBody = async (request: Request) => {
  const signature = request.headers.get("x-signature");

  if (!signature) {
    throw new UnauthorizedError("Missing Stream signature.", {
      code: "MISSING_STREAM_SIGNATURE",
    });
  }

  const rawBody = await request.text();
  const isValid = streamClient.verifyWebhook(rawBody, signature);

  if (!isValid) {
    throw new UnauthorizedError("Invalid signature.", {
      code: "INVALID_STREAM_SIGNATURE",
    });
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new BadRequestError("Invalid Stream webhook payload.", {
      code: "INVALID_STREAM_WEBHOOK_PAYLOAD",
      cause: error,
    });
  }
};

export const streamRoutes = new Elysia({ prefix: "/stream" })
  .group("", (app) =>
    app
      .use(authMiddleware)
      .post("/token", ({ body, currentUserId }) => streamService.generateToken({
        ...body,
        userId: currentUserId,
      }), {
        body: t.Object({
          userId: t.String(),
          name: t.Optional(t.String()),
          image: t.Optional(t.String()),
          email: t.Optional(t.String()),
        }),
        detail: { tags: ["Chat"], summary: "Get Stream.io token" },
      })

      .get(
        "/conversations/:userId",
        async ({ currentUserId, query }) => {
          return streamService.getConversations({
            userId: currentUserId,
            cursor: query.cursor,
            limit: query.limit === undefined ? undefined : Number(query.limit),
          });
        },
        {
          params: t.Object({ userId: t.String() }),
          query: t.Object({
            cursor: t.Optional(t.String()),
            limit: t.Optional(t.Numeric()),
          }),
          detail: { tags: ["Chat"], summary: "Get Stream conversations" },
        },
      )

      .post(
        "/call",
        async ({ body, currentUserId }) => {
          if (body.recipientId) {
            if (body.recipientId === currentUserId) {
              throw new BadRequestError("Call recipient must be another user.", {
                code: "INVALID_CALL_RECIPIENT",
              });
            }

            const match = await matchRepo.getMatchBetweenUsers(
              currentUserId,
              body.recipientId,
            );

            if (!match) {
              throw new ForbiddenError("Calls require a mutual match.", {
                code: "CALL_REQUIRES_MATCH",
                details: [
                  {
                    message:
                      "A Love Letter does not unlock normal chat or calls before a mutual match.",
                    feature: "chat",
                    reason: "match_required",
                  },
                ],
              });
            }
          }

          const user = await userRepo.getUserById(currentUserId);

          const allowance = entitlementService.getSubscriptionAllowance(
            user?.subscriptionType,
            "videoCalls",
          );

          await premiumFeatureRepo.ensureSubscriptionAllowances(
            currentUserId,
            resolveTier(user?.subscriptionType),
          );

          const consumed = await premiumFeatureRepo.consumeFeature(
            currentUserId,
            "videoCalls",
            { unlimited: allowance === "unlimited" },
          );

          if (!consumed) {
            throw new PaymentRequiredError(
              "You are out of Cruise calls. Please upgrade or buy more.",
              {
                code: "INSUFFICIENT_CRUISE_CALLS",
                details: [
                  {
                    message: "Cruise call allowance has been exhausted.",
                    feature: "videoCalls",
                    reason: "allowance_exhausted",
                    requiredPlan: "premium",
                  },
                ],
              },
            );
          }

          logger.info(
            {
              userId: currentUserId,
              feature: "videoCalls",
              source: consumed.source,
              remaining:
                consumed.source === "add-on"
                  ? consumed.features.addOnVideoCallsRemaining
                  : consumed.features.videoCallsRemaining,
            },
            "usage consumed",
          );

          return {
            callId: body.callId,
            type: body.type || "default",
            recipientId: body.recipientId ?? null,
            canChat: Boolean(body.recipientId),
            chatUnlockReason: body.recipientId ? "match" : null,
          };
        },
        {
          body: t.Object({
            callId: t.String(),
            type: t.Optional(t.String()),
            userId: t.Optional(t.String()),
            recipientId: t.Optional(t.String()),
          }),
          detail: { tags: ["Chat"], summary: "Setup call context" },
        },
      ),
  )

  .post(
    "/call-ring-webhook",
    async ({ request }: { request: Request }) => {
      const body = await parseVerifiedStreamWebhookBody(request);

      if (body.type !== "call.ring") {
        return { ok: true };
      }

      const callerId = body.call?.created_by?.id ?? body.user?.id;

      const callerName =
        body.call?.created_by?.name ?? body.user?.name ?? "Someone";

      const callType = body.call?.type ?? "default";
      const callId = body.call?.id ?? "";

      const isVideoCall =
        body.call?.settings?.video?.enabled ?? body.call?.video ?? true;

      const members = body.call?.members ?? body.members ?? [];

      const recipients = members.filter((member: any) => {
        const memberUserId = member.user_id ?? member.user?.id;
        return memberUserId && memberUserId !== callerId;
      });

      await Promise.all(
        recipients.map(async (recipient: any) => {
          const recipientId = recipient.user_id ?? recipient.user?.id;
          if (!recipientId) return;

          const user = await userRepo.getUserById(recipientId);
          if (!user) return;

          await sendCallNotification({
            user,
            callerName,
            callerId,
            callId,
            callType,
            isVideoCall,
          });
        }),
      );

      return { ok: true };
    },
    {
      parse: "none",
    },
  )

  .post(
    "/new-message-webhook",
    async ({ request }: { request: Request }) => {
      const body = await parseVerifiedStreamWebhookBody(request);

      if (body.type !== "message.new") {
        return { ok: true };
      }

      const senderId = body.user?.id;
      const senderName = body.user?.name ?? "Someone";
      const messageText = body.message?.text;
      const channelId = body.channel_id ?? body.channel?.id ?? "";

      const members = body.members ?? [];

      const recipients = members.filter((member: any) => {
        const memberUserId = member.user_id ?? member.user?.id;
        return memberUserId && memberUserId !== senderId;
      });

      await Promise.all(
        recipients.map(async (recipient: any) => {
          const recipientId = recipient.user_id ?? recipient.user?.id;
          if (!recipientId) return;

          const user = await userRepo.getUserById(recipientId);
          if (!user) return;

          await sendMessageNotification({
            user,
            senderName,
            messageText,
            senderId,
            channelId,
          });
        }),
      );

      return { ok: true };
    },
    {
      parse: "none",
    },
  );

export const sendMessageNotification = async ({
  user,
  senderName,
  messageText,
  senderId,
  channelId,
}: {
  user: {
    id: string;
    fcmToken?: string | null;
  };
  senderName: string;
  messageText?: string;
  senderId?: string;
  channelId?: string;
}) => {
  const body =
    messageText && messageText.trim().length > 0
      ? messageText
      : "Sent you a message";

  await sendPushToUser(user, {
    title: `💬 ${senderName}`,
    body,
    data: {
      type: "message.new",
      senderName,
      senderId: senderId ?? "",
      channelId: channelId ?? "",
      action: "OPEN_CHAT",
    },
  });
};

export const sendCallNotification = async ({
  user,
  callerName,
  callerId,
  callId,
  callType,
  isVideoCall,
}: {
  user: {
    id: string;
    fcmToken?: string | null;
  };
  callerName: string;
  callerId?: string;
  callId: string;
  callType: string;
  isVideoCall?: boolean;
}) => {
  const callLabel = isVideoCall ? "Video call" : "Voice call";

  await sendPushToUser(
    user,
    {
      title: `📞 ${callerName}`,
      body: `Incoming ${callLabel}`,
      data: {
        type: "call.ring",
        callerName,
        callerId: callerId ?? "",
        callId,
        callType,
        isVideoCall: String(!!isVideoCall),
        action: "OPEN_CALL_SCREEN",
      },
    },
    {
      highPriority: true,
    },
  );
};
