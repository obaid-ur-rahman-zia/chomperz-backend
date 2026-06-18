import { RoomLayout } from "../models/RoomLayout";
import { FURNITURE_CATALOG } from "../data/furniture";
import { debitBalance, getBalance } from "./resources";

export async function getRoomLayout(userId: string) {
  let room = await RoomLayout.findOne({ userId });
  if (!room) {
    room = await RoomLayout.create({ userId });
  }
  const zCoins = await getBalance(userId, "zCoins");
  return {
    catalog: FURNITURE_CATALOG,
    ownedFurniture: room.ownedFurniture,
    layout: room.layout,
    zCoins,
  };
}

export async function buyFurniture(userId: string, itemId: string) {
  const item = FURNITURE_CATALOG.find((f) => f.id === itemId);
  if (!item) throw new Error("Unknown furniture item");

  const room = await RoomLayout.findOne({ userId });
  if (!room) throw new Error("Room not found");
  if (room.ownedFurniture.includes(item.id)) {
    throw new Error("Already owned");
  }

  const zCoins = await debitBalance(userId, "zCoins", item.price, "crib_buy", { itemId });
  room.ownedFurniture.push(item.id);
  await room.save();

  return { zCoins, ownedFurniture: room.ownedFurniture };
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
