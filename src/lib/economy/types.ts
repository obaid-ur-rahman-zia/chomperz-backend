export type RarityTier = "common" | "uncommon" | "rare" | "legendary";
export type PlotStatus = "unclaimed" | "owned" | "abandoned";

export interface NftToken {
  tokenId: number;
  rarity: RarityTier;
}

export interface EconomyBreakdown {
  nftCount: number;
  quantityBoost: number;
  rarityBoost: number;
  nftMultiplier: number;
  powerMultiplier: number;
  dailyRate: number;
}

export interface PlayerEconomyInput {
  nfts: NftToken[];
  powerLvl: number;
}

export const BASE_Z_COINS_PER_DAY = 1;
export const POWER_COMPOUND_RATE = 1.015;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PLOT_NAMES: Record<number, string> = {
  0: "Crown Throne",
  1: "Ancient Nest",
  2: "Royal Roost",
  3: "Golden Gorge",
  4: "Mythic Mesa",
  5: "Sovereign Sands",
  6: "Ember Crown",
  7: "Crystal Crater",
  8: "Primeval Peak",
  9: "Legend's Lair",
  12: "The Overgrowth Zone",
};

export function getPlotName(plotId: number): string {
  return PLOT_NAMES[plotId] ?? `Plot Sector ${plotId + 1}`;
}
