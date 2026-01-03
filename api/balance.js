// Vercel Serverless API Route - /api/balance.js
// Gets DTGC balance for a specific wallet address

const DTGC_TOKEN_ADDRESS = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Address parameter required' });
  }

  try {
    const response = await fetch(
      `https://api.scan.pulsechain.com/api/v2/addresses/${address}/token-balances`,
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

    // Find DTGC token balance
    const dtgcBalance = data.find(
      t => t.token?.address?.toLowerCase() === DTGC_TOKEN_ADDRESS.toLowerCase()
    );

    const balance = dtgcBalance ? parseFloat(dtgcBalance.value) / 1e18 : 0;

    // Return with cache (1 minute)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json({
      address,
      balance,
      raw: dtgcBalance?.value || '0',
      allTokens: data,
    });

  } catch (error) {
    console.error('Balance API error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch balance',
      message: error.message 
    });
  }
}
