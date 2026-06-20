import mongoose from "mongoose";
import { Land } from "../models/Land";
import { getPlotName } from "../lib/economy";
import { MS_PER_DAY } from "../lib/constants";

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
    await seedDemoPlot();
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
  await seedDemoPlot();
}

function demoRenter(
  walletAddress: string,
  twitterHandle: string,
  sevenDayBid: number
) {
  const now = new Date();
  return {
    walletAddress,
    twitterHandle,
    sevenDayBid,
    dailyBid: Math.floor(sevenDayBid / 7),
    escrowBalance: sevenDayBid,
    leaseStartedAt: now,
    leaseExpiresAt: new Date(now.getTime() + 7 * MS_PER_DAY),
    lastRentPayoutAt: now,
  };
}

export async function seedDemoPlot(): Promise<void> {
  await Land.updateOne(
    { plotId: 11 },
    {
      $set: {
        name: "The Overgrowth Zone",
        type: "frontier",
        status: "owned",
        lastClaimAt: new Date(),
        ownerWallet: "0xdinowhale000000000000000000000000000001",
        landlordHandle: "@DinoWhale",
        landlordAvatarUrl: "/images/chomper.jpg",
        renters: [
          demoRenter("0xchompking000000000000000000000000001", "@ChompKing", 3500),
          demoRenter("0xrexhunter00000000000000000000000001", "@RexHunter", 3150),
          demoRenter("0xjurassicx0000000000000000000000001", "@JurassicX", 2800),
        ],
      },
    }
  );
}
