import { StreamClient } from "@stream-io/node-sdk";

const apiKey = process.env.STREAM_API_KEY;
const secret = process.env.STREAM_API_SECRET;

if (!apiKey || !secret) {
  throw new Error("Stream configuration missing");
}

const client = new StreamClient(apiKey, secret);

export const streamService = {
  getApiKey: () => apiKey,

  generateToken: async (data: {
    userId: string;
    name?: string;
    image?: string;
    email?: string;
  }) => {
    const { userId, name, image, email } = data;

    await client.upsertUsers([
      {
        id: userId,
        role: "user",
        name: name || userId,
        image: image || "",
        custom: { email: email || "" },
      },
    ]);

    // 10 years validity
    const validityInSeconds = 10 * 365 * 24 * 60 * 60;

    const token = client.generateUserToken({
      user_id: userId,
      validity_in_seconds: validityInSeconds,
    });

    return { token, userId, apiKey };
  },
};
