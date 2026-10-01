/**
 * ICE servers for online play. Browsers on different networks often can't
 * reach each other directly (carrier-grade NAT, mobile data), so they need a
 * TURN relay. Cloudflare's relay is free up to 1,000 GB a month; its key stays
 * here on the server and each visitor gets short-lived credentials.
 *
 * Without the key configured, only public STUN servers are returned, which is
 * enough when the two players' networks allow a direct link.
 */

const STUN_ONLY = { iceServers: [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }] };

/** Credentials last long enough for a long session of matches. */
const TTL_SECONDS = 4 * 60 * 60;

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export async function GET() {
  const keyId = process.env.CF_TURN_KEY_ID;
  const token = process.env.CF_TURN_API_TOKEN;
  if (!keyId || !token) return Response.json(STUN_ONLY, { headers: { "cache-control": "no-store" } });

  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`cloudflare ${res.status}`);
    const data = (await res.json()) as { iceServers: IceServer[] };
    // Browsers refuse port 53, which Cloudflare also offers; leave those out.
    const iceServers = data.iceServers.map((s) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
    }));
    return Response.json({ iceServers }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("[ice]", err);
    return Response.json(STUN_ONLY, { headers: { "cache-control": "no-store" } });
  }
}
