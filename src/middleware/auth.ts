import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export interface AuthPayload {
  playerId: string;
  userId: string;
  twitterId: string;
  twitterHandle: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.chomperz_token as string | undefined;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired session" });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.chomperz_token as string | undefined;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;

  if (token) {
    try {
      req.auth = verifyToken(token);
    } catch {
      /* ignore invalid token for optional routes */
    }
  }
  next();
}

export const COOKIE_NAME = "chomperz_token";

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}
