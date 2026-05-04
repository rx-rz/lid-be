import Stripe from "stripe";
import { paymentRepo } from "../repo/payment.repo";
import { logger } from "../utils/logger";
import { userRepo } from "../repo/user.repo";
import type { SubscriptionTier } from "../db/schema";
import { premiumFeatureRepo } from "../repo/premium.repo";
import { entitlementService } from "./entitlements";
import { getAddOnPack, type AddOnType } from "../constants/addons";
import { InternalServerError, NotFoundError } from "../middleware/error";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const mapSubscriptionStatus = (
  status: Stripe.Subscription.Status,
): "active" | "pending" | "past_due" | "inactive" => {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (status === "incomplete") return "pending";
  return "inactive";
};

const shouldKeepPaidTier = (paymentStatus: ReturnType<typeof mapSubscriptionStatus>) =>
  paymentStatus === "active" || paymentStatus === "past_due";

export const stripeService = {
  createStripeCustomer: async (userId: string, email: string) => {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });

    await paymentRepo.createCustomerRecord(userId, customer.id);
    return customer;
  },

  getCustomerByUserId: async (userId: string) => {
    return await paymentRepo.getCustomerByUserId(userId);
  },

  createSubscription: async (
    customerId: string,
    priceId: string,
    userId: string,
  ) => {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });

    await paymentRepo.updateStatusByUserId(userId, {
      paymentStatus: "pending",
      lastUpdated: new Date(),
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      throw new InternalServerError("Payment intent is missing client secret.", {
        code: "STRIPE_PAYMENT_INTENT_MISSING_CLIENT_SECRET",
      });
    }

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
    };
  },

  createAddonCheckoutSession: async (data: {
    userId: string;
    customerId: string;
    packId: string;
    successUrl?: string;
    cancelUrl?: string;
    }) => {
    const pack = getAddOnPack(data.packId);
    if (!pack) {
      throw new NotFoundError("Add-on pack not found.", {
        code: "ADDON_PACK_NOT_FOUND",
      });
    }

    const appUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: data.customerId,
      mode: pack.interval ? "subscription" : "payment",
      success_url:
        data.successUrl || `${appUrl}/settings/payments?checkout=success`,
      cancel_url:
        data.cancelUrl || `${appUrl}/settings/payments?checkout=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pack.currency,
            unit_amount: Math.round(pack.amount * 100),
            ...(pack.interval
              ? { recurring: { interval: pack.interval } }
              : {}),
            product_data: {
              name: `Diaspora ${pack.name}`,
              metadata: {
                addonPackId: pack.id,
                addonType: pack.type,
              },
            },
          },
        },
      ],
      metadata: {
        userId: data.userId,
        packId: pack.id,
        packType: pack.type,
        quantity: String(pack.quantity),
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  },

  getSubscriptionPlans: async () => {
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
    });

    return prices.data.map((price) => {
      const product = price.product as Stripe.Product;
      return {
        id: price.id,
        nickname: price.nickname,
        amount: price.unit_amount ? price.unit_amount / 100 : 0,
        interval: price.recurring?.interval,
        intervalCount: price.recurring?.interval_count,
        product: product.name,
        tier: (product.metadata.tier as SubscriptionTier) || "economy",
        metadata: price.metadata,
      };
    });
  },

  handleWebhookEvent: async (event: Stripe.Event) => {
    const webhookEvent = await paymentRepo.createWebhookEventIfNew(
      event.id,
      event.type,
    );

    if (!webhookEvent) {
      logger.info(
        { stripeEventId: event.id, eventType: event.type },
        "stripe webhook event already processed",
      );
      return;
    }

    try {
      switch (event.type) {
      case "payment_intent.succeeded":
        logger.info(
          { stripeEventId: event.id, eventType: event.type },
          "payment intent succeeded",
        );
        break;

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          logger.info(
            { stripeEventId: event.id, eventType: event.type },
            "invoice payment succeeded without subscription; skipping subscription sync",
          );
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          { expand: ["items.data.price.product"] },
        );
        const customerId = subscription.customer as string;

        const lineItem = subscription.items.data[0];
        const product = lineItem.price.product as Stripe.Product;
        const addonType = product.metadata.addonType as AddOnType | undefined;
        if (addonType === "cruise_pass") {
          const paymentRecord =
            await paymentRepo.getCustomerByStripeId(customerId);

          if (paymentRecord?.userId) {
            await premiumFeatureRepo.addAddonCredits(
              paymentRecord.userId,
              "cruise_pass",
              "unlimited",
            );
            logger.info(
              { stripeEventId: event.id, userId: paymentRecord.userId },
              "cruise pass renewed",
            );
          }
          break;
        }

        const subscriptionTier =
          (product.metadata.tier as SubscriptionTier) || "economy";

        await paymentRepo.updateStatusByCustomerId(customerId, {
          paymentStatus: "active",
          nextBillingDate: new Date(subscription.current_period_end * 1000),
          lastUpdated: new Date(),
          subscriptionType: subscriptionTier,
        });

        const paymentRecord =
          await paymentRepo.getCustomerByStripeId(customerId);

        if (paymentRecord?.userId) {
          await userRepo.updateUser(paymentRecord.userId, {
            subscriptionType: subscriptionTier,
          });

          const limits =
            entitlementService.getEntitlementsForTier(subscriptionTier);
          const resetAt = new Date();
          await premiumFeatureRepo.upsertFeatures(paymentRecord.userId, {
            superlikesRemaining: limits.superLikesPerWeek,
            boostsRemaining: limits.boostsPerWeek,
            loveLettersRemaining: limits.loveLettersPerWeek,
            recallsRemaining:
              limits.recallsPerWeek === "unlimited" ? 0 : limits.recallsPerWeek,
            videoCallsRemaining:
              limits.videoCalls === "unlimited" ? 0 : limits.videoCalls,
            subscriptionLastWeeklyResetAt: resetAt,
            subscriptionNextWeeklyResetAt: new Date(
              resetAt.getTime() + 7 * 24 * 60 * 60 * 1000,
            ),
            subscriptionLastMonthlyResetAt:
              subscriptionTier === "premium" ? resetAt : null,
            subscriptionNextMonthlyResetAt:
              subscriptionTier === "premium"
                ? new Date(
                    Date.UTC(
                      resetAt.getUTCFullYear(),
                      resetAt.getUTCMonth() + 1,
                      resetAt.getUTCDate(),
                      resetAt.getUTCHours(),
                      resetAt.getUTCMinutes(),
                      resetAt.getUTCSeconds(),
                      resetAt.getUTCMilliseconds(),
                    ),
                  )
                : null,
          });

          logger.info(
            { stripeEventId: event.id, userId: paymentRecord.userId, subscriptionTier },
            "subscription wallet topped up",
          );
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const canApplyCheckout =
          (session.mode === "payment" && session.payment_status === "paid") ||
          session.mode === "subscription";

        if (canApplyCheckout) {
          const userId = session.metadata?.userId;
          const pack = session.metadata?.packId
            ? getAddOnPack(session.metadata.packId)
            : undefined;
          const packType = (pack?.type ||
            session.metadata?.packType) as AddOnType | undefined;
          const quantity =
            pack?.quantity ?? Number(session.metadata?.quantity || 0);

          if (
            userId &&
            packType &&
            (quantity === "unlimited" || Number(quantity) > 0)
          ) {
            await premiumFeatureRepo.addAddonCredits(userId, packType, quantity);
            logger.info(
              { stripeEventId: event.id, userId, packType, quantity },
              "add-on credits applied",
            );
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const expandedSub = await stripe.subscriptions.retrieve(
          subscription.id,
          { expand: ["items.data.price.product"] },
        );

        const lineItem = expandedSub.items.data[0];
        const product = lineItem.price.product as Stripe.Product;
        const addonType = product.metadata.addonType as AddOnType | undefined;
        if (addonType === "cruise_pass") {
          const paymentRecord =
            await paymentRepo.getCustomerByStripeId(customerId);

          if (paymentRecord?.userId) {
            if (
              subscription.status === "canceled" ||
              subscription.status === "unpaid"
            ) {
              await premiumFeatureRepo.clearCruisePass(paymentRecord.userId);
            } else {
              await premiumFeatureRepo.addAddonCredits(
                paymentRecord.userId,
                "cruise_pass",
                "unlimited",
              );
            }
          }
          break;
        }

        const subscriptionTier =
          (product.metadata.tier as SubscriptionTier) || "economy";
          
        const paymentStatus = mapSubscriptionStatus(subscription.status);
        const effectiveTier = shouldKeepPaidTier(paymentStatus)
          ? subscriptionTier
          : "economy";

        await paymentRepo.updateStatusByCustomerId(customerId, {
          paymentStatus,
          subscriptionType: effectiveTier,
          nextBillingDate: new Date(subscription.current_period_end * 1000),
          lastUpdated: new Date(),
        });

        const paymentRecord =
          await paymentRepo.getCustomerByStripeId(customerId);
        if (paymentRecord?.userId) {
          await userRepo.updateUser(paymentRecord.userId, {
            subscriptionType: effectiveTier,
          });
          if (!shouldKeepPaidTier(paymentStatus)) {
            await premiumFeatureRepo.clearSubscriptionAllowances(
              paymentRecord.userId,
            );
          }
          logger.info(
            {
              stripeEventId: event.id,
              userId: paymentRecord.userId,
              subscriptionTier,
              paymentStatus,
            },
            "subscription update synced",
          );
        }
        break;
      }

      case "invoice.created":
        logger.info(
          { stripeEventId: event.id, eventType: event.type },
          "invoice created",
        );
        break;

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | undefined;

        if (customerId) {
          await paymentRepo.updateStatusByCustomerId(customerId, {
            paymentStatus: "past_due",
            lastUpdated: new Date(),
          });
        }

        logger.warn(
          { stripeEventId: event.id, eventType: event.type, customerId },
          "invoice payment failed",
        );
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedCustomerId = deletedSubscription.customer as string;
        const expandedSub = await stripe.subscriptions.retrieve(
          deletedSubscription.id,
          { expand: ["items.data.price.product"] },
        );
        const deletedProduct = expandedSub.items.data[0]?.price
          .product as Stripe.Product | undefined;
        const addonType = deletedProduct?.metadata.addonType as
          | AddOnType
          | undefined;

        if (addonType === "cruise_pass") {
          const paymentRecord =
            await paymentRepo.getCustomerByStripeId(deletedCustomerId);
          if (paymentRecord?.userId) {
            await premiumFeatureRepo.clearCruisePass(paymentRecord.userId);
          }
          break;
        }

        await paymentRepo.updateStatusByCustomerId(deletedCustomerId, {
          paymentStatus: "inactive",
          subscriptionType: "economy",
          lastUpdated: new Date(),
        });

        const paymentRecord =
          await paymentRepo.getCustomerByStripeId(deletedCustomerId);
        if (paymentRecord?.userId) {
          await userRepo.updateUser(paymentRecord.userId, {
            subscriptionType: "economy",
          });
          await premiumFeatureRepo.clearSubscriptionAllowances(
            paymentRecord.userId,
          );
          logger.info(
            { stripeEventId: event.id, userId: paymentRecord.userId, subscriptionTier: "economy" },
            "subscription deleted; user downgraded",
          );
        }

        break;
      }
    }
      await paymentRepo.markWebhookEventProcessed(event.id);
    } catch (error) {
      logger.error(
        { err: error, stripeEventId: event.id, eventType: event.type },
        "stripe webhook processing failed",
      );
      throw error;
    }
  },
};
