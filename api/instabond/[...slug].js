// Vercel Serverless Proxy to Hetzner InstaBond API - Catch-all routes
// Handles: GET /api/instabond/:walletAddress, DELETE /api/instabond/:orderId

const HETZNER_API = 'http://65.109.68.172:3847';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { slug } = req.query;
  const path = slug ? `/${slug.join('/')}` : '';
  const targetUrl = `${HETZNER_API}/instabond${path}`;

  console.log(`[InstaBond Proxy] ${req.method} ${targetUrl}`);

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Forward body for POST/PUT
    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Check if Hetzner is responding
    if (!response.ok) {
      console.log(`[InstaBond Proxy] Hetzner returned ${response.status}`);
      return res.status(response.status).json({
        success: false,
        error: `Hetzner API error: ${response.status}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('[InstaBond Proxy] Error:', error.message);
    return res.status(503).json({
      success: false,
      error: 'InstaBond service temporarily unavailable. Please ensure dtrader is running on Hetzner.',
      details: error.message,
    });
  }
}
