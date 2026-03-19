import Stripe from "stripe";
import * as dotenv from "dotenv";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

type PlanDefinition = {
  name: string;
  tier: string;
  price: number;
  interval: "month" | "week";
};

const PLANS: PlanDefinition[] = [
  {
    name: "Diaspora: Premium Economy",
    tier: "premium-economy",
    price: 1999,
    interval: "month",
  },
  {
    name: "Diaspora: First Class",
    tier: "first-class",
    price: 3999,
    interval: "month",
  },
  {
    name: "Diaspora: Weekender",
    tier: "weekender",
    price: 1499,
    interval: "week",
  },
];

const syncPlans = async () => {
  console.log("🚀 Starting Stripe Product Sync...");

  for (const plan of PLANS) {
    try {
      const product = await stripe.products.create({
        name: plan.name,
        metadata: {
          tier: plan.tier,
        },
      });


      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price,
        currency: "usd",
        recurring: {
          interval: plan.interval,
        },
        nickname: plan.name,
      });

      console.log(`✅ Created ${plan.name}`);
      console.log(`   Product ID: ${product.id}`);
      console.log(`   Price ID:   ${price.id}`);
      console.log(`-----------------------------`);
    } catch (error: any) {
      console.error(`❌ Error creating ${plan.name}:`, error.message);
    }
  }

  console.log("✨ Sync complete. Update your .env or frontend with these Price IDs.");
};

syncPlans();