import Stripe from "stripe";
import { paymentRepo } from "../repo/payment.repo";
import { logger } from "../utils/logger";
import { userRepo } from "../repo/user.repo";
import type { SubscriptionTier } from "../db/schema";
import { sql } from "drizzle-orm"; // Needed for add-on math
import { premiumFeatureRepo } from "../repo/premium.repo";
import { TIER_PERMISSIONS } from "../utils/permissions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

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
      throw new Error("Payment intent is missing client secret");
    }

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
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
    switch (event.type) {
      case "payment_intent.succeeded":
        logger.info("[Stripe] Payment intent succeeded");
        break;

      // --- SUBSCRIPTIONS (RECURRING) ---
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          { expand: ["items.data.price.product"] },
        );
        const customerId = subscription.customer as string;

        const lineItem = subscription.items.data[0];
        const product = lineItem.price.product as Stripe.Product;
        const subscriptionTier =
          (product.metadata.tier as SubscriptionTier) || "economy";

        // 1. Update Payment Status
        await paymentRepo.updateStatusByCustomerId(customerId, {
          paymentStatus: "active",
          nextBillingDate: new Date(subscription.current_period_end * 1000),
          lastUpdated: new Date(),
          subscriptionType: subscriptionTier,
        });

        const paymentRecord =
          await paymentRepo.getCustomerByStripeId(customerId);

        if (paymentRecord?.userId) {
          // 2. Update User Profile Status
          await userRepo.updateUser(paymentRecord.userId, {
            subscriptionType: subscriptionTier,
          });

          // 3. NEW: The Allowance Drop
          // When they pay, reset their wallet to the tier's weekly limits
          const limits = TIER_PERMISSIONS[subscriptionTier];
          await premiumFeatureRepo.upsertFeatures(paymentRecord.userId, {
            superlikesRemaining: limits.superLikesPerWeek,
            boostsRemaining: limits.boostsPerWeek,
            loveLettersRemaining: limits.loveLettersPerWeek,
            videoCallsRemaining:
              limits.videoCalls === "unlimited" ? 0 : limits.videoCalls,
          });

          logger.info(
            `[Stripe] Wallet topped up for user ${paymentRecord.userId}`,
          );
        }
        break;
      }

      // --- ADD-ON PACKS (ONE-TIME PURCHASES) ---
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only process one-time payments here (subscriptions are handled by invoice.payment_succeeded)
        if (session.mode === "payment" && session.payment_status === "paid") {
          const userId = session.metadata?.userId;
          const packType = session.metadata?.packType; // e.g., 'super_likes'
          const quantity = Number(session.metadata?.quantity || 0); // e.g., 5

          if (userId && packType && quantity > 0) {
            // Top up the specific consumable
            if (packType === "super_likes") {
              await premiumFeatureRepo.upsertFeatures(userId, {
                superlikesRemaining:
                  sql`superlikes_remaining + ${quantity}` as any,
              });
            } else if (packType === "boosts") {
              await premiumFeatureRepo.upsertFeatures(userId, {
                boostsRemaining: sql`boosts_remaining + ${quantity}` as any,
              });
            } else if (packType === "recalls") {
              await premiumFeatureRepo.upsertFeatures(userId, {
                recallsRemaining: sql`recalls_remaining + ${quantity}` as any,
              });
            } else if (packType === "love_letters") {
              await premiumFeatureRepo.upsertFeatures(userId, {
                loveLettersRemaining:
                  sql`love_letters_remaining + ${quantity}` as any,
              });
            } else if (packType === "cruise_calls") {
              await premiumFeatureRepo.upsertFeatures(userId, {
                videoCallsRemaining:
                  sql`video_calls_remaining + ${quantity}` as any,
              });
            }
            logger.info(
              `[Stripe] Added ${quantity} ${packType} to user ${userId}`,
            );
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Fetch the expanded product data to get the tier metadata
        const expandedSub = await stripe.subscriptions.retrieve(
          subscription.id,
          { expand: ["items.data.price.product"] },
        );

        const lineItem = expandedSub.items.data[0];
        const product = lineItem.price.product as Stripe.Product;
        const subscriptionTier =
          (product.metadata.tier as SubscriptionTier) || "economy";

        // Map Stripe statuses to your DB statuses
        let paymentStatus: any = "active";
        if (subscription.status === "past_due") paymentStatus = "past_due";
        if (
          subscription.status === "unpaid" ||
          subscription.status === "canceled"
        )
          paymentStatus = "inactive";

        await paymentRepo.updateStatusByCustomerId(customerId, {
          paymentStatus,
          subscriptionType:
            paymentStatus === "inactive" ? "economy" : subscriptionTier,
          nextBillingDate: new Date(subscription.current_period_end * 1000),
          lastUpdated: new Date(),
        });

        const paymentRecord =
          await paymentRepo.getCustomerByStripeId(customerId);
        if (paymentRecord?.userId) {
          await userRepo.updateUser(paymentRecord.userId, {
            subscriptionType:
              paymentStatus === "inactive" ? "economy" : subscriptionTier,
          });
          logger.info(
            `[Stripe] Synced subscription.updated for user ${paymentRecord.userId}. Tier: ${subscriptionTier}`,
          );
        }
        break;
      }

      case "invoice.created":
        logger.info("[Stripe] Invoice created");
        break;

      case "customer.subscription.deleted": {
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedCustomerId = deletedSubscription.customer as string;

        // Downgrade payment record
        await paymentRepo.updateStatusByCustomerId(deletedCustomerId, {
          paymentStatus: "inactive",
          subscriptionType: "economy",
          lastUpdated: new Date(),
        });

        // NEW: Downgrade user record so they lose access immediately
        const paymentRecord =
          await paymentRepo.getCustomerByStripeId(deletedCustomerId);
        if (paymentRecord?.userId) {
          await userRepo.updateUser(paymentRecord.userId, {
            subscriptionType: "economy",
          });
          logger.info(
            `[Stripe] Downgraded user ${paymentRecord.userId} to economy`,
          );
        }

        break;
      }
    }
  },
};
