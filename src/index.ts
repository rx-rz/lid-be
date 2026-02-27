import { Elysia } from "elysia";
import { openapi, fromTypes } from "@elysiajs/openapi";

import { userRoutes } from "./api/user/user.routes";
import { profileRoutes } from "./api/profile/profile.routes";
import { profileViewsRoutes } from "./api/profile/profile-views.routes";
import { preferenceRoutes } from "./api/preference/preference.routes";
import { imageRoutes } from "./api/image/image.routes";
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

const app = new Elysia()
  .use(
    openapi({
      references: fromTypes(),

      scalar: {
        theme: "moon"
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
  .use(imageRoutes)
  .use(locationRoutes)
  .use(blockRoutes)
  .use(boostRoutes)
  .use(favoriteRoutes)
  .use(streamRoutes)
  .use(reportRoutes)
  .use(rouletteRoutes)
  .use(helpRoutes)
  .use(interestRoutes)
  .listen(8000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
