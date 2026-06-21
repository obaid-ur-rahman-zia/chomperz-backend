import dotenv from "dotenv";
import path from "path";
import http from "http";

if (process.env.VERCEL !== "1") {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

import mongoose from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import { createApp } from "./app";
import { validateNftContractConfig } from "./config/nftContract";
import { bootstrapDatabase } from "./db/bootstrap";
import { initTerritorySocket } from "./socket/territory";

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
      validateNftContractConfig();
      console.log("MongoDB connected");
      const server = http.createServer(app);
      const webUrl = process.env.WEB_URL || "http://localhost:3000";
      const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      const io = new SocketIOServer(server, {
        cors: {
          origin: [webUrl, "http://localhost:3000", "http://127.0.0.1:3000", ...extraOrigins],
          credentials: true,
        },
      });
      initTerritorySocket(io);

      server.listen(PORT, () => {
        console.log(`Chomperz API running on http://localhost:${PORT} (HTTP + Socket.IO)`);
      });
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}

export default app;
