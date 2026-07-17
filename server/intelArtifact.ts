import { INTEL_ITEM_SCHEMA_VERSION, type IntelItem } from "./intelItem";

export interface IntelArtifact {
  generatedAt: string;
  items: IntelItem[];
  schemaVersion: typeof INTEL_ITEM_SCHEMA_VERSION;
}

export function buildIntelArtifact(
  items: IntelItem[],
  options: { generatedAt?: string } = {}
): IntelArtifact {
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    items,
    schemaVersion: INTEL_ITEM_SCHEMA_VERSION,
  };
}
