import { rouletteRepo } from "../../repo/roulette.repo";

const MATCH_DURATION_MS = 2 * 60 * 1000;
const REMATCH_PREVENTION_COUNT = 5;

export const rouletteService = {
  findMatch: async (userId: string, genderFilter?: string) => {
    const existing = await rouletteRepo.findSessionByUserId(userId);

    if (existing?.status === "matched") {
      const match = await rouletteRepo.getActiveMatch(existing.id);
      if (
        match &&
        (!match.scheduledEndTime || match.scheduledEndTime > new Date())
      ) {
        return { alreadyMatched: true, matchDetails: match };
      }
      await rouletteRepo.updateSession(existing.id, { status: "waiting" });
    }

    if (existing?.status === "waiting") return { alreadyWaiting: true };

    const session = await rouletteRepo.upsertSession(
      userId,
      existing?.previousPartners || [],
    );
    const partners = await rouletteRepo.findWaitingPartner(
      userId,
      genderFilter,
      session.previousPartners || [],
    );

    if (partners.length === 0) return { matched: false };

    const partner = partners[0].session;
    const roomId = crypto.randomUUID();
    const endsAt = new Date(Date.now() + MATCH_DURATION_MS);

    // Update Partner
    const updatedPrev = [...(partner.previousPartners || []), userId].slice(
      -REMATCH_PREVENTION_COUNT,
    );
    await rouletteRepo.updateSession(partner.id, {
      status: "matched",
      previousPartners: updatedPrev,
    });

    const selfPrev = [
      ...(session.previousPartners || []),
      partner.userId,
    ].slice(-REMATCH_PREVENTION_COUNT);
    await rouletteRepo.updateSession(session.id, {
      status: "matched",
      previousPartners: selfPrev,
    });

    const matchRecord = await rouletteRepo.createMatchRecord(
      session.id,
      partner.id,
      roomId,
      endsAt,
    );

    return {
      matched: true,
      roomId,
      partnerId: partner.userId,
      matchId: matchRecord.id,
      endsAt,
    };
  },
};
