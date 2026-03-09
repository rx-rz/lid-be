import Stripe from "stripe";
import { paymentRepo } from "../repo/payment.repo";
import { logger } from "../utils/logger";
import { userRepo } from "../repo/user.repo";
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

    // Update user's payment status in database
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

    return prices.data.map((price) => ({
      id: price.id,
      nickname: price.nickname,
      amount: price.unit_amount ? price.unit_amount / 100 : 0,
      interval: price.recurring?.interval,
      intervalCount: price.recurring?.interval_count,
      product: (price.product as Stripe.Product).name,
      metadata: price.metadata,
    }));
  },

  handleWebhookEvent: async (event: Stripe.Event) => {
    switch (event.type) {
      case "payment_intent.succeeded":
        logger.info("[Stripe] Payment intent succeeded");
        break;

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId,
          {
            expand: ["items.data.price.product"],
          },
        );
        const customerId = subscription.customer as string;

        let subscriptionType = "paid"; 

        if (invoice.lines?.data?.length > 0) {
          const lineItem = invoice.lines.data[0];
          if (lineItem.description) {
            const match = lineItem.description.match(/Diaspora (.+?) \(at/);
            if (match && match[1]) {
              subscriptionType = match[1].toLowerCase().replace(/\s+/g, "-");
            }
          } else if (lineItem.price?.product) {
            const product =
              typeof lineItem.price.product === "string"
                ? await stripe.products.retrieve(lineItem.price.product)
                : lineItem.price.product;

            subscriptionType = (product as Stripe.Product)?.name
              ?.toLowerCase()
              .replace(/\s+/g, "-");
          }
        }

        await paymentRepo.updateStatusByCustomerId(customerId, {
          paymentStatus: "active",
          nextBillingDate: new Date(subscription.current_period_end * 1000),
          lastUpdated: new Date(),
          subscriptionType,
        });
        const paymentRecord =
          await paymentRepo.getCustomerByStripeId(customerId);
        if (paymentRecord?.userId) {
          await userRepo.updateUser(paymentRecord.userId, {
            subscriptionType: subscriptionType as any, 
          });
        }
        break;
      }

      case "invoice.created":
        // TODO: generate pdf if needed and send to user's email
        logger.info("[Stripe] Invoice created");
        break;

      case "customer.subscription.deleted": {
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedCustomerId = deletedSubscription.customer as string;

        await paymentRepo.updateStatusByCustomerId(deletedCustomerId, {
          paymentStatus: "inactive",
          subscriptionType: "free",
          lastUpdated: new Date(),
        });
        break;
      }
    }
  },
};
