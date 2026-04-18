// Share-link codec.
//
// The share payload captures *only* the logical universe content — which
// owners and which of their repos are present — so the receiving app can
// rebuild the list by re-querying GitHub for canonical metadata. We never
// embed stars/forks/pushedAt/etc. in the URL: those would lie about the
// freshness of the data and balloon the payload.
//
// Wire format (pre-Base64):
//   owner1:repoA,repoB;owner2:repoC
//
// • Owners separated by `;`.
// • Within each block the owner login comes first, then `:`, then the
//   short repo names separated by `,`.
// • Owners contributing zero repos are skipped.
// • Owner logins and repo names both use charsets disjoint from `,;:`, so
//   this grammar round-trips without escaping.
//
// Transport:
//   1. UTF-8 encode the compact string.
//   2. Base64 it with the RFC 4648 §5 URL-safe alphabet and strip `=`
//      padding (`+`→`-`, `/`→`_`).
//   3. Attach as the URL hash fragment `#s=<token>` so the payload is
//      never sent to a server and doesn't collide with query strings.
//
// Decode on load (see App.tsx):
//   • Read `location.hash`, extract `s=<token>`.
//   • Base64 → compact string → parsed owners.
//   • If valid, hand off to the store as `pendingShare`.
//
// Error handling:
//   • Any decode/parse failure yields `null`; the caller treats this as
//     "ignore the fragment" rather than propagating an error.
//   • Repos/owners that fail the strict charset check invalidate the
//     whole token — we don't try to salvage partial garbage because the
//     payload source is untrusted.

export interface ShareOwner {
  owner: string;
  repos: string[];
}

export interface ParsedShare {
  owners: ShareOwner[];
}

// GitHub login + repo-name constraints, mirrored from parseRepoInput.ts.
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export const SHARE_HASH_KEY = "s";

export function serializeCompact(owners: ShareOwner[]): string {
  return owners
    .filter((o) => o.repos.length > 0)
    .map((o) => `${o.owner}:${o.repos.join(",")}`)
    .join(";");
}

export function parseCompact(str: string): ParsedShare | null {
  if (typeof str !== "string") return null;
  if (str.length === 0) return { owners: [] };
  const owners: ShareOwner[] = [];
  const seen = new Set<string>();
  for (const block of str.split(";")) {
    if (!block) continue;
    const colon = block.indexOf(":");
    if (colon <= 0) return null;
    const owner = block.slice(0, colon);
    const tail = block.slice(colon + 1);
    if (!OWNER_RE.test(owner)) return null;
    const key = owner.toLowerCase();
    if (seen.has(key)) continue;
    const repos: string[] = [];
    const repoSeen = new Set<string>();
    for (const r of tail.split(",")) {
      if (!r) continue;
      if (!REPO_RE.test(r)) return null;
      const repoKey = r.toLowerCase();
      if (repoSeen.has(repoKey)) continue;
      repoSeen.add(repoKey);
      repos.push(r);
    }
    if (repos.length === 0) continue;
    owners.push({ owner, repos });
    seen.add(key);
  }
  return { owners };
}

export function toUrlSafeBase64(str: string): string {
  if (typeof window === "undefined" || typeof window.btoa !== "function") {
    return "";
  }
  const bytes = new TextEncoder().encode(str);
  // btoa works on binary strings — copy bytes one character at a time.
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function fromUrlSafeBase64(token: string): string | null {
  if (typeof window === "undefined" || typeof window.atob !== "function") {
    return null;
  }
  if (typeof token !== "string" || token.length === 0) return null;
  // Reject anything outside the URL-safe alphabet so bad payloads fail fast
  // and never reach atob's more permissive error surface.
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const pad = (4 - (token.length % 4)) % 4;
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
    const binary = window.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

export function encodeShare(owners: ShareOwner[]): string {
  return toUrlSafeBase64(serializeCompact(owners));
}

export function decodeShare(token: string): ParsedShare | null {
  const compact = fromUrlSafeBase64(token);
  if (compact === null) return null;
  return parseCompact(compact);
}

// Given the app's current href and a set of owners, produce a shareable URL
// with the payload in the hash fragment. The original query string and path
// are preserved verbatim.
export function buildShareUrl(baseHref: string, owners: ShareOwner[]): string {
  const url = new URL(baseHref);
  url.hash = `${SHARE_HASH_KEY}=${encodeShare(owners)}`;
  return url.toString();
}

// Extract the share token from a hash string like `#s=abc` or `#foo&s=abc`.
// Treats the hash as a mini query string so other hash params are tolerated.
export function readShareTokenFromHash(hash: string): string | null {
  if (typeof hash !== "string" || hash.length === 0) return null;
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) return null;
  const prefix = `${SHARE_HASH_KEY}=`;
  for (const seg of trimmed.split("&")) {
    if (seg.startsWith(prefix)) {
      const token = seg.slice(prefix.length);
      return token.length > 0 ? token : null;
    }
  }
  return null;
}
