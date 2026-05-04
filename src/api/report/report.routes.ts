import { Elysia, t } from "elysia";
import { reportService } from "./report.services";

export const reportRoutes = new Elysia()
  .post(
    "/report",
    ({ body }) => reportService.create(body),
    {
      body: t.Object({
        reporterId: t.String(),
        reportedId: t.String(),
        reason: t.String(),
        details: t.Optional(t.String()),
      }),
      detail: { tags: ["Safety"], summary: "Report a user" },
    },
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
