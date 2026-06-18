import crypto from "crypto";
import { Router, Request, Response } from "express";
import { OAuthState } from "../models/OAuthState";
import { SiweNonce } from "../models/SiweNonce";
import { requireAuth, setAuthCookie, signToken } from "../middleware/auth";
import { bootstrapUser } from "../services/user";
import { linkWallet, unlinkWallet, WalletLinkError } from "../services/wallet";
import { validateChainId } from "../services/nft";

const router = Router();

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

function authTokenFromUser(user: { _id: { toString(): string }; twitterId: string; username: string }) {
  return signToken({
    playerId: user._id.toString(),
    userId: user._id.toString(),
    twitterId: user.twitterId,
    twitterHandle: user.username,
  });
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
  const { user } = await bootstrapUser({
    twitterId,
    username: handle.startsWith("@") ? handle : `@${handle}`,
  });
  const token = authTokenFromUser(user);
  setAuthCookie(res, token);
  res.json({ success: true, token, player: user });
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
      res.redirect(loginRedirect(webUrl, "token_exchange_failed", "missing access_token"));
      return;
    }

    let profile: { id: string; username: string; profile_image_url?: string };
    try {
      profile = await fetchTwitterProfile(tokenData.access_token);
    } catch (err) {
      const errBody = err instanceof Error ? err.message : "Twitter user fetch failed";
      let errorCode = "user_fetch_failed";
      if (errBody.includes("Unsupported Authentication")) errorCode = "user_context_required";
      else if (errBody.includes("Forbidden") || errBody.includes("403")) errorCode = "twitter_forbidden";
      res.redirect(loginRedirect(webUrl, errorCode, errBody));
      return;
    }

    const { user } = await bootstrapUser({
      twitterId: profile.id,
      username: profile.username,
      profilePicUrl: profile.profile_image_url,
    });

    const jwt = authTokenFromUser(user);
    setAuthCookie(res, jwt);
    res.redirect(`${webUrl}/auth/callback#token=${jwt}`);
  } catch (err) {
    console.error("Twitter callback error:", err);
    const detail = err instanceof Error ? err.message : "unknown";
    res.redirect(loginRedirect(webUrl, "server_error", detail));
  }
});

router.get("/nonce", requireAuth, async (req: Request, res: Response) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  await SiweNonce.create({ nonce, userId: req.auth!.playerId });
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

    validateChainId(fields.data.chainId);

    const stored = await SiweNonce.findOneAndDelete({ nonce: fields.data.nonce });
    if (!stored || stored.userId !== req.auth!.playerId) {
      res.status(400).json({ error: "Invalid or expired nonce" });
      return;
    }

    const wallet = fields.data.address.toLowerCase();
    try {
      await linkWallet(req.auth!.playerId, wallet);
    } catch (err) {
      if (err instanceof WalletLinkError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }

    res.json({ success: true, walletAddress: wallet });
  } catch (err) {
    console.error("SIWE verify error:", err);
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    res.status(400).json({ error: msg });
  }
});

router.post("/disconnect-wallet", requireAuth, async (req: Request, res: Response) => {
  await unlinkWallet(req.auth!.playerId);
  res.json({ success: true });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("chomperz_token", { path: "/" });
  res.json({ success: true });
});

export default router;
