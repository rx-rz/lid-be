import { reportRepo } from "../../repo/report.repo";
import { userRepo } from "../../repo/user.repo";

export const reportService = {
  create: async (data: {
    reporterId: string;
    reportedId: string;
    reason: string;
    details?: string;
  }) => {
    if (data.reporterId === data.reportedId)
      throw new Error("Cannot report yourself");

    const reportedExists = await userRepo.checkUserExists(data.reportedId);
    if (!reportedExists) throw new Error("Target user not found");

    return await reportRepo.create(data);
  },

  getReports: async () => {
    return await reportRepo.findAll();
  },

  updateStatus: async (id: string, status: string) => {
    const updated = await reportRepo.updateStatus(id, status);
    if (!updated) throw new Error("Report not found");
    return updated;
  },
};
