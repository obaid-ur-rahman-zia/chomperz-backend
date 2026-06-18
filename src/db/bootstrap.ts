import { dropLegacyCollections, seedLands } from "./seed";

export async function bootstrapDatabase(): Promise<void> {
  await dropLegacyCollections();
  await seedLands();
}
