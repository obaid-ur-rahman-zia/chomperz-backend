import { Router, Request, Response } from "express";
import { getLeaderboard, type LeaderboardBoard } from "../services/leaderboard";

const router = Router();

const BOARDS: LeaderboardBoard[] = ["zCoins", "coins", "power", "nfts"];

router.get("/", async (req: Request, res: Response) => {
  const board = (req.query.board as string) || "zCoins";
  if (!BOARDS.includes(board as LeaderboardBoard)) {
    res.status(400).json({ error: "Invalid board type" });
    return;
  }

  const rows = await getLeaderboard(board as LeaderboardBoard);
  res.json({ board, rows });
});

export default router;
