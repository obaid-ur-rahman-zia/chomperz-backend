export interface FurnitureItem {
  id: string;
  name: string;
  price: number;
  w: number;
  h: number;
  color: string;
  shortLabel: string;
}

export const FURNITURE_CATALOG: FurnitureItem[] = [
  { id: "fern", name: "Potted Fern", price: 50, w: 1, h: 1, color: "#4cd137", shortLabel: "FN" },
  { id: "couch", name: "Comfy Couch", price: 120, w: 2, h: 1, color: "#00a8ff", shortLabel: "CV" },
  { id: "arcade", name: "Retro Arcade", price: 200, w: 1, h: 1, color: "#9b59b6", shortLabel: "AR" },
  { id: "fossil", name: "Gold T-Rex Fossil", price: 500, w: 3, h: 2, color: "#fbc531", shortLabel: "TX" },
];

export const CRIB_GRID_COLS = 8;
export const CRIB_GRID_ROWS = 5;
