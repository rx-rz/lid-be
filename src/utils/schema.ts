// utils/schema.ts
import { t } from "elysia";

export const NullableString = t.Union([t.String(), t.Null()]);
export const NullableBoolean = t.Union([t.Boolean(), t.Null()]);
export const NullableDate = t.Union([t.String(), t.Date(), t.Null()]);
