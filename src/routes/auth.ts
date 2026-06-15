import crypto from "crypto";
import { Router, Request, Response } from "express";
import { Player } from "../models/Player";
import { OAuthState } from "../models/OAuthState";
import { requireAuth, setAuthCookie, signToken } from "../middleware/auth";

const router = Router();
const siweNonces = new Map<string, { nonce: string; playerId: string; createdAt: number }>();

function cleanExpiredSiwe(): void {
  const maxAge = 10 * 60 * 1000;
  const now = Date.now();
  for (const [k, v] of siweNonces) if (now - v.createdAt > maxAge) siweNonces.delete(k);
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function loginRedirect(webUrl: string, error: string, detail?: string): string {
  const params = new URLSearchParams({ error });
  if (detail) {
    params.set("error_detail", detail.slice(0, 300));
  }
  return `${webUrl}/login?${params}`;
}

const X_API_HEADERS = {
  Authorization: "",
  "User-Agent": "Chomperz/1.0",
};

async function fetchTwitterProfile(accessToken: string): Promise<{
  id: string;
  username: string;
  profile_image_url?: string;
}> {
  const urls = [
    "https://api.x.com/2/users/me?user.fields=profile_image_url,username",
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url,username",
  ];

  let lastError = "";
  for (const url of urls) {
    const res = await fetch(url, {
      headers: { ...X_API_HEADERS, Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { id: string; username: string; profile_image_url?: string };
      };
      if (!body.data?.id || !body.data.username) {
        throw new Error("Twitter profile response missing user data");
      }
      return body.data;
    }
    lastError = await res.text();
    console.error("Twitter user fetch failed:", url, res.status, lastError);
  }

  throw new Error(lastError || "Twitter user fetch failed");
}

router.post("/mock-twitter", async (req: Request, res: Response) => {
  if (process.env.MOCK_TWITTER !== "true") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { handle } = req.body as { handle?: string };
  if (!handle?.trim()) {
    res.status(400).json({ error: "handle required" });
    return;
  }
  const twitterId = `mock_${handle.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  let player = await Player.findOne({ twitterId });
  if (!player) {
    player = await Player.create({
      twitterId,
      twitterHandle: handle.startsWith("@") ? handle : `@${handle}`,
    });
  }
  const token = signToken({
    playerId: player._id.toString(),
    twitterId: player.twitterId,
    twitterHandle: player.twitterHandle,
  });
  setAuthCookie(res, token);
  res.json({ success: true, token, player });
});

router.get("/twitter", async (_req: Request, res: Response) => {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const callbackUrl = process.env.TWITTER_CALLBACK_URL;
  const webUrl = process.env.WEB_URL || "http://localhost:3000";
  if (!clientId || !callbackUrl) {
    res.redirect(`${webUrl}/login?error=twitter_not_configured`);
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  await OAuthState.create({ state, codeVerifier });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "tweet.read users.read offline.access",
    state,
    code_challenge: generateCodeChallenge(codeVerifier),
    code_challenge_method: "S256",
  });
  res.redirect(`https://x.com/i/oauth2/authorize?${params}`);
});

router.get("/twitter/callback", async (req: Request, res: Response) => {
  const webUrl = process.env.WEB_URL || "http://localhost:3000";
  const { code, state, error } = req.query;
  if (error || !code || !state) {
    res.redirect(loginRedirect(webUrl, "oauth_denied"));
    return;
  }
  const stored = await OAuthState.findOneAndDelete({ state: state as string });
  if (!stored) {
    res.redirect(loginRedirect(webUrl, "invalid_state"));
    return;
  }
  try {
    const clientId = process.env.TWITTER_CLIENT_ID!;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET!;
    const callbackUrl = process.env.TWITTER_CALLBACK_URL!;
    const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        code: code as string,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        code_verifier: stored.codeVerifier,
      }),
    });
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Twitter token exchange failed:", tokenRes.status, errBody);
      let errorCode = "token_exchange_failed";
      try {
        const parsed = JSON.parse(errBody) as { error?: string };
        if (parsed.error === "invalid_client") errorCode = "invalid_client";
        else if (parsed.error === "redirect_uri_mismatch") errorCode = "redirect_uri_mismatch";
      } catch {
        /* use default */
      }
      res.redirect(loginRedirect(webUrl, errorCode, errBody));
      return;
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      console.error("Twitter token response missing access_token:", tokenData);
      res.redirect(loginRedirect(webUrl, "token_exchange_failed", "missing access_token"));
      return;
    }

    let profile: { id: string; username: string; profile_image_url?: string };
    try {
      profile = await fetchTwitterProfile(tokenData.access_token);
    } catch (err) {
      const errBody = err instanceof Error ? err.message : "Twitter user fetch failed";
      let errorCode = "user_fetch_failed";
      if (errBody.includes("Unsupported Authentication")) {
        errorCode = "user_context_required";
      } else if (errBody.includes("Forbidden") || errBody.includes("403")) {
        errorCode = "twitter_forbidden";
      }
      res.redirect(loginRedirect(webUrl, errorCode, errBody));
      return;
    }

    const { id: twitterId, username, profile_image_url } = profile;
    let player = await Player.findOne({ twitterId });
    if (!player) {
      player = await Player.create({
        twitterId,
        twitterHandle: `@${username}`,
        profilePicUrl: profile_image_url || "",
      });
    } else {
      player.twitterHandle = `@${username}`;
      player.profilePicUrl = profile_image_url || player.profilePicUrl;
      await player.save();
    }
    const jwt = signToken({
      playerId: player._id.toString(),
      twitterId: player.twitterId,
      twitterHandle: player.twitterHandle,
    });
    setAuthCookie(res, jwt);
    res.redirect(`${webUrl}/auth/callback#token=${jwt}`);
  } catch (err) {
    console.error("Twitter callback error:", err);
    res.redirect(loginRedirect(webUrl, "server_error"));
  }
});

