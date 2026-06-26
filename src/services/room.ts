import { RoomLayout } from "../models/RoomLayout";
import { User } from "../models/User";
import { FURNITURE_CATALOG, type FurnitureItem } from "../data/furniture";
import { debitBalance, getBalance } from "./resources";
import { getItemQuantity, removeItem } from "./inventory";
import { getBalances } from "./resources";

const FLOOR_ITEM_IDS = new Set(["wood_floor", "iron_floor", "fancy_floor"]);

function isFloorItem(itemId: string): boolean {
  return FLOOR_ITEM_IDS.has(itemId);
}

type LayoutEntryInput = {
  itemId: string;
  x: number;
  y: number;
  instanceId?: string;
  rotated?: boolean;
  rotation?: number;
};

function normalizeRotation(value?: number | boolean | null): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return ((Math.round(value) % 4) + 4) % 4;
  }
  if (value === true) return 1;
  return 0;
}

function normalizeLayoutEntry(entry: LayoutEntryInput, index: number) {
  const rotation = normalizeRotation(
    entry.rotation ?? (entry.rotated ? 1 : 0)
  );
  return {
    itemId: entry.itemId,
    x: entry.x,
    y: entry.y,
    instanceId: entry.instanceId ?? `${entry.itemId}-${entry.x}-${entry.y}-${index}`,
    rotation,
    rotated: rotation === 1 || rotation === 3,
  };
}

function splitLayoutAndFloor(layout: LayoutEntryInput[], storedFloorId: string | null) {
  const floorEntry = layout.find((e) => isFloorItem(e.itemId));
  const furniture = layout
    .filter((e) => !isFloorItem(e.itemId))
    .map((e, i) => normalizeLayoutEntry(e, i));
  const floorId = storedFloorId ?? floorEntry?.itemId ?? null;
  return { furniture, floorId };
}

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

  const { furniture, floorId } = splitLayoutAndFloor(room.layout, room.floorId ?? null);

  return {
    catalog: FURNITURE_CATALOG,
    ownedFurniture: room.ownedFurniture,
    layout: furniture,
    floorId,
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
  layout: LayoutEntryInput[],
  floorId?: string | null
) {
  const room = await RoomLayout.findOne({ userId });
  if (!room) throw new Error("Room not found");

  const furniture = layout
    .filter((e) => !isFloorItem(e.itemId))
    .map((e, i) => normalizeLayoutEntry(e, i));

  for (const entry of furniture) {
    if (!room.ownedFurniture.includes(entry.itemId)) {
      throw new Error(`You do not own ${entry.itemId}`);
    }
  }

  if (floorId != null) {
    if (!isFloorItem(floorId)) {
      throw new Error("Invalid floor item");
    }
    if (!room.ownedFurniture.includes(floorId)) {
      throw new Error(`You do not own ${floorId}`);
    }
    room.floorId = floorId;
  }

  room.layout = furniture;
  await room.save();
  return { layout: room.layout, floorId: room.floorId };
}

/** Public read-only crib for viewing another player's room. */
export async function getPublicRoomLayout(userId: string) {
  const user = await User.findById(userId).select("username").lean();
  if (!user) throw new Error("User not found");

  let room = await RoomLayout.findOne({ userId });
  if (!room) {
    room = await RoomLayout.create({ userId });
  }

  const { furniture, floorId } = splitLayoutAndFloor(room.layout, room.floorId ?? null);

  return {
    username: user.username,
    catalog: FURNITURE_CATALOG,
    layout: furniture,
    floorId,
  };
}
