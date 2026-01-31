/**
 * pump.tires / dump.tires Token Proxy API
 * Proxies requests to bonding curve token APIs to handle CORS
 *
 * Primary: dump.tires (Ponder indexer)
 * Fallback: pump.tires (Richard Heart's pump.fun fork)
 *
 * Usage: /api/pump-tokens?filter=activity&page=1
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

  // Common headers to avoid 403 errors
  const commonHeaders = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://pump.tires',
    'Referer': 'https://pump.tires/',
  };

  // Try multiple API sources with fallbacks
  const apiSources = [
    // Primary: Hetzner Ponder indexer (your dedicated server)
    {
      name: 'hetzner-ponder',
      url: `http://65.109.68.172:42069/tokens?limit=100&offset=${(safePage - 1) * 100}`,
      transform: (data) => data.items || data.tokens || data || [],
    },
    // Fallback 1: dump.tires Ponder indexer
    {
      name: 'dump.tires-ponder',
      url: `https://dump.tires/tokens?limit=100&offset=${(safePage - 1) * 100}`,
      transform: (data) => data.items || data.tokens || data || [],
    },
    // Fallback 2: dump.tires with filter
    {
      name: 'dump.tires',
      url: `https://dump.tires/api/tokens?filter=${safeFilter}&page=${safePage}`,
      transform: (data) => data.tokens || data.data || data || [],
    },
    // Fallback 3: pump.tires official API
    {
      name: 'pump.tires',
      url: `https://pump.tires/api/tokens?filter=${safeFilter}&page=${safePage}`,
      transform: (data) => data.tokens || data.data || data || [],
    },
    // Fallback 4: pump.tires activity endpoint
    {
      name: 'pump.tires-activity',
      url: `https://pump.tires/api/tokens?filter=activity&page=1`,
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
    help: 'APIs may be down. Try visiting pump.tires directly.',
  });
}
