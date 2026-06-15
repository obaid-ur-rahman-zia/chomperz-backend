import type { NftToken, RarityTier } from "./types";

const RARITY_BOOST: Record<RarityTier, number> = {
  common: 0.02,
  uncommon: 0.05,
  rare: 0.12,
  legendary: 0.25,
};

export function calculateQuantityBoost(nftCount: number): number {
  let q = 0;
  for (let i = 1; i <= nftCount; i++) {
    if (i <= 3) q += 0.25;
    else if (i <= 10) q += 0.15;
    else q += 0.05;
  }
  return q;
}

export function calculateRarityBoost(nfts: NftToken[]): number {
  return nfts.reduce((sum, nft) => sum + RARITY_BOOST[nft.rarity], 0);
}

export function calculateNftMultiplier(nfts: NftToken[]): number {
  if (nfts.length === 0) return 1;
  return 1 + calculateQuantityBoost(nfts.length) + calculateRarityBoost(nfts);
}

export function calculatePowerMultiplier(powerLvl: number): number {
  return Math.pow(1.015, powerLvl);
}

export function rarityFromTokenRank(rank: number): RarityTier {
  if (rank <= 100) return "legendary";
  if (rank <= 1000) return "rare";
  if (rank <= 5000) return "uncommon";
  return "common";
}

export function defaultRarityFromTokenId(tokenId: number): RarityTier {
  return rarityFromTokenRank(tokenId);
}

export function buildNftListFromTokenIds(tokenIds: number[]): NftToken[] {
  return tokenIds.map((tokenId) => ({
    tokenId,
    rarity: defaultRarityFromTokenId(tokenId),
  }));
}

export function buildNftListFromCount(count: number): NftToken[] {
  return Array.from({ length: count }, (_, i) => ({
    tokenId: i + 1,
    rarity: "common" as RarityTier,
  }));
}
