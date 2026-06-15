import { LandPlot } from "../models/LandPlot";
import { getPlotName } from "../lib/economy";

export async function seedLandPlots(): Promise<void> {
  const count = await LandPlot.countDocuments();
  if (count >= 100) return;

  const plots = Array.from({ length: 100 }, (_, plotId) => {
    const isLegendary = plotId < 10;
    return {
      plotId,
      isLegendary,
      legendaryTokenId: isLegendary ? plotId + 1 : null,
      name: getPlotName(plotId),
      ownerWallet: null,
      status: "unclaimed" as const,
      renters: [],
    };
  });

  await LandPlot.deleteMany({});
  await LandPlot.insertMany(plots);
  console.log("Seeded 100 land plots");
}
