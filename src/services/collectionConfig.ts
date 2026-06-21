import type { RarityTier } from "../lib/economy";
import { getNftContractAddress } from "../config/nftContract";
import {
  CollectionConfig,
  type ICrownBinding,
  type IRarityOverride,
} from "../models/CollectionConfig";

async function getOrCreateConfig() {
  const contractAddress = getNftContractAddress().toLowerCase();
  let doc = await CollectionConfig.findOne({ contractAddress });
  if (!doc) {
    doc = await CollectionConfig.create({
      contractAddress,
      crownBindings: [],
      rarityOverrides: [],
    });
  }
  return doc;
}

export async function getCollectionConfigPayload() {
  const doc = await getOrCreateConfig();
  return {
    contractAddress: doc.contractAddress,
    crownBindings: doc.crownBindings.map((b) => ({ plotId: b.plotId, tokenId: b.tokenId })),
    rarityOverrides: doc.rarityOverrides.map((r) => ({
      tokenId: r.tokenId,
      rarity: r.rarity,
    })),
  };
}

export async function getPlotForToken(tokenId: number): Promise<number | null> {
  const doc = await getOrCreateConfig();
  const binding = doc.crownBindings.find((b) => b.tokenId === tokenId);
  return binding ? binding.plotId : null;
}

export async function getCrownTokenForPlot(plotId: number): Promise<number | null> {
  if (plotId < 0 || plotId > 9) return null;
  const doc = await getOrCreateConfig();
  const binding = doc.crownBindings.find((b) => b.plotId === plotId);
  return binding ? binding.tokenId : null;
}

export async function getAllCrownBindings(): Promise<ICrownBinding[]> {
  const doc = await getOrCreateConfig();
  return doc.crownBindings.map((b) => ({ plotId: b.plotId, tokenId: b.tokenId }));
}

export async function isConfiguredCrownToken(tokenId: number): Promise<boolean> {
  return (await getPlotForToken(tokenId)) !== null;
}

export async function resolveRarity(tokenId: number, chainRarity: RarityTier): Promise<RarityTier> {
  const doc = await getOrCreateConfig();
  const override = doc.rarityOverrides.find((r) => r.tokenId === tokenId);
  return override?.rarity ?? chainRarity;
}

export async function setCrownBinding(plotId: number, tokenId: number) {
  if (plotId < 0 || plotId > 9) throw new Error("plotId must be 0–9 (plots #01–#10)");
  if (!Number.isInteger(tokenId) || tokenId < 1) throw new Error("tokenId must be a positive integer");

  const doc = await getOrCreateConfig();
  doc.crownBindings = doc.crownBindings.filter(
    (b) => b.plotId !== plotId && b.tokenId !== tokenId
  );
  doc.crownBindings.push({ plotId, tokenId });
  doc.crownBindings.sort((a, b) => a.plotId - b.plotId);
  await doc.save();
  return getCollectionConfigPayload();
}

export async function clearCrownBinding(plotId: number) {
  if (plotId < 0 || plotId > 9) throw new Error("plotId must be 0–9");
  const doc = await getOrCreateConfig();
  doc.crownBindings = doc.crownBindings.filter((b) => b.plotId !== plotId);
  await doc.save();
  return getCollectionConfigPayload();
}

export async function setRarityOverride(tokenId: number, rarity: RarityTier) {
  if (!Number.isInteger(tokenId) || tokenId < 1) throw new Error("tokenId must be a positive integer");

  const doc = await getOrCreateConfig();
  doc.rarityOverrides = doc.rarityOverrides.filter((r) => r.tokenId !== tokenId);
  doc.rarityOverrides.push({ tokenId, rarity });
  doc.rarityOverrides.sort((a, b) => a.tokenId - b.tokenId);
  await doc.save();
  return getCollectionConfigPayload();
}

export async function removeRarityOverride(tokenId: number) {
  const doc = await getOrCreateConfig();
  doc.rarityOverrides = doc.rarityOverrides.filter((r) => r.tokenId !== tokenId);
  await doc.save();
  return getCollectionConfigPayload();
}

export type { ICrownBinding, IRarityOverride };
