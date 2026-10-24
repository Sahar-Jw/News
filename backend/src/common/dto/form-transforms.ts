/** multipart forms send arrays as a JSON string; JSON bodies send a real array. */
export function parseStringList({ value }: { value: unknown }): string[] | undefined {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const v = JSON.parse(value);
      return Array.isArray(v) ? v.map(String) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
