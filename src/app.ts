import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import playerRoutes from "./routes/player";
import plotsRoutes from "./routes/plots";

export function createApp(ensureDb: () => Promise<void>): express.Application {
  const app = express();
  const webUrl = process.env.WEB_URL || "http://localhost:3000";
  const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: [webUrl, "http://localhost:3000", "http://127.0.0.1:3000", ...extraOrigins],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use(async (_req, _res, next) => {
    try {
      await ensureDb();
      next();
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "chomperz-api" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/player", playerRoutes);
  app.use("/api/plots", plotsRoutes);

  return app;
}
