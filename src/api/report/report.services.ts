import { reportRepo } from "../../repo/report.repo";
import { userRepo } from "../../repo/user.repo";
import { BadRequestError, NotFoundError } from "../../middleware/error";

export const reportService = {
  create: async (data: {
    reporterId: string;
    reportedId: string;
    reason: string;
    details?: string;
  }) => {
    if (data.reporterId === data.reportedId) {
      throw new BadRequestError("Cannot report yourself.", {
        code: "INVALID_SELF_INTERACTION",
      });
    }

    const reportedExists = await userRepo.checkUserExists(data.reportedId);
    if (!reportedExists) {
      throw new NotFoundError("Target user not found.", {
        code: "REPORTED_USER_NOT_FOUND",
      });
    }

    return await reportRepo.create(data);
  },

  getReports: async () => {
    return await reportRepo.findAll();
  },

  updateStatus: async (id: string, status: string) => {
    const updated = await reportRepo.updateStatus(id, status);
    if (!updated) {
      throw new NotFoundError("Report not found.", { code: "REPORT_NOT_FOUND" });
    }
    return updated;
  },
};
