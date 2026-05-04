import { Elysia, t } from "elysia";
import { paymentService } from "./payment.services";
import { stripeService } from "../../services/stripe.services";
import Stripe from "stripe";
import { clerkPlugin } from "elysia-clerk";
import { loggers } from "../../utils/logger";
import {
  rateLimitPresets,
  routeRateLimit,
} from "../../config/rate-limits";
import {
  AppError,
  BadRequestError,
  ErrorResponseSchema,
  InternalServerError,
} from "../../middleware/error";

export const paymentRoutes = new Elysia({})
  .use(routeRateLimit(rateLimitPresets.webhook))
  .post(
    "/webhook",
    async ({ request, set }) => {
      try {
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          throw new BadRequestError("Missing stripe-signature header.", {
            code: "MISSING_STRIPE_SIGNATURE",
          });
        }

        const rawBody = await request.text();
        const stripeAuth = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: "2025-02-24.acacia",
        });

        const event = stripeAuth.webhooks.constructEvent(
          rawBody,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET!,
        );

        await stripeService.handleWebhookEvent(event);

        return { received: true };
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        loggers.payment.warn({ err }, "stripe webhook failed");
        throw new BadRequestError(`Webhook Error: ${err.message}`, {
          code: "STRIPE_WEBHOOK_ERROR",
          cause: err,
        });
      }
    },
    {
      detail: { tags: ["Payments"], summary: "Handle Stripe Webhooks" },
    },
  )

  .use(routeRateLimit(rateLimitPresets.payments))
  .get(
    "/plans",
    async () => {
      return await paymentService.getPlans();
    },
    {
      detail: {
        tags: ["Payments"],
        summary: "Get available subscription plans",
      },
    },
  )
  .get(
    "/addons",
    async () => {
      return await paymentService.getAddons();
    },
    {
      detail: {
        tags: ["Payments"],
        summary: "Get available add-on packs",
      },
    },
  )
  .post(
    "/addons/checkout",
    async ({ body }) => {
      return await paymentService.createAddonCheckout(
        body.userId,
        body.packId,
        body.successUrl,
        body.cancelUrl,
      );
    },
    {
      body: t.Object({
        userId: t.String(),
        packId: t.String(),
        successUrl: t.Optional(t.String()),
        cancelUrl: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Payments"],
        summary: "Create an add-on checkout session",
      },
    },
  )
  .post(
    "/subscription",
    async ({ body }) => {
      return await paymentService.createPaymentIntent(
        body.userId,
        body.priceId,
      );
    },
    {
      body: t.Object({
        userId: t.String(),
        priceId: t.String(),
      }),
      detail: {
        tags: ["Payments"],
        summary: "Create a new subscription payment intent",
      },
    },
  )
  .get(
    "/status/:userId",
    async ({ params: { userId } }) => {
      return await paymentService.getPaymentStatus(userId);
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["Payments"], summary: "Get user subscription status" },
    },
  )
  .get(
    "/customer/:userId",
    async ({ params: { userId } }) => {
      return await paymentService.getCustomer(userId);
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["Payments"], summary: "Get user's Stripe Customer ID" },
    },
  )
  .group("", (app) =>
    app.use(clerkPlugin()).post(
      "/customer",
      async ({ body }) => {
        try {
          return await paymentService.getOrCreateCustomer(
            body.userId,
            body.email,
          );
        } catch (error) {
          throw new InternalServerError("Failed to create Stripe customer.", {
            code: "STRIPE_CUSTOMER_CREATE_FAILED",
            cause: error,
          });
        }
      },
      {
        body: t.Object({
          userId: t.String(),
          email: t.String({ format: "email" }),
        }),
        response: {
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
        detail: {
          tags: ["Payments"],
          summary: "Get or Create a Stripe Customer",
        },
      },
    ),
  );
