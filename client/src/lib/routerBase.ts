export function normalizeRouterBase(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

export function buildBaseHashHref(baseUrl: string, hash: string) {
  const normalizedHash = hash.startsWith("#") ? hash : `#${hash}`;
  return `${normalizeRouterBase(baseUrl)}/${normalizedHash}`;
}
