import { stripeService } from "../../services/stripe.services"; 
import { paymentRepo } from "../../repo/payment.repo"; 

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

    if (!paymentRecord || !paymentRecord.stripeCustomerId) {
      throw new Error("USER_NO_CUSTOMER_ID");
    }

    const { subscriptionId, clientSecret } =
      await stripeService.createSubscription(
        paymentRecord.stripeCustomerId,
        priceId,
        userId,
      );

    return { subscriptionId, clientSecret };
  },

  getPaymentStatus: async (userId: string) => {
    const paymentRecord = await paymentRepo.getCustomerByUserId(userId);

    if (!paymentRecord) {
      throw new Error("PAYMENT_RECORD_NOT_FOUND");
    }

    return {
      subscriptionType: paymentRecord.subscriptionType,
      paymentStatus: paymentRecord.paymentStatus,
      nextBillingDate: paymentRecord.nextBillingDate,
    };
  },

  getCustomer: async (userId: string) => {
    const paymentRecord = await paymentRepo.getCustomerByUserId(userId);

    if (!paymentRecord || !paymentRecord.stripeCustomerId) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }

    return { customerId: paymentRecord.stripeCustomerId };
  },
};
