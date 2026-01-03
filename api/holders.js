// Vercel Serverless API Route - /api/holders.js
// Proxies PulseChain holder data to avoid CORS issues

const DTGC_TOKEN_ADDRESS = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch(
      `https://api.scan.pulsechain.com/api/v2/tokens/${DTGC_TOKEN_ADDRESS}/holders?limit=50`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DTGC-Staking-Platform/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`PulseChain API returned ${response.status}`);
    }

    const data = await response.json();

    // Return the data with cache headers (cache for 2 minutes)
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.status(200).json(data);

  } catch (error) {
    console.error('Holders API error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch holder data',
      message: error.message 
    });
  }
}
