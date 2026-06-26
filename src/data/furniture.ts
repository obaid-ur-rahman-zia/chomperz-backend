export interface FurnitureCost {
  coins?: number;
  zCoins?: number;
  wood?: number;
  plank?: number;
  ore?: number;
  ingot?: number;
}

export interface FurnitureItem {
  id: string;
  name: string;
  tier: "wooden" | "iron" | "fancy";
  cost: FurnitureCost;
  w: number;
  h: number;
  color: string;
  shortLabel: string;
}

export const FURNITURE_CATALOG: FurnitureItem[] = [
  {
    id: "wood_chair",
    name: "Wooden Chair",
    tier: "wooden",
    cost: { coins: 10, plank: 25 },
    w: 1,
    h: 1,
    color: "#8B6914",
    shortLabel: "WC",
  },
  {
    id: "wood_table",
    name: "Wooden Table",
    tier: "wooden",
    cost: { coins: 50, plank: 100 },
    w: 1,
    h: 1,
    color: "#8B6914",
    shortLabel: "WT",
  },
  {
    id: "wood_floor",
    name: "Wooden Floor",
    tier: "wooden",
    cost: { coins: 5, plank: 20 },
    w: 2,
    h: 2,
    color: "#A0822D",
    shortLabel: "WF",
  },
  {
    id: "iron_chair",
    name: "Iron Chair",
    tier: "iron",
    cost: { coins: 20, ingot: 25 },
    w: 1,
    h: 1,
    color: "#7f8c8d",
    shortLabel: "IC",
  },
  {
    id: "iron_table",
    name: "Iron Table",
    tier: "iron",
    cost: { coins: 100, ingot: 100 },
    w: 1,
    h: 1,
    color: "#7f8c8d",
    shortLabel: "IT",
  },
  {
    id: "iron_floor",
    name: "Iron Floor",
    tier: "iron",
    cost: { coins: 10, ingot: 20 },
    w: 2,
    h: 2,
    color: "#95a5a6",
    shortLabel: "IF",
  },
  {
    id: "fancy_chair",
    name: "Fancy Chair",
    tier: "fancy",
    cost: { zCoins: 15 },
    w: 1,
    h: 1,
    color: "#9b59b6",
    shortLabel: "FC",
  },
  {
    id: "fancy_table",
    name: "Fancy Table",
    tier: "fancy",
    cost: { zCoins: 50 },
    w: 1,
    h: 1,
    color: "#9b59b6",
    shortLabel: "FT",
  },
  {
    id: "fancy_floor",
    name: "Fancy Floor",
    tier: "fancy",
    cost: { zCoins: 10 },
    w: 2,
    h: 2,
    color: "#8e44ad",
    shortLabel: "FF",
  },
  {
    id: "fancy_statue",
    name: "Fancy Statue",
    tier: "fancy",
    cost: { zCoins: 500 },
    w: 1,
    h: 2,
    color: "#fbc531",
    shortLabel: "ST",
  },
];

export const CRIB_GRID_COLS = 8;
export const CRIB_GRID_ROWS = 5;
