import type { NftToken, RarityTier } from "./economy";

export function formatRarity(tier: RarityTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** Server-authoritative display label from synced NFT data. */
export function getChomperLabel(nfts: NftToken[]): string {
  if (nfts.length === 0) return "Chomper Recruit";
  const primary = nfts[0];
  return `Chomper #${primary.tokenId} (${formatRarity(primary.rarity)})`;
}