router.get("/nonce", requireAuth, async (req: Request, res: Response) => {
  cleanExpiredSiwe();
  const nonce = crypto.randomBytes(16).toString("hex");
  siweNonces.set(nonce, {
    nonce,
    playerId: req.auth!.playerId,
    createdAt: Date.now(),
  });
  res.json({ nonce });
});

router.post("/verify-wallet", requireAuth, async (req: Request, res: Response) => {
  const { message, signature } = req.body as { message?: string; signature?: string };
  if (!message || !signature) {
    res.status(400).json({ error: "message and signature required" });
    return;
  }
  try {
    const { SiweMessage } = await import("siwe");
    const fields = await new SiweMessage(message).verify({ signature });
    const stored = siweNonces.get(fields.data.nonce);
    if (!stored || stored.playerId !== req.auth!.playerId) {
      res.status(400).json({ error: "Invalid or expired nonce" });
      return;
    }
    siweNonces.delete(fields.data.nonce);
    const wallet = fields.data.address.toLowerCase();
    const existing = await Player.findOne({ walletAddress: wallet });
    if (existing && existing._id.toString() !== req.auth!.playerId) {
      res.status(409).json({ error: "Wallet already linked to another account" });
      return;
    }
    const player = await Player.findById(req.auth!.playerId);
    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    player.walletAddress = wallet;
    await player.save();
    res.json({ success: true, walletAddress: wallet });
  } catch (err) {
    console.error("SIWE verify error:", err);
    res.status(400).json({ error: "Signature verification failed" });
  }
});

router.post("/disconnect-wallet", requireAuth, async (req: Request, res: Response) => {
  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  player.walletAddress = null;
  player.cachedNftCount = 0;
  player.cachedTokenIds = [];
  player.cachedRaritySum = 0;
  await player.save();
  res.json({ success: true });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("chomperz_token", { path: "/" });
  res.json({ success: true });
});

export default router;
