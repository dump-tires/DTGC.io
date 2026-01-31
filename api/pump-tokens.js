/**
 * dump.tires / pump.tires Token Proxy API
 * Proxies requests to bonding curve token APIs to handle CORS
 *
 * Primary: dump.tires (your own API)
 * Fallback: pump.tires
 *
 * Usage: /api/pump-tokens?filter=activity&page=1
 */

// Sample pre-bonded tokens data for fallback when APIs are down
const FALLBACK_TOKENS = [
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Sample Token 1',
    symbol: 'SAMPLE1',
    tokens_sold: 750000000,
    is_launched: false,
    created_timestamp: Date.now() - 86400000,
    logo: null,
  },
  {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: 'Sample Token 2',
    symbol: 'SAMPLE2',
    tokens_sold: 600000000,
    is_launched: false,
    created_timestamp: Date.now() - 172800000,
    logo: null,
  },
];

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filter = 'activity', page = '1' } = req.query;

  // Validate filter
  const validFilters = ['activity', 'latest_timestamp', 'created_timestamp', 'market_value', 'latest_burn_timestamp', 'launch_timestamp'];
  const safeFilter = validFilters.includes(filter) ? filter : 'activity';
  const safePage = parseInt(page) || 1;

  // Try multiple API sources with fallbacks
  const apiSources = [
    // Primary: dump.tires API (your own)
    {
      name: 'dump.tires',
      url: `https://dump.tires/api/tokens?filter=${safeFilter}&page=${safePage}`,
    },
    // Fallback 1: pump.tires direct API
    {
      name: 'pump.tires',
      url: `https://pump.tires/api/tokens?filter=${safeFilter}&page=${safePage}`,
    },
    // Fallback 2: Try without filter
    {
      name: 'pump.tires-basic',
      url: `https://pump.tires/api/tokens?page=${safePage}`,
    },
  ];

  let lastError = null;

  for (const source of apiSources) {
    try {
      console.log(`[pump-tokens] Trying ${source.name}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(source.url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DTGC.io/PulseXGold/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`${source.name} returned ${response.status}`);
      }

      const data = await response.json();

      // Handle different response formats
      let tokens = data.tokens || data.data || data || [];
      if (!Array.isArray(tokens)) {
        tokens = [];
      }

      // Filter for pre-bonded tokens only (not yet launched)
      const preBondedTokens = tokens.filter(t =>
        t.is_launched === false ||
        (t.tokens_sold && t.tokens_sold < 800000000)
      );

      // Sort by closest to graduation (800M tokens)
      preBondedTokens.sort((a, b) => {
        const progressA = (a.tokens_sold || 0) / 800000000;
        const progressB = (b.tokens_sold || 0) / 800000000;
        return progressB - progressA; // Higher progress first
      });

      console.log(`[pump-tokens] Success from ${source.name}: ${preBondedTokens.length} tokens`);

      return res.status(200).json({
        success: true,
        tokens: preBondedTokens.slice(0, 20), // Top 20
        total: preBondedTokens.length,
        page: safePage,
        filter: safeFilter,
        source: source.name,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`[pump-tokens] ${source.name} failed:`, error.message);
      lastError = error;
      // Continue to next source
    }
  }

  // All sources failed - return fallback data with warning
  console.error('[pump-tokens] All sources failed, returning fallback data');

  return res.status(200).json({
    success: true,
    tokens: FALLBACK_TOKENS,
    total: FALLBACK_TOKENS.length,
    page: safePage,
    filter: safeFilter,
    source: 'fallback',
    warning: 'Live data unavailable, showing sample tokens',
    error: lastError?.message,
    timestamp: Date.now(),
  });
}
