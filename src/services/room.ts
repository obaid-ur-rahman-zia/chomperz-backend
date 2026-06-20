import { RoomLayout } from "../models/RoomLayout";
import { FURNITURE_CATALOG, type FurnitureItem } from "../data/furniture";
import { debitBalance, getBalance } from "./resources";
import { getItemQuantity, removeItem } from "./inventory";
import { getBalances } from "./resources";

export async function getRoomLayout(userId: string) {
  let room = await RoomLayout.findOne({ userId });
  if (!room) {
    room = await RoomLayout.create({ userId });
  }
  const { zCoins, coins } = await getBalances(userId);
  const inventory: Record<string, number> = {};
  for (const key of ["wood", "ore", "plank", "ingot"] as const) {
    inventory[key] = await getItemQuantity(userId, key);
  }

  return {
    catalog: FURNITURE_CATALOG,
    ownedFurniture: room.ownedFurniture,
    layout: room.layout,
    zCoins,
    coins,
    inventory,
  };
}

async function debitCost(userId: string, item: FurnitureItem) {
  const { cost } = item;
  if (cost.zCoins) {
    await debitBalance(userId, "zCoins", cost.zCoins, "crib_buy", { itemId: item.id });
  }
  if (cost.coins) {
    await debitBalance(userId, "coins", cost.coins, "crib_buy", { itemId: item.id });
  }
  if (cost.wood) await removeItem(userId, "wood", cost.wood);
  if (cost.plank) await removeItem(userId, "plank", cost.plank);
  if (cost.ore) await removeItem(userId, "ore", cost.ore);
  if (cost.ingot) await removeItem(userId, "ingot", cost.ingot);
}

export async function buyFurniture(userId: string, itemId: string) {
  const item = FURNITURE_CATALOG.find((f) => f.id === itemId);
  if (!item) throw new Error("Unknown furniture item");

  const room = await RoomLayout.findOne({ userId });
  if (!room) throw new Error("Room not found");
  if (room.ownedFurniture.includes(item.id)) {
    throw new Error("Already owned");
  }

  const { cost } = item;
  if (cost.zCoins) {
    const bal = await getBalance(userId, "zCoins");
    if (bal < cost.zCoins) throw new Error("Insufficient Z-Coins");
  }
  if (cost.coins) {
    const bal = await getBalance(userId, "coins");
    if (bal < cost.coins) throw new Error("Insufficient Coins");
  }
  if (cost.wood && (await getItemQuantity(userId, "wood")) < cost.wood) {
    throw new Error("Insufficient wood");
  }
  if (cost.plank && (await getItemQuantity(userId, "plank")) < cost.plank) {
    throw new Error("Insufficient planks");
  }
  if (cost.ore && (await getItemQuantity(userId, "ore")) < cost.ore) {
    throw new Error("Insufficient iron ore");
  }
  if (cost.ingot && (await getItemQuantity(userId, "ingot")) < cost.ingot) {
    throw new Error("Insufficient iron bars");
  }

  await debitCost(userId, item);
  room.ownedFurniture.push(item.id);
  await room.save();

  const { zCoins, coins } = await getBalances(userId);
  const inventory: Record<string, number> = {};
  for (const key of ["wood", "ore", "plank", "ingot"] as const) {
    inventory[key] = await getItemQuantity(userId, key);
  }

  return { zCoins, coins, inventory, ownedFurniture: room.ownedFurniture };
}

export async function saveLayout(
  userId: string,
  layout: { itemId: string; x: number; y: number }[]
) {
  const room = await RoomLayout.findOne({ userId });
  if (!room) throw new Error("Room not found");

  for (const entry of layout) {
    if (!room.ownedFurniture.includes(entry.itemId)) {
      throw new Error(`You do not own ${entry.itemId}`);
    }
  }

  room.layout = layout;
  await room.save();
  return room.layout;
}
