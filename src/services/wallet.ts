import { Wallet } from "../models/Wallet";
import { Nft } from "../models/Nft";
import { User } from "../models/User";
import { resetUserNftCache } from "./user";

export class WalletLinkError extends Error {
  status: number;
  code: string;

  constructor(message: string, code: string, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function getWalletAddress(userId: string): Promise<string | null> {
  const wallet = await Wallet.findOne({ userId });
  return wallet?.address ?? null;
}

export async function linkWallet(userId: string, address: string): Promise<void> {
  const normalized = address.toLowerCase();

  const existingByAddress = await Wallet.findOne({ address: normalized });
  if (existingByAddress && existingByAddress.userId.toString() !== userId) {
    const otherUser = await User.findById(existingByAddress.userId).select("username");
    const otherHandle = otherUser?.username ?? "another Twitter account";
    throw new WalletLinkError(
      `This wallet is already linked to ${otherHandle}. Log in with that Twitter account, disconnect the wallet, then try again.`,
      "wallet_linked_elsewhere"
    );
  }

  const existingByUser = await Wallet.findOne({ userId });
  if (existingByUser) {
    if (existingByUser.address === normalized) return;
    throw new WalletLinkError(
      "Your Twitter account already has a wallet linked. Disconnect it before linking a different wallet.",
      "wallet_already_linked"
    );
  }

  await Wallet.create({ userId, address: normalized });
}

export async function unlinkWallet(userId: string): Promise<void> {
  await Wallet.deleteOne({ userId });
  await Nft.deleteMany({ userId });
  await resetUserNftCache(userId);
}
