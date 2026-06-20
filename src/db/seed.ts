import mongoose from "mongoose";
import { Land } from "../models/Land";
import { getPlotName } from "../lib/economy";

export async function dropLegacyCollections(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  for (const name of ["players", "landplots"]) {
    try {
      await db.dropCollection(name);
      console.log(`Dropped legacy collection: ${name}`);
    } catch {
      /* collection may not exist */
    }
  }
}

export async function seedLands(): Promise<void> {
  const count = await Land.countDocuments();
  if (count >= 100) {
    return;
  }

  const plots = Array.from({ length: 100 }, (_, plotId) => {
    const isLegendary = plotId < 10;
    return {
      plotId,
      type: isLegendary ? ("legendary" as const) : ("frontier" as const),
      legendaryTokenId: isLegendary ? plotId + 1 : null,
      name: getPlotName(plotId),
      ownerId: null,
      ownerWallet: null,
      landlordHandle: null,
      landlordAvatarUrl: null,
      purchasePrice: 0,
      lastClaimAt: null,
      status: "unclaimed" as const,
      renters: [],
    };
  });

  await Land.deleteMany({});
  await Land.insertMany(plots);
  console.log("Seeded 100 lands");
}
