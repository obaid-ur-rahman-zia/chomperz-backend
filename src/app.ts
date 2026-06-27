import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import playerRoutes from "./routes/player";
import plotsRoutes from "./routes/plots";
import leaderboardRoutes from "./routes/leaderboard";
import webhookRoutes from "./routes/webhooks";
import adminRoutes from "./routes/admin";
import playersRoutes from "./routes/players";

export function createApp(ensureDb: () => Promise<void>): express.Application {
  const app = express();
  const webUrl = process.env.WEB_URL || "http://localhost:3000";
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 10_000);
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
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        if (req.url?.startsWith("/api/webhooks")) {
          (req as express.Request & { rawBody?: string }).rawBody = buf.toString("utf8");
        }
      },
    })
  );
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: Number.isFinite(rateLimitWindowMs) ? rateLimitWindowMs : 60_000,
      max: Number.isFinite(rateLimitMax) ? rateLimitMax : 10_000,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === "/api/health" || req.path.startsWith("/api/webhooks"),
      message: { error: "Too Many Requests" },
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
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/players", playersRoutes);

  return app;
}
