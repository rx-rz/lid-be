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
    name: "Diaspora: Economy",
    tier: "economy",
    price: 0,
    interval: "month",
  },
  {
    name: "Diaspora: Premium",
    tier: "premium",
    price: 1499,
    interval: "month",
  },
  {
    name: "Diaspora: First Class",
    tier: "first-class",
    price: 2499,
    interval: "month",
  },
  {
    name: "Diaspora: Weekender",
    tier: "weekender",
    price: 999,
    interval: "week",
  },
];

const clearOldPlans = async () => {
  console.log("🧹 Archiving old active products and prices...");

  try {
    for await (const product of stripe.products.list({ active: true })) {
      // 1. Unset the default price FIRST
      // Passing an empty string ("") removes the default price in Stripe
      if (product.default_price) {
        await stripe.products.update(product.id, { default_price: "" });
      }

      // 2. Now we can safely archive all active prices associated with the product
      for await (const price of stripe.prices.list({
        product: product.id,
        active: true,
      })) {
        await stripe.prices.update(price.id, { active: false });
        console.log(`   ➖ Archived Price: ${price.id}`);
      }

      // 3. Archive the product itself
      await stripe.products.update(product.id, { active: false });
      console.log(`   📦 Archived Product: ${product.name} (${product.id})`);
    }
    console.log("✅ All old plans archived successfully.\n");
  } catch (error: any) {
    console.error("❌ Error archiving old plans:", error.message);
    throw error;
  }
};

const syncPlans = async () => {
  console.log("🚀 Starting Stripe Product Sync...");

  await clearOldPlans();

  console.log("🌱 Creating new plans...");
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

     await stripe.products.update(product.id, {
        default_price: price.id,
      });

      console.log(`✅ Created ${plan.name}`);
      console.log(`   Product ID: ${product.id}`);
      console.log(`   Price ID:   ${price.id}`);
      console.log(`-----------------------------`);
    } catch (error: any) {
      console.error(`❌ Error creating ${plan.name}:`, error.message);
    }
  }

  console.log(
    "✨ Sync complete. Update your .env or frontend with these Price IDs.",
  );
};

syncPlans();
