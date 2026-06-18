import {
  creditBalance,
  debitBalance,
  getBalance,
  getBalances,
  ensureResources,
  adjustBalance,
} from "./resources";

/** Transaction ledger helpers — all balance changes go through resources service. */
export const TransactionService = {
  credit: creditBalance,
  debit: debitBalance,
  getBalance,
  getBalances,
  ensureResources,
  adjust: adjustBalance,
};
