// Vercel Serverless Proxy - GET orders by wallet address
const HETZNER_API = 'http://65.109.68.172:3847';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { walletAddress } = req.query;
  const targetUrl = `${HETZNER_API}/api/instabond/${walletAddress}`;

  console.log(`[InstaBond Proxy] GET ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `Hetzner API error: ${response.status}`,
        debug: { targetUrl, walletAddress },
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('[InstaBond Proxy] Error:', error.message);
    return res.status(503).json({
      success: false,
      error: 'InstaBond service unavailable',
      details: error.message,
    });
  }
}
