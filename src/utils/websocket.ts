import Ably from "ably";

if (!process.env.ABLY_API_KEY) {
  console.warn("⚠️ ABLY_API_KEY is missing from environment variables");
}

export const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY || "" });
