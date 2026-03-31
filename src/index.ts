import { Elysia } from "elysia";
import { openapi, fromTypes } from "@elysiajs/openapi";

import { userRoutes } from "./api/user/user.routes";
import { profileRoutes } from "./api/profile/profile.routes";
import { profileViewsRoutes } from "./api/profile/profile-views.routes";
import { preferenceRoutes } from "./api/preference/preference.routes";
import { imageRoutes, imagesRoutes } from "./api/image/image.routes";
import { locationRoutes } from "./api/location/location.routes";
import { blockRoutes } from "./api/block/block.routes";
import { boostRoutes } from "./api/boost/boost.routes";
import { favoriteRoutes } from "./api/favorite/favorite.routes";
import { reportRoutes } from "./api/report/report.routes";
import { streamRoutes } from "./api/stream/stream.routes";
import { interestRoutes } from "./api/interest/interest.routes";
import { helpRoutes } from "./api/help/help.routes";
import { rouletteRoutes } from "./api/roulette/roulette.routes";
import { errorMiddleware } from "./middleware/error";
import { paymentRoutes } from "./api/payment/payment.routes";
import { interactionRoutes } from "./api/interaction/interaction.routes";
import { cleanupExpiredBoostsCron } from "./cron/cleanup-expired-boosts";
import swaggerJson from "./lid-api.json";

const app = new Elysia({ prefix: "/api/v1" })
  .use(
    openapi({
      scalar: {
        theme: "moon",
      },
      documentation: {
        info: {
          title: "Love In Diaspora Backend Documentation",
          version: "1.0.0",
        },
      },
    }),
  )
  .use(errorMiddleware)
  .use(userRoutes)
  .use(profileRoutes)
  .use(profileViewsRoutes)
  .use(preferenceRoutes)
  .use(paymentRoutes)
  .use(imageRoutes)
  .use(imagesRoutes)
  .use(locationRoutes)
  .use(interactionRoutes)
  .use(blockRoutes)
  .use(boostRoutes)
  .use(favoriteRoutes)
  .use(streamRoutes)
  .use(reportRoutes)
  .use(rouletteRoutes)
  .use(helpRoutes)
  .use(interestRoutes)
  .get("/swagger.json", () => swaggerJson);

cleanupExpiredBoostsCron();

app.listen(8000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
