import cron from "node-cron";
import { premiumService } from "../api/premium/premium.services";
import { logger } from "../utils/logger";

export const cleanupExpiredBoostsCron = () => {
  cron.schedule("15 4 * * *", async () => {
    try {
      await premiumService.cleanupExpiredBoosts();
    } catch (err) {
      logger.error({ err }, "[Cron] Failed to run boost cleanup");
    }
  });
  logger.info("[Cron] Background jobs initialized and ticking.");
};
