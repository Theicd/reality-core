// Cloudflare Worker - CORS Proxy for Reality Core
// Deploy: https://workers.cloudflare.com → Create Worker → Paste this → Deploy
// Then set PROXY_URL in israel.js to your worker URL

const ALLOWED = ['tzevaadom.co.il', 'oref.org.il', 'celestrak.org', 'ndbc.noaa.gov'];

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' } });
    }
    const url = new URL(request.url).searchParams.get('url');
    if (!url) return new Response('Missing ?url=', { status: 400 });
    try {
      const host = new URL(url).hostname;
      if (!ALLOWED.some(d => host.endsWith(d))) return new Response('Blocked', { status: 403 });
    } catch { return new Response('Bad URL', { status: 400 }); }
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const body = await resp.text();
      return new Response(body, { status: resp.status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': resp.headers.get('content-type') || 'text/plain', 'Cache-Control': 'no-cache' } });
    } catch (e) { return new Response(e.message, { status: 502 }); }
  }
};
