export const parseJsonArray = (val?: string): number[] => {
  if (!val) throw new Error("Missing value");

  const parsed = JSON.parse(val);
  if (!Array.isArray(parsed)) throw new Error("Invalid array");

  return parsed.map(Number);
};

export const parseMultiSelect = (val?: string): string[] | undefined => {
  if (!val) return undefined;

  try {
    const parsed = JSON.parse(decodeURIComponent(val));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [val];
  }
};

export const parseBoolean = (val?: string): boolean | undefined => {
  if (val === "true") return true;
  if (val === "false") return false;
  return undefined;
};
