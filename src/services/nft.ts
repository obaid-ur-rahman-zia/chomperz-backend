import { ethers } from "ethers";
import {
  buildNftListFromTokenIds,
  calculateRarityBoost,
  defaultRarityFromTokenId,
  type NftToken,
} from "../lib/economy";

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function getTokensOfOwner(address owner) view returns (uint256[], uint8[])",
];

const RARITY_ENUM_MAP: Record<number, NftToken["rarity"]> = {
  0: "common",
  1: "uncommon",
  2: "rare",
  3: "legendary",
};

function getContract(): ethers.Contract {
  const rpcUrl = process.env.RPC_URL;
  const address = process.env.CONTRACT_ADDRESS;
  if (!rpcUrl || !address) {
    throw new Error("RPC_URL and CONTRACT_ADDRESS must be set");
  }
  return new ethers.Contract(
    address,
    ERC721_ABI,
    new ethers.JsonRpcProvider(rpcUrl)
  );
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
      tokens.push({
        tokenId,
        rarity: RARITY_ENUM_MAP[rarityEnum] ?? defaultRarityFromTokenId(tokenId),
      });
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
    try {
      const tokenId = Number(await contract.tokenOfOwnerByIndex(wallet, i));
      tokens.push({ tokenId, rarity: defaultRarityFromTokenId(tokenId) });
    } catch {
      break;
    }
  }
  return tokens;
}

export async function fetchWalletNfts(walletAddress: string): Promise<{
  nfts: NftToken[];
  count: number;
  raritySum: number;
}> {
  const contract = getContract();
  const wallet = walletAddress.toLowerCase();
  const balance = Number(await contract.balanceOf(wallet));

  if (balance === 0) {
    return { nfts: [], count: 0, raritySum: 0 };
  }

  let nfts = await tryGetTokensOfOwner(contract, wallet);
  if (!nfts || nfts.length === 0) {
    nfts = await enumerateByIndex(contract, wallet, balance);
  }
  if (nfts.length === 0) {
    nfts = buildNftListFromTokenIds(
      Array.from({ length: balance }, (_, i) => i + 1)
    );
  }

  return { nfts, count: nfts.length, raritySum: calculateRarityBoost(nfts) };
}
