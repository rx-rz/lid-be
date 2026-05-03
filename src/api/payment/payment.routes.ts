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

export const paymentRoutes = new Elysia({})
  .use(routeRateLimit(rateLimitPresets.webhook))
  .post(
    "/webhook",
    async ({ request, set }) => {
      try {
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          set.status = 400;
          return "Missing stripe-signature header";
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
        loggers.payment.warn({ err }, "stripe webhook failed");
        set.status = 400;
        return `Webhook Error: ${err.message}`;
      }
    },
    {
      detail: { tags: ["Payments"], summary: "Handle Stripe Webhooks" },
    },
  )

  .use(routeRateLimit(rateLimitPresets.payments))
  .get(
    "/plans",
    async ({ set }) => {
      try {
        return await paymentService.getPlans();
      } catch (error) {
        set.status = 500;
        return { error: "Failed to fetch subscription plans" };
      }
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
    async ({ set }) => {
      try {
        return await paymentService.getAddons();
      } catch (error) {
        set.status = 500;
        return { error: "Failed to fetch add-ons" };
      }
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
    async ({ body, set }) => {
      try {
        return await paymentService.createAddonCheckout(
          body.userId,
          body.packId,
          body.successUrl,
          body.cancelUrl,
        );
      } catch (error: any) {
        if (error.message === "USER_NO_CUSTOMER_ID") {
          set.status = 400;
          return { error: "User has no Stripe customer ID" };
        }
        if (error.message === "ADDON_PACK_NOT_FOUND") {
          set.status = 404;
          return { error: "Add-on pack not found" };
        }
        set.status = 500;
        return { error: "Failed to create add-on checkout session" };
      }
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
    async ({ body, set }) => {
      try {
        return await paymentService.createPaymentIntent(
          body.userId,
          body.priceId,
        );
      } catch (error: any) {
        if (error.message === "USER_NO_CUSTOMER_ID") {
          set.status = 400;
          return { error: "User has no Stripe customer ID" };
        }
        set.status = 500;
        return { error: "Failed to create payment intent" };
      }
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
    async ({ params: { userId }, set }) => {
      try {
        return await paymentService.getPaymentStatus(userId);
      } catch (error: any) {
        if (error.message === "PAYMENT_RECORD_NOT_FOUND") {
          set.status = 404;
          return { error: "Payment record not found" };
        }
        set.status = 500;
        return { error: "Failed to fetch payment status" };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["Payments"], summary: "Get user subscription status" },
    },
  )
  .get(
    "/customer/:userId",
    async ({ params: { userId }, set }) => {
      try {
        return await paymentService.getCustomer(userId);
      } catch (error: any) {
        if (error.message === "CUSTOMER_NOT_FOUND") {
          set.status = 404;
          return { error: "Customer not found" };
        }
        set.status = 500;
        return { error: "Failed to fetch customer" };
      }
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["Payments"], summary: "Get user's Stripe Customer ID" },
    },
  )
  .group("", (app) =>
    app.use(clerkPlugin()).post(
      "/customer",
      async ({ body, set }) => {
        try {
          return await paymentService.getOrCreateCustomer(
            body.userId,
            body.email,
          );
        } catch (error) {
          set.status = 500;
          return { error: "Failed to create Stripe customer" };
        }
      },
      {
        body: t.Object({
          userId: t.String(),
          email: t.String({ format: "email" }),
        }),
        detail: {
          tags: ["Payments"],
          summary: "Get or Create a Stripe Customer",
        },
      },
    ),
  );
