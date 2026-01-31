/**
 * Crypto Prices Proxy API
 * Proxies requests to Binance/CoinGecko to handle CORS
 *
 * Usage: /api/crypto-prices
 * Returns: { btc: number, eth: number, timestamp: number }
 */

// Fallback prices (updated periodically)
const FALLBACK_PRICES = {
  btc: 105000,
  eth: 3300,
};

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

  // Price sources in priority order
  const priceSources = [
    {
      name: 'Binance',
      fetchPrices: async () => {
        const [btcRes, ethRes] = await Promise.all([
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
        ]);

        if (!btcRes.ok || !ethRes.ok) throw new Error('Binance API error');

        const btcData = await btcRes.json();
        const ethData = await ethRes.json();

        return {
          btc: parseFloat(btcData.price),
          eth: parseFloat(ethData.price),
        };
      },
    },
    {
      name: 'CoinGecko',
      fetchPrices: async () => {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
        );

        if (!res.ok) throw new Error('CoinGecko API error');

        const data = await res.json();

        return {
          btc: data.bitcoin?.usd || FALLBACK_PRICES.btc,
          eth: data.ethereum?.usd || FALLBACK_PRICES.eth,
        };
      },
    },
    {
      name: 'CryptoCompare',
      fetchPrices: async () => {
        const res = await fetch(
          'https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH&tsyms=USD'
        );

        if (!res.ok) throw new Error('CryptoCompare API error');

        const data = await res.json();

        return {
          btc: data.BTC?.USD || FALLBACK_PRICES.btc,
          eth: data.ETH?.USD || FALLBACK_PRICES.eth,
        };
      },
    },
  ];

  let lastError = null;

  for (const source of priceSources) {
    try {
      console.log(`[crypto-prices] Trying ${source.name}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const prices = await source.fetchPrices();

      clearTimeout(timeoutId);

      if (prices.btc && prices.eth) {
        console.log(`[crypto-prices] Success from ${source.name}: BTC=$${prices.btc}, ETH=$${prices.eth}`);

        return res.status(200).json({
          success: true,
          prices: {
            btc: prices.btc,
            eth: prices.eth,
            BTC: prices.btc,
            ETH: prices.eth,
            bitcoin: prices.btc,
            ethereum: prices.eth,
          },
          source: source.name,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(`[crypto-prices] ${source.name} failed:`, error.message);
      lastError = error;
    }
  }

  // All sources failed - return fallback
  console.error('[crypto-prices] All sources failed, returning fallback');

  return res.status(200).json({
    success: true,
    prices: {
      btc: FALLBACK_PRICES.btc,
      eth: FALLBACK_PRICES.eth,
      BTC: FALLBACK_PRICES.btc,
      ETH: FALLBACK_PRICES.eth,
      bitcoin: FALLBACK_PRICES.btc,
      ethereum: FALLBACK_PRICES.eth,
    },
    source: 'fallback',
    warning: 'Using fallback prices - live data unavailable',
    error: lastError?.message,
    timestamp: Date.now(),
  });
}
