export const encodeCursor = <T = any>(cursor: T): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64");

export const decodeCursor = <T = any>(cursor?: string | null): T | null => {
  if (!cursor) return null;

  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
};

export type Cursor = {
  createdAt: string;
  id: string;
};