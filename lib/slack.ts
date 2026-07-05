import crypto from 'crypto';

/**
 * Slack (Bree) config + OAuth helpers. Credentials come from env
 * (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_SIGNING_SECRET). The bot the
 * user installs posts as "Bree".
 */
export const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://brandvault-asos.vercel.app';

// Bot-token scopes requested at install (must match the Slack app config).
export const SLACK_SCOPES = ['chat:write', 'chat:write.public', 'channels:read', 'team:read', 'commands'];

export function slackConfig() {
  return {
    clientId: process.env.SLACK_CLIENT_ID ?? '',
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? '',
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? '',
    redirectUri: `${APP_BASE_URL}/api/slack/oauth-callback`,
  };
}

export function slackConfigured(): boolean {
  const c = slackConfig();
  return Boolean(c.clientId && c.clientSecret && c.signingSecret);
}

// The OAuth "state" ties the install back to the company that started it.
// Signed with the signing secret so it can't be tampered with (companyId is a
// cuid — no dots — so '.' is a safe separator).
function stateSecret(): string {
  return process.env.SLACK_SIGNING_SECRET || 'dev-secret';
}
export function signState(companyId: string): string {
  const sig = crypto.createHmac('sha256', stateSecret()).update(companyId).digest('hex').slice(0, 32);
  return `${companyId}.${sig}`;
}
export function verifyState(state: string): string | null {
  const [companyId, sig] = (state ?? '').split('.');
  if (!companyId || !sig || sig.length !== 32) return null;
  const expected = crypto.createHmac('sha256', stateSecret()).update(companyId).digest('hex').slice(0, 32);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? companyId : null;
  } catch {
    return null;
  }
}

export function authorizeUrl(companyId: string): string {
  const c = slackConfig();
  const u = new URL('https://slack.com/oauth/v2/authorize');
  u.searchParams.set('client_id', c.clientId);
  u.searchParams.set('scope', SLACK_SCOPES.join(','));
  u.searchParams.set('redirect_uri', c.redirectUri);
  u.searchParams.set('state', signState(companyId));
  return u.toString();
}

type OAuthAccess = {
  ok: boolean;
  access_token?: string; // bot token
  team?: { id: string; name: string };
  error?: string;
};

export async function exchangeCode(code: string): Promise<OAuthAccess> {
  const c = slackConfig();
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      code,
      redirect_uri: c.redirectUri,
    }),
  });
  return (await res.json()) as OAuthAccess;
}
