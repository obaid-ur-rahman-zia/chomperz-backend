import { Types } from "mongoose";
import { Resource, type CurrencyType } from "../models/Resource";
import { Transaction, type TransactionKind } from "../models/Transaction";

export async function getBalance(
  userId: string,
  type: CurrencyType
): Promise<number> {
  const doc = await Resource.findOne({ userId, type });
  return doc?.balance ?? 0;
}

export async function getBalances(userId: string): Promise<{ zCoins: number; coins: number }> {
  const docs = await Resource.find({ userId });
  let zCoins = 0;
  let coins = 0;
  for (const doc of docs) {
    if (doc.type === "zCoins") zCoins = doc.balance;
    if (doc.type === "coins") coins = doc.balance;
  }
  return { zCoins, coins };
}

export async function ensureResources(userId: string): Promise<void> {
  const oid = new Types.ObjectId(userId);
  for (const type of ["zCoins", "coins"] as CurrencyType[]) {
    await Resource.updateOne(
      { userId: oid, type },
      { $setOnInsert: { userId: oid, type, balance: 0 } },
      { upsert: true }
    );
  }
}

interface AdjustOptions {
  userId: string;
  currency: CurrencyType;
  amount: number;
  type: TransactionKind;
  meta?: Record<string, unknown>;
}

/** Positive amount = credit, negative = debit. */
export async function adjustBalance(opts: AdjustOptions): Promise<number> {
  await ensureResources(opts.userId);

  if (opts.amount < 0) {
    const debit = Math.abs(opts.amount);
    const updated = await Resource.findOneAndUpdate(
      { userId: opts.userId, type: opts.currency, balance: { $gte: debit } },
      { $inc: { balance: opts.amount } },
      { new: true }
    );
    if (!updated) {
      throw new Error(`Insufficient ${opts.currency}`);
    }
    await Transaction.create({
      userId: opts.userId,
      type: opts.type,
      currency: opts.currency,
      amount: opts.amount,
      balanceAfter: updated.balance,
      meta: opts.meta ?? {},
    });
    return updated.balance;
  }

  const updated = await Resource.findOneAndUpdate(
    { userId: opts.userId, type: opts.currency },
    { $inc: { balance: opts.amount } },
    { new: true, upsert: true }
  );

  if (!updated) {
    throw new Error("Failed to update balance");
  }

  await Transaction.create({
    userId: opts.userId,
    type: opts.type,
    currency: opts.currency,
    amount: opts.amount,
    balanceAfter: updated.balance,
    meta: opts.meta ?? {},
  });

  return updated.balance;
}

export async function creditBalance(
  userId: string,
  currency: CurrencyType,
  amount: number,
  type: TransactionKind,
  meta?: Record<string, unknown>
): Promise<number> {
  return adjustBalance({ userId, currency, amount, type, meta });
}

export async function debitBalance(
  userId: string,
  currency: CurrencyType,
  amount: number,
  type: TransactionKind,
  meta?: Record<string, unknown>
): Promise<number> {
  return adjustBalance({ userId, currency, amount: -amount, type, meta });
}
