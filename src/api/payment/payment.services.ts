import { ADD_ON_PACKS } from "../../constants/addons";
import { BadRequestError, NotFoundError } from "../../middleware/error";
import { paymentRepo } from "../../repo/payment.repo";
import { stripeService } from "../../services/stripe.services";

export const paymentService = {
  getPlans: async () => {
    const plans = await stripeService.getSubscriptionPlans();
    return plans.filter((plan) => plan.product.includes("Diaspora"));
  },

  getOrCreateCustomer: async (userId: string, email: string) => {
    const existingPayment = await paymentRepo.getCustomerByUserId(userId);

    if (existingPayment?.stripeCustomerId) {
      return {
        customerId: existingPayment.stripeCustomerId,
        isNew: false,
      };
    }

    const customer = await stripeService.createStripeCustomer(userId, email);

    return {
      customerId: customer.id,
      isNew: true,
    };
  },

  createPaymentIntent: async (userId: string, priceId: string) => {
    const paymentRecord = await paymentRepo.getCustomerByUserId(userId);

    if (!paymentRecord?.stripeCustomerId) {
      throw new BadRequestError("User has no Stripe customer ID.", {
        code: "USER_NO_CUSTOMER_ID",
      });
    }

    const { subscriptionId, clientSecret } =
      await stripeService.createSubscription(
        paymentRecord.stripeCustomerId,
        priceId,
        userId,
      );

    return { subscriptionId, clientSecret };
  },

  getAddons: async () => ADD_ON_PACKS,

  createAddonCheckout: async (
    userId: string,
    packId: string,
    successUrl?: string,
    cancelUrl?: string,
  ) => {
    const paymentRecord = await paymentRepo.getCustomerByUserId(userId);

    if (!paymentRecord?.stripeCustomerId) {
      throw new BadRequestError("User has no Stripe customer ID.", {
        code: "USER_NO_CUSTOMER_ID",
      });
    }

    return await stripeService.createAddonCheckoutSession({
      userId,
      customerId: paymentRecord.stripeCustomerId,
      packId,
      successUrl,
      cancelUrl,
    });
  },

  getPaymentStatus: async (userId: string) => {
    const paymentRecord = await paymentRepo.getCustomerByUserId(userId);

    if (!paymentRecord) {
      throw new NotFoundError("Payment record not found.", {
        code: "PAYMENT_RECORD_NOT_FOUND",
      });
    }

    return {
      subscriptionType: paymentRecord.subscriptionType,
      paymentStatus: paymentRecord.paymentStatus,
      nextBillingDate: paymentRecord.nextBillingDate,
    };
  },

  getCustomer: async (userId: string) => {
    const paymentRecord = await paymentRepo.getCustomerByUserId(userId);

    if (!paymentRecord?.stripeCustomerId) {
      throw new NotFoundError("Customer not found.", {
        code: "CUSTOMER_NOT_FOUND",
      });
    }

    return { customerId: paymentRecord.stripeCustomerId };
  },
};
