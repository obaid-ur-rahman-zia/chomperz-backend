import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { cleanDemoSeedLands } from "../src/db/cleanDemoSeed";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is required (set in backend/.env or environment).");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const plotIds = await cleanDemoSeedLands();

  if (plotIds.length === 0) {
    console.log("No demo seed plots found — nothing to clean.");
  } else {
    for (const plotId of plotIds) {
      console.log(`Reset plot #${String(plotId + 1).padStart(2, "0")} (plotId ${plotId}) to unclaimed.`);
    }
    console.log(`Cleaned ${plotIds.length} demo plot(s).`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("clean-demo-seed failed:", err);
  process.exit(1);
});
