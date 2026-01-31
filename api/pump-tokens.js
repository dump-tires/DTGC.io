/**
 * pump.tires / dump.tires Token Proxy API
 * Proxies requests to bonding curve token APIs to handle CORS
 *
 * Primary: pump.tires (Richard Heart's official pump.fun fork)
 * Fallback: dump.tires (your API if available)
 *
 * Usage: /api/pump-tokens?filter=activity&page=1
 *
 * pump.tires API returns tokens sorted by filter, we filter for pre-bonded
 * (tokens_sold < 800M = not yet graduated to PulseX)
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filter = 'activity', page = '1' } = req.query;

  // Validate filter - pump.tires supported filters
  const validFilters = ['activity', 'latest_timestamp', 'created_timestamp', 'market_value', 'latest_burn_timestamp', 'launch_timestamp'];
  const safeFilter = validFilters.includes(filter) ? filter : 'activity';
  const safePage = parseInt(page) || 1;

  // Try multiple API sources with fallbacks
  const apiSources = [
    // Primary: pump.tires official API
    {
      name: 'pump.tires',
      url: `https://pump.tires/api/tokens?filter=${safeFilter}&page=${safePage}`,
    },
    // Fallback 1: pump.tires with activity filter (most active tokens)
    {
      name: 'pump.tires-activity',
      url: `https://pump.tires/api/tokens?filter=activity&page=${safePage}`,
    },
    // Fallback 2: dump.tires (user's API)
    {
      name: 'dump.tires',
      url: `https://dump.tires/api/tokens?filter=${safeFilter}&page=${safePage}`,
    },
    // Fallback 3: Try pump.tires root tokens endpoint
    {
      name: 'pump.tires-root',
      url: `https://pump.tires/api/tokens`,
    },
  ];

  let lastError = null;
  let allErrors = [];

  for (const source of apiSources) {
    try {
      console.log(`[pump-tokens] Trying ${source.name}: ${source.url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(source.url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; DTGC.io/1.0)',
          'Referer': 'https://dtgc.io/',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response formats
      let tokens = data.tokens || data.data || data || [];
      if (!Array.isArray(tokens)) {
        console.log(`[pump-tokens] ${source.name} returned non-array:`, typeof tokens);
        throw new Error('Invalid response format - expected array');
      }

      if (tokens.length === 0) {
        console.log(`[pump-tokens] ${source.name} returned empty array`);
        throw new Error('Empty token list');
      }

      console.log(`[pump-tokens] ${source.name} returned ${tokens.length} tokens`);

      // Filter for pre-bonded tokens only (not yet launched/graduated)
      // pump.tires uses 800M tokens sold = graduation (bonding curve complete)
      const preBondedTokens = tokens.filter(t => {
        // is_launched = true means already graduated to PulseX
        if (t.is_launched === true) return false;
        // tokens_sold >= 800M means graduated
        if (t.tokens_sold && t.tokens_sold >= 800000000) return false;
        return true;
      });

      console.log(`[pump-tokens] Filtered to ${preBondedTokens.length} pre-bonded tokens`);

      // Sort by closest to graduation (highest tokens_sold first)
      preBondedTokens.sort((a, b) => {
        const soldA = a.tokens_sold || 0;
        const soldB = b.tokens_sold || 0;
        return soldB - soldA; // Higher sold = closer to graduation
      });

      // Return top 20 tokens closest to graduation
      const topTokens = preBondedTokens.slice(0, 20);

      console.log(`[pump-tokens] Success from ${source.name}: returning ${topTokens.length} tokens`);

      return res.status(200).json({
        success: true,
        tokens: topTokens,
        total: preBondedTokens.length,
        page: safePage,
        filter: safeFilter,
        source: source.name,
        timestamp: Date.now(),
      });
    } catch (error) {
      const errorMsg = `${source.name}: ${error.message}`;
      console.error(`[pump-tokens] ${errorMsg}`);
      allErrors.push(errorMsg);
      lastError = error;
      // Continue to next source
    }
  }

  // All sources failed - return error with debug info
  console.error('[pump-tokens] All sources failed:', allErrors.join('; '));

  return res.status(503).json({
    success: false,
    tokens: [],
    total: 0,
    page: safePage,
    filter: safeFilter,
    source: 'none',
    error: 'All API sources unavailable',
    errors: allErrors,
    timestamp: Date.now(),
    help: 'pump.tires API may be down. Try again in a few minutes.',
  });
}
