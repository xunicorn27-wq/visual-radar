export function normalizeRouterBase(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}
