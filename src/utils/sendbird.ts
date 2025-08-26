const baseUrl = (): string =>
  `https://api-${process.env.SENDBIRD_APP_ID}.sendbird.com/v3`;

const headers = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "Api-Token": process.env.SENDBIRD_CUSTOMER_API_TOKEN,
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
    return await sbFetch(`/users`, {
      method: "POST",
      body: JSON.stringify({
        user_id: String(userId),
        nickname: nickname || `user_${userId}`,
        profile_url,
        issue_access_token: true,
      }),
    });
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
  const body: { expires_at?: number } = {};
  if (ttlSeconds && Number(ttlSeconds) > 0) {
    body.expires_at = Date.now() + Number(ttlSeconds) * 1000;
  }
  const res = await sbFetch(`/users/${encodeURIComponent(userId)}/token`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res;
}

export { ensureUser, issueSessionToken };
