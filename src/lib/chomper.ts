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

/** Label for dashboard/profile — respects chosen NFT avatar when set. */
export function getChomperLabelForUser(
  user: { avatarSource?: "default" | "twitter" | "nft"; avatarNftTokenId?: number | null },
  ownedNfts: NftToken[]
): string {
  if (user.avatarSource === "nft" && user.avatarNftTokenId != null) {
    const match = ownedNfts.find((n) => n.tokenId === user.avatarNftTokenId);
    if (match) {
      return `Chomper #${match.tokenId} (${formatRarity(match.rarity)})`;
    }
    return `Chomper #${user.avatarNftTokenId}`;
  }
  return getChomperLabel(ownedNfts);
}
