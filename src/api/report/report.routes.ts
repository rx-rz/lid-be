import { Elysia, t } from "elysia";
import { reportService } from "./report.services";
import { authMiddleware } from "../../middleware/auth";

export const reportRoutes = new Elysia()
  .group("", (app) =>
    app.use(authMiddleware).post(
      "/report",
      ({ body, currentUserId }) =>
        reportService.create({ ...body, reporterId: currentUserId }),
      {
        body: t.Object({
          reporterId: t.String(),
          reportedId: t.String(),
          reason: t.String(),
          details: t.Optional(t.String()),
        }),
        detail: { tags: ["Safety"], summary: "Report a user" },
      },
    ),
  )
  .get("/reports", () => reportService.getReports(), {
    detail: { tags: ["Admin"], summary: "Get all reports" },
  })
  .patch(
    "/report/:id",
    ({ params: { id }, body }) => reportService.updateStatus(id, body.status),
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ status: t.String() }),
      detail: { tags: ["Admin"], summary: "Update report status" },
    },
  );
