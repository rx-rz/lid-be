import { Elysia, t } from "elysia";
import { streamService } from "./stream.services";
import { streamClient } from "../../services/stream.services";
import { fcmAdmin } from "../../services/fcm";
import { logger } from "../../utils/logger";
import { userRepo } from "../../repo/user.repo";
import { entitlementService, resolveTier } from "../../services/entitlements";
import { premiumFeatureRepo } from "../../repo/premium.repo";
import { PaymentRequiredError, UnauthorizedError } from "../../middleware/error";


export const streamRoutes = new Elysia({ prefix: "/stream" })
  .post("/token", ({ body }) => streamService.generateToken(body), {
    body: t.Object({
      userId: t.String(),
      name: t.Optional(t.String()),
      image: t.Optional(t.String()),
      email: t.Optional(t.String()),
    }),
    detail: { tags: ["Chat"], summary: "Get Stream.io token" },
  })
  .post(
    "/call",
    async ({ body }) => {
      if (body.userId) {
        const user = await userRepo.getUserById(body.userId);
        const allowance = entitlementService.getSubscriptionAllowance(
          user?.subscriptionType,
          "videoCalls",
        );
        await premiumFeatureRepo.ensureSubscriptionAllowances(
          body.userId,
          resolveTier(user?.subscriptionType),
        );
        const consumed = await premiumFeatureRepo.consumeFeature(
          body.userId,
          "videoCalls",
          { unlimited: allowance === "unlimited" },
        );

        if (!consumed) {
          throw new PaymentRequiredError(
            "You are out of Cruise calls. Please upgrade or buy more.",
            { code: "INSUFFICIENT_CRUISE_CALLS" },
          );
        }

        logger.info(
          {
            userId: body.userId,
            feature: "videoCalls",
            source: consumed.source,
            remaining:
              consumed.source === "add-on"
                ? consumed.features.addOnVideoCallsRemaining
                : consumed.features.videoCallsRemaining,
          },
          "usage consumed",
        );
      }

      return { callId: body.callId, type: body.type || "default" };
    },
    {
      body: t.Object({
        callId: t.String(),
        type: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
      detail: { tags: ["Chat"], summary: "Setup call context" },
    },
  )
  .post(
    "/call-ring-webhook",
    async ({ body, headers }: { body: any; headers: any }) => {
      const isValid = streamClient.verifyWebhook(
        JSON.stringify(body),
        headers["x-signature"],
      );

      if (!isValid) {
        throw new UnauthorizedError("Invalid signature.", {
          code: "INVALID_STREAM_SIGNATURE",
        });
      }

      if (body.type !== "call.ring") {
        return { ok: true };
      }

      const callerId =
        body.call?.created_by?.id ??
        body.user?.id;

      const callerName =
        body.call?.created_by?.name ??
        body.user?.name ??
        "Someone";

      const callType = body.call?.type ?? "default";
      const callId = body.call?.id;
      const isVideoCall = body.call?.settings?.video?.enabled ?? body.call?.video ?? true;

      const members =
        body.call?.members ??
        body.members ??
        [];

      const recipients = members.filter((m: any) => {
        const userId = m.user_id ?? m.user?.id;
        return userId && userId !== callerId;
      });

      for (const r of recipients) {
        const recipientId = r.user_id ?? r.user?.id;
        const user = await userRepo.getUserById(recipientId);

        if (!user?.fcmToken) continue;

        await sendCallNotification({
          fcmToken: user.fcmToken,
          callerName,
          callId,
          callType,
          isVideoCall,
        });
      }

      return { ok: true };
    },
  )
  .post(
    "/new-message-webhook",
    async ({ body, headers }: { body: any; headers: any }) => {
      const isValid = streamClient.verifyWebhook(
        JSON.stringify(body),
        headers["x-signature"],
      );

      if (!isValid) {
        throw new UnauthorizedError("Invalid signature.", {
          code: "INVALID_STREAM_SIGNATURE",
        });
      }

      if (body.type !== "message.new") {
        return { ok: true };
      }

      const senderId = body.user?.id;
      const senderName = body.user?.name;
      const messageText = body.message?.text;

      const members = body.members || [];

      const recipients = members.filter((m: any) => m.user_id !== senderId);

      for (const r of recipients) {
        const user = await userRepo.getUserById(r.user_id);

        await sendMessageNotification(
          user.fcmToken ?? "",
          senderName,
          messageText,
        );
      }

      return { ok: true };
    },
  );

export const sendMessageNotification = async (
  targetFcmToken: string,
  senderName: string,
  messageText?: string,
  options?: {
    channelId?: string;
    senderId?: string;
  },
) => {
  if (!targetFcmToken) return;

  const body =
    messageText && messageText.trim().length > 0
      ? messageText
      : "Sent you a message";

  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: `💬 ${senderName}`,
        body,
      },

      data: {
        type: "message.new",
        senderName,
        senderId: options?.senderId ?? "",
        channelId: options?.channelId ?? "",
      },

      token: targetFcmToken,
    });

    logger.info("[Message] Push notification sent successfully");
  } catch (err) {
    logger.error({ err }, "[Message] Error sending FCM message notification");
  }
};

export const sendCallNotification = async ({
  fcmToken,
  callerName,
  callerId,
  callId,
  callType,
  isVideoCall,
}: {
  fcmToken: string;
  callerName: string;
  callerId?: string;
  callId: string;
  callType: string;
  isVideoCall?: boolean;
}) => {
  if (!fcmToken) return;

  const callLabel = isVideoCall ? "Video call" : "Voice call";

  try {
    await fcmAdmin.messaging().send({
      notification: {
        title: `📞 ${callerName}`,
        body: `Incoming ${callLabel}`,
      },

      data: {
        type: "call.ring",
        callerName,
        callerId: callerId ?? "",
        callId,
        callType,
        isVideoCall: String(!!isVideoCall),

        // optional but useful for deep linking
        action: "OPEN_CALL_SCREEN",
      },

      token: fcmToken,

      // optional: helps with delivery priority
      android: {
        priority: "high",
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
      },
    });

    logger.info("[Call] Push notification sent successfully");
  } catch (err) {
    logger.error({ err }, "[Call] Error sending FCM call notification");
  }
};