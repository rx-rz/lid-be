import Ably from "ably";
import { loggers } from "./logger";

if (!process.env.ABLY_API_KEY) {
  loggers.websocket.warn("ABLY_API_KEY is missing from environment variables");
}

export const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY || "" });
