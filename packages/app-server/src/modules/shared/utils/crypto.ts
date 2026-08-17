export { generateToken, sha256Hex };

// URL-safe random capability token (256 bits, base64url without padding) so it
// can travel in a URL hash fragment.
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Web Crypto is used (instead of node:crypto) so this works on both the Node
// and the Cloudflare Workers runtime.
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));

  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
