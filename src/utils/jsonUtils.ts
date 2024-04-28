export function tryJsonParse<T>(meta: string): T | undefined {
  try {
    return JSON.parse(meta);
  } catch {
    return undefined;
  }
}
