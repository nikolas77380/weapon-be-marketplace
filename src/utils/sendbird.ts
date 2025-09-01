const baseUrl = (): string =>
  `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3`;

const headers = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "Api-Token": process.env.SENDBIRD_API_TOKEN,
});

interface SbFetchInit extends RequestInit {
  headers?: Record<string, string>;
}

async function sbFetch(path: string, init: SbFetchInit = {}): Promise<any> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sendbird ${res.status}: ${text}`);
  }
  return res.json();
}

interface EnsureUserParams {
  userId: string | number;
  nickname?: string;
  profile_url?: string;
}

async function ensureUser({
  userId,
  nickname,
  profile_url,
}: EnsureUserParams): Promise<any> {
  try {
    const response = await fetch(`${baseUrl()}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Token": process.env.SENDBIRD_API_TOKEN,
      },
      body: JSON.stringify({
        user_id: String(userId),
        nickname: nickname || `user_${userId}`,
        profile_url,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sendbird API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (e: any) {
    if (
      String(e.message).includes("400") ||
      String(e.message).includes("409")
    ) {
      return sbFetch(`/users/${encodeURIComponent(userId)}`, { method: "GET" });
    }
    throw e;
  }
}

interface IssueSessionTokenParams {
  userId: string | number;
  ttlSeconds?: number;
}

async function issueSessionToken({
  userId,
  ttlSeconds,
}: IssueSessionTokenParams): Promise<any> {
  console.log("=== issueSessionToken called ===");
  console.log("userId:", userId);
  console.log("ttlSeconds:", ttlSeconds);
  console.log("baseUrl():", baseUrl());

  const body: { expires_at?: number } = {};
  if (ttlSeconds && Number(ttlSeconds) > 0) {
    body.expires_at = Date.now() + Number(ttlSeconds) * 1000;
  }
  console.log("Request body:", body);

  const url = `${baseUrl()}/users/${encodeURIComponent(`${userId}`)}/token`;
  console.log("Request URL:", url);
  console.log("API Token exists:", !!process.env.SENDBIRD_API_TOKEN);

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "Api-Token": process.env.SENDBIRD_API_TOKEN,
    },
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log("Response status:", res.status);
  console.log("Response ok:", res.ok);

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Sendbird API error response:", errorText);
    throw new Error(`Sendbird API error: ${res.status} - ${errorText}`);
  }

  const responseData = await res.json();
  console.log("Sendbird API response:", responseData);
  return responseData;
}

interface CreateChannelParams {
  sellerId: string | number;
  buyerId: string | number;
  channelName: string;
}

async function createChannel({
  sellerId,
  buyerId,
  channelName,
}: CreateChannelParams): Promise<any> {
  console.log("=== createChannel called ===");
  console.log("sellerId:", sellerId);
  console.log("buyerId:", buyerId);
  console.log("channelName:", channelName);

  // Убеждаемся, что оба пользователя существуют в SendBird
  await ensureUser({ userId: sellerId, nickname: `seller_${sellerId}` });
  await ensureUser({ userId: buyerId, nickname: `buyer_${buyerId}` });

  const channelData = {
    name: channelName,
    user_ids: [String(sellerId), String(buyerId)],
    is_distinct: false,
    is_public: false,
    is_super: false,
    is_ephemeral: false,
    access_code: "",
    data: "",
    custom_type: "",
  };

  console.log("Channel data:", channelData);

  const response = await fetch(`${baseUrl()}/group_channels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Token": process.env.SENDBIRD_API_TOKEN,
    },
    body: JSON.stringify(channelData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sendbird channel creation error:", errorText);
    throw new Error(
      `Sendbird channel creation error: ${response.status} - ${errorText}`
    );
  }

  const channelResponse = await response.json();
  console.log("Channel created successfully:", channelResponse);
  return channelResponse;
}

export { ensureUser, issueSessionToken, createChannel };
