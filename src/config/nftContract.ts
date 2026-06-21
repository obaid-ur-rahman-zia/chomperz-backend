const PRODUCTION_COLLECTION_NAME = "Chomperz";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Active ERC-721 address for sync, multiplier, and webhooks. */
export function getNftContractAddress(): string {
  if (isProduction()) {
    const chomperz = process.env.CONTRACT_ADDRESS?.trim();
    if (!chomperz) {
      throw new Error("CONTRACT_ADDRESS (Chomperz) is required in production");
    }
    return chomperz.toLowerCase();
  }

  const dev = process.env.DEV_NFT_CONTRACT_ADDRESS?.trim();
  if (dev) return dev.toLowerCase();

  const fallback = process.env.CONTRACT_ADDRESS?.trim();
  if (!fallback) {
    throw new Error(
      "Set DEV_NFT_CONTRACT_ADDRESS or CONTRACT_ADDRESS for NFT sync in development"
    );
  }
  return fallback.toLowerCase();
}

export function getNftCollectionName(): string {
  if (isProduction()) return PRODUCTION_COLLECTION_NAME;
  if (process.env.DEV_NFT_CONTRACT_ADDRESS?.trim()) {
    return process.env.DEV_NFT_COLLECTION_NAME?.trim() || "Demo NFT";
  }
  return PRODUCTION_COLLECTION_NAME;
}

export function isUsingDevNftContract(): boolean {
  if (isProduction()) return false;
  return Boolean(process.env.DEV_NFT_CONTRACT_ADDRESS?.trim());
}

/** Call at startup; logs warnings for misconfiguration. */
export function validateNftContractConfig(): void {
  if (isProduction()) {
    if (process.env.DEV_NFT_CONTRACT_ADDRESS?.trim()) {
      console.warn(
        "DEV_NFT_CONTRACT_ADDRESS is set but ignored in production — using CONTRACT_ADDRESS only"
      );
    }
    getNftContractAddress();
    return;
  }

  const hasDev = Boolean(process.env.DEV_NFT_CONTRACT_ADDRESS?.trim());
  const hasMain = Boolean(process.env.CONTRACT_ADDRESS?.trim());
  if (!hasDev && !hasMain) {
    console.warn(
      "No NFT contract configured. Set DEV_NFT_CONTRACT_ADDRESS (e.g. Astrachip Munks) for testing."
    );
  }
}
