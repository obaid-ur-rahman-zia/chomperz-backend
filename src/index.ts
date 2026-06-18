import dotenv from "dotenv";
import path from "path";

if (process.env.VERCEL !== "1") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

import mongoose from "mongoose";
import { createApp } from "./app";
import { bootstrapDatabase } from "./db/bootstrap";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalCache = globalThis as typeof globalThis & {
  __chomperzMongoose?: MongooseCache;
};

let dbReady: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!dbReady) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      dbReady = Promise.reject(new Error("MONGODB_URI is required"));
    } else {
      dbReady = (async () => {
        const cached = globalCache.__chomperzMongoose ?? { conn: null, promise: null };
        globalCache.__chomperzMongoose = cached;

        if (cached.conn) return;

        if (!cached.promise) {
          cached.promise = mongoose.connect(mongoUri);
        }

        cached.conn = await cached.promise;
        await bootstrapDatabase();
      })();
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
