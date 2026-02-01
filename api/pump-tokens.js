/**
 * pump.tires Token Proxy API
 * Proxies requests to bonding curve token APIs to handle CORS
 *
 * Primary: api2.pump.tires (new API endpoint as of Jan 2026)
 * Fallback: dump.tires (Ponder indexer)
 *
 * Usage: /api/pump-tokens?filter=activity
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

  const { filter = 'activity' } = req.query;

  // Validate filter - pump.tires supported filters
  const validFilters = ['activity', 'latest_timestamp', 'created_timestamp', 'market_value', 'latest_burn_timestamp', 'launch_timestamp'];
  const safeFilter = validFilters.includes(filter) ? filter : 'activity';

  // Common headers to avoid 403 errors
  const commonHeaders = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://pump.tires',
    'Referer': 'https://pump.tires/',
  };

  // Try multiple API sources with fallbacks
  // NOTE: pump.tires moved their API to api2.pump.tires subdomain (Jan 2026)
  const apiSources = [
    // Primary: api2.pump.tires (NEW endpoint - discovered Jan 31, 2026)
    {
      name: 'api2.pump.tires',
      url: `https://api2.pump.tires/api/tokens?filter=${safeFilter}&direction=next`,
      transform: (data) => data.tokens || data.data || data || [],
    },
    // Fallback 1: api2.pump.tires launch_timestamp (for tokens close to graduation)
    {
      name: 'api2.pump.tires-launch',
      url: `https://api2.pump.tires/api/tokens?filter=launch_timestamp&direction=next`,
      transform: (data) => data.tokens || data.data || data || [],
    },
    // Fallback 2: dump.tires API (Ponder indexer)
    {
      name: 'dump.tires',
      url: `https://dump.tires/api/tokens?filter=${safeFilter}`,
      transform: (data) => data.tokens || data.data || data || [],
    },
  ];

  let lastError = null;
  let allErrors = [];

  for (const source of apiSources) {
    try {
      console.log(`[pump-tokens] Trying ${source.name}: ${source.url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

      const response = await fetch(source.url, {
        headers: commonHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform response based on source
      let tokens = source.transform(data);

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
        // For Ponder format: check launchedTransactionHash
        if (t.launchedTransactionHash) return false;
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
    filter: safeFilter,
    source: 'none',
    error: 'All API sources unavailable',
    errors: allErrors,
    timestamp: Date.now(),
    help: 'APIs may be down. Try visiting pump.tires directly.',
  });
}
