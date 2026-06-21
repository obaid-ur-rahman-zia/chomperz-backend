import { ethers } from "ethers";
import {
  calculateNftMultiplier,
  defaultRarityFromTokenId,
  type NftToken,
  type RarityTier,
} from "../lib/economy";
import { getNftContractAddress } from "../config/nftContract";
import { Nft } from "../models/Nft";
import { updateUserNftCache } from "./user";

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function getTokensOfOwner(address owner) view returns (uint256[], uint8[])",
  "function tokenURI(uint256 tokenId) view returns (string)",
];

const RARITY_ENUM_MAP: Record<number, RarityTier> = {
  0: "common",
  1: "uncommon",
  2: "rare",
  3: "legendary",
};

function getContract(): ethers.Contract {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL must be set");
  }
  const address = getNftContractAddress();
  return new ethers.Contract(address, ERC721_ABI, new ethers.JsonRpcProvider(rpcUrl));
}

function parseRarityFromMetadata(json: unknown): RarityTier | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const attrs = obj.attributes as Array<{ trait_type?: string; value?: string }> | undefined;
  if (!Array.isArray(attrs)) return null;
  const rarityAttr = attrs.find(
    (a) => a.trait_type?.toLowerCase() === "rarity" && typeof a.value === "string"
  );
  if (!rarityAttr?.value) return null;
  const v = rarityAttr.value.toLowerCase();
  if (v === "common" || v === "uncommon" || v === "rare" || v === "legendary") {
    return v;
  }
  return null;
}

async function fetchMetadataRarity(tokenURI: string): Promise<RarityTier | null> {
  try {
    const url = tokenURI.startsWith("ipfs://")
      ? `https://ipfs.io/ipfs/${tokenURI.slice(7)}`
      : tokenURI;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    return parseRarityFromMetadata(json);
  } catch {
    return null;
  }
}

async function enrichRarityFromMetadata(
  contract: ethers.Contract,
  tokenId: number,
  rarity: RarityTier
): Promise<RarityTier> {
  try {
    const uri = String(await contract.tokenURI(tokenId));
    const metaRarity = await fetchMetadataRarity(uri);
    if (metaRarity) return metaRarity;
  } catch {
    /* keep existing rarity */
  }
  return rarity;
}

async function tryGetTokensOfOwner(
  contract: ethers.Contract,
  wallet: string
): Promise<NftToken[] | null> {
  try {
    const [tokenIds, rarities] = await contract.getTokensOfOwner(wallet);
    const tokens: NftToken[] = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const tokenId = Number(tokenIds[i]);
      const rarityEnum = Number(rarities[i]);
      let rarity = RARITY_ENUM_MAP[rarityEnum] ?? defaultRarityFromTokenId(tokenId);
      rarity = await enrichRarityFromMetadata(contract, tokenId, rarity);
      tokens.push({ tokenId, rarity });
    }
    return tokens;
  } catch {
    return null;
  }
}

async function enumerateByIndex(
  contract: ethers.Contract,
  wallet: string,
  balance: number
): Promise<NftToken[]> {
  const tokens: NftToken[] = [];
  for (let i = 0; i < balance; i++) {
    const tokenId = Number(await contract.tokenOfOwnerByIndex(wallet, i));
    let rarity = defaultRarityFromTokenId(tokenId);
    rarity = await enrichRarityFromMetadata(contract, tokenId, rarity);
    tokens.push({ tokenId, rarity });
  }
  return tokens;
}

async function readChainNfts(walletAddress: string): Promise<NftToken[]> {
  const contract = getContract();
  const wallet = walletAddress.toLowerCase();
  const balance = Number(await contract.balanceOf(wallet));

  if (balance === 0) return [];

  let nfts = await tryGetTokensOfOwner(contract, wallet);
  if (!nfts || nfts.length === 0) {
    nfts = await enumerateByIndex(contract, wallet, balance);
  }

  if (nfts.length === 0) {
    throw new Error(
      `Wallet holds ${balance} NFT(s) but could not enumerate token IDs from contract`
    );
  }

  return nfts;
}

/** Sync on-chain NFTs into DB and update user cache. No fake fallbacks. */
export async function syncUserNfts(
  userId: string,
  walletAddress: string
): Promise<{ nfts: NftToken[]; count: number; multiplier: number }> {
  const contractAddress = getNftContractAddress();
  const chainNfts = await readChainNfts(walletAddress);

  await Nft.deleteMany({ userId });

  if (chainNfts.length > 0) {
    const contract = getContract();
    await Nft.insertMany(
      await Promise.all(
        chainNfts.map(async (n) => {
          let metadataUri = "";
          try {
            metadataUri = String(await contract.tokenURI(n.tokenId));
          } catch {
            /* optional */
          }
          return {
            userId,
            contractAddress,
            tokenId: n.tokenId,
            rarity: n.rarity,
            metadataUri,
            lastSyncedAt: new Date(),
          };
        })
      )
    );
  }

  const multiplier = calculateNftMultiplier(chainNfts);
  await updateUserNftCache(userId, chainNfts.length, multiplier);

  const { syncAllLegendaryForWallet } = await import("./legendaryLand");
  await syncAllLegendaryForWallet(
    userId,
    walletAddress,
    chainNfts.map((n) => n.tokenId)
  );

  return { nfts: chainNfts, count: chainNfts.length, multiplier };
}

export function validateChainConfig(): void {
  if (!process.env.RPC_URL) {
    throw new Error("RPC_URL must be configured");
  }
  getNftContractAddress();
}

export function validateChainId(chainId: number): void {
  const expected = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : null;
  if (expected && chainId !== expected) {
    throw new Error(`Wrong network. Please switch to chain ID ${expected}`);
  }
}
