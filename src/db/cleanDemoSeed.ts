import { Land } from "../models/Land";
import { getPlotName } from "../lib/economy";

/** Known fake wallets/handles from legacy demo seed (plot #12). */
export const DEMO_OWNER_WALLETS = ["0xdinowhale000000000000000000000000000001"];

export const DEMO_RENTER_WALLETS = [
  "0xchompking000000000000000000000000001",
  "0xrexhunter00000000000000000000000001",
  "0xjurassicx0000000000000000000000001",
];

export const DEMO_TWITTER_HANDLES = ["@DinoWhale", "@ChompKing", "@RexHunter", "@JurassicX"];

function unclaimedPlotFields(plotId: number) {
  const isLegendary = plotId < 10;
  return {
    type: isLegendary ? ("legendary" as const) : ("frontier" as const),
    legendaryTokenId: isLegendary ? plotId + 1 : null,
    name: getPlotName(plotId),
    ownerId: null,
    ownerWallet: null,
    landlordHandle: null,
    landlordAvatarUrl: null,
    purchasePrice: 0,
    lastClaimAt: null,
    abandonedAt: null,
    previousOwnerId: null,
    status: "unclaimed" as const,
    renters: [],
  };
}

export function demoLandQuery() {
  return {
    $or: [
      { ownerWallet: { $in: DEMO_OWNER_WALLETS } },
      { landlordHandle: { $in: DEMO_TWITTER_HANDLES } },
      { "renters.walletAddress": { $in: DEMO_RENTER_WALLETS } },
      { "renters.twitterHandle": { $in: DEMO_TWITTER_HANDLES } },
    ],
  };
}

/** Remove legacy demo seed data from any matching plots. Returns reset plotIds. */
export async function cleanDemoSeedLands(): Promise<number[]> {
  const matches = await Land.find(demoLandQuery()).select("plotId").lean();
  const plotIds = matches.map((p) => p.plotId);

  for (const plotId of plotIds) {
    await Land.updateOne({ plotId }, { $set: unclaimedPlotFields(plotId) });
  }

  return plotIds.sort((a, b) => a - b);
}
