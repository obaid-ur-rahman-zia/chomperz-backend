import { LandPlot } from "../models/LandPlot";
import { getPlotName } from "../lib/economy";

export async function seedLandPlots(): Promise<void> {
  const count = await LandPlot.countDocuments();
  if (count >= 100) {
    await seedDemoPlot();
    return;
  }

  const plots = Array.from({ length: 100 }, (_, plotId) => {
    const isLegendary = plotId < 10;
    return {
      plotId,
      isLegendary,
      legendaryTokenId: isLegendary ? plotId + 1 : null,
      name: getPlotName(plotId),
      ownerWallet: null,
      landlordHandle: null,
      landlordAvatarUrl: null,
      status: "unclaimed" as const,
      renters: [],
    };
  });

  await LandPlot.deleteMany({});
  await LandPlot.insertMany(plots);
  console.log("Seeded 100 land plots");
  await seedDemoPlot();
}

/** Demo data for plot #12 — matches client mockup */
export async function seedDemoPlot(): Promise<void> {
  await LandPlot.updateOne(
    { plotId: 11 },
    {
      $set: {
        name: "The Overgrowth Zone",
        status: "owned",
        ownerWallet: "0xdinowhale000000000000000000000000000001",
        landlordHandle: "@DinoWhale",
        landlordAvatarUrl: "/images/chomper.jpg",
        renters: [
          {
            walletAddress: "0xchompking000000000000000000000000001",
            twitterHandle: "@ChompKing",
            dailyBid: 500,
            escrowBalance: 5000,
          },
          {
            walletAddress: "0xrexhunter00000000000000000000000001",
            twitterHandle: "@RexHunter",
            dailyBid: 450,
            escrowBalance: 4500,
          },
          {
            walletAddress: "0xjurassicx0000000000000000000000001",
            twitterHandle: "@JurassicX",
            dailyBid: 400,
            escrowBalance: 4000,
          },
        ],
      },
    }
  );
}
