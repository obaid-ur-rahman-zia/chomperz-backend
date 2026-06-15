import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import mongoose from "mongoose";
import { createApp } from "./app";
import { seedLandPlots } from "./db/seed";

let dbReady: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!dbReady) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      dbReady = Promise.reject(new Error("MONGODB_URI is required"));
    } else {
      dbReady = mongoose.connect(mongoUri).then(async () => {
        await seedLandPlots();
      });
    }
  }
  return dbReady;
}

const app = createApp(ensureDb);
const PORT = process.env.PORT || 3001;

if (process.env.VERCEL !== "1") {
  ensureDb()
    .then(() => {
      console.log("MongoDB connected");
      app.listen(PORT, () => {
        console.log(`Chomperz API running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}

export default app;
