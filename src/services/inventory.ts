import { Inventory } from "../models/Inventory";
import { ITEM_CATALOG } from "../data/items";

export async function getInventory(userId: string) {
  const rows = await Inventory.find({ userId, quantity: { $gt: 0 } }).lean();
  const map = new Map(rows.map((r) => [r.itemId, r.quantity]));

  return Object.values(ITEM_CATALOG).map((def) => ({
      itemId: def.id,
      name: def.name,
      shortLabel: def.shortLabel,
      quantity: map.get(def.id) ?? 0,
    }));
}

export async function getItemQuantity(userId: string, itemId: string): Promise<number> {
  const row = await Inventory.findOne({ userId, itemId }).lean();
  return row?.quantity ?? 0;
}

export async function addItem(
  userId: string,
  itemId: string,
  quantity: number
): Promise<number> {
  if (quantity <= 0) throw new Error("quantity must be positive");
  const row = await Inventory.findOneAndUpdate(
    { userId, itemId },
    { $inc: { quantity } },
    { upsert: true, new: true }
  );
  return row.quantity;
}

export async function removeItem(
  userId: string,
  itemId: string,
  quantity: number
): Promise<number> {
  if (quantity <= 0) throw new Error("quantity must be positive");
  const row = await Inventory.findOne({ userId, itemId });
  if (!row || row.quantity < quantity) {
    throw new Error("Insufficient items");
  }
  row.quantity -= quantity;
  await row.save();
  return row.quantity;
}
