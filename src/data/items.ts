export interface ItemDefinition {
  id: string;
  name: string;
  shortLabel: string;
}

export const ITEM_CATALOG: Record<string, ItemDefinition> = {
  wood: { id: "wood", name: "Wood", shortLabel: "Wood" },
  ore: { id: "ore", name: "Iron Ore", shortLabel: "Ore" },
  plank: { id: "plank", name: "Wooden Plank", shortLabel: "Plank" },
  ingot: { id: "ingot", name: "Iron Bar", shortLabel: "Bar" },
};

export const ITEM_IDS = Object.keys(ITEM_CATALOG);
