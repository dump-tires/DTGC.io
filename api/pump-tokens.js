/**
 * pump.tires Token Proxy API
 * Proxies requests to pump.tires API to handle CORS
 *
 * Usage: /api/pump-tokens?filter=activity&page=1
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filter = 'activity', page = '1' } = req.query;

    // Validate filter
    const validFilters = ['activity', 'latest_timestamp', 'created_timestamp', 'market_value', 'latest_burn_timestamp', 'launch_timestamp'];
    const safeFilter = validFilters.includes(filter) ? filter : 'activity';
    const safePage = parseInt(page) || 1;

    // Fetch from pump.tires
    const response = await fetch(
      `https://pump.tires/api/tokens?filter=${safeFilter}&page=${safePage}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DTGC.io/PulseXGold',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`pump.tires API returned ${response.status}`);
    }

    const data = await response.json();

    // Filter for pre-bonded tokens only (is_launched === false)
    const preBondedTokens = (data.tokens || []).filter(t => !t.is_launched);

    // Return with our metadata
    return res.status(200).json({
      success: true,
      tokens: preBondedTokens,
      total: preBondedTokens.length,
      page: safePage,
      filter: safeFilter,
      source: 'pump.tires',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('pump.tires proxy error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      tokens: [],
    });
  }
}
