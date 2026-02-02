// api/gtrade-prices.js
// Vercel serverless function to proxy gTrade prices (bypasses CORS)
// UPDATED: Uses new gTrade charts API endpoint format

export default async function handler(req, res) {
    // Set CORS headers and prevent caching
  res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

  try {
        // gTrade API now uses /charts/{pairIndex}/{fromTimestamp}/{toTimestamp}/{interval}
      // We need to fetch the latest candle for each pair to get current prices
      const now = Math.floor(Date.now() / 1000);
        const oneMinuteAgo = now - 60;

      // Pair indices: 0=BTC, 1=ETH, 90=GOLD, 91=SILVER
      const pairs = [
        { index: 0, name: 'BTC' },
        { index: 1, name: 'ETH' },
        { index: 90, name: 'GOLD' },
        { index: 91, name: 'SILVER' }
            ];

      const fetchPrice = async (pairIndex) => {
              const url = `https://backend-pricing.eu.gains.trade/charts/${pairIndex}/${oneMinuteAgo}/${now}/1`;
              const response = await fetch(url, {
                        headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'DTGC-MetalPerps/1.0',
                                    'Cache-Control': 'no-cache',
                        },
              });

              if (!response.ok) {
                        throw new Error(`gTrade API returned ${response.status} for pair ${pairIndex}`);
              }

              const data = await response.json();
              // Get the most recent candle's close price
              if (data.table && data.table.length > 0) {
                        const latestCandle = data.table[data.table.length - 1];
                        return latestCandle.close;
              }
              throw new Error(`No data returned for pair ${pairIndex}`);
      };

      // Fetch all prices in parallel
      const [btcPrice, ethPrice, goldPrice, silverPrice] = await Promise.all([
              fetchPrice(0),
              fetchPrice(1),
              fetchPrice(90),
              fetchPrice(91)
            ]);

      // Log for debugging
      console.log('gTrade prices fetched:', {
              BTC: btcPrice,
              ETH: ethPrice,
              GOLD: goldPrice,
              SILVER: silverPrice,
              timestamp: new Date().toISOString()
      });

      // Convert to array format that widget expects
      // Widget uses data[0], data[1], data[90], data[91]
      const pricesArray = [];
        pricesArray[0] = btcPrice;    // BTC
      pricesArray[1] = ethPrice;    // ETH
      pricesArray[90] = goldPrice;  // GOLD
      pricesArray[91] = silverPrice; // SILVER

      // Return as array
      res.status(200).json(pricesArray);
  } catch (error) {
        console.error('gTrade proxy error:', error);
        res.status(500).json({ error: error.message });
  }
}
