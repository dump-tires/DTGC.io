// api/gtrade-prices.js
// Vercel serverless function to proxy gTrade prices (bypasses CORS)

export default async function handler(req, res) {
  // Set CORS headers and prevent caching
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Use the correct gTrade pricing endpoint (same as widget uses)
    const timestamp = Date.now();
    const response = await fetch(`https://backend-pricing.eu.gains.trade/charts/prices?from=gTrade&pairs=0,1,90,91&t=${timestamp}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DTGC-MetalPerps/1.0',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`gTrade API returned ${response.status}`);
    }

    const data = await response.json();

    // Log for debugging - data format: {0: price, 1: price, 90: price, 91: price}
    console.log('gTrade prices fetched:', {
      BTC: data['0'],
      ETH: data['1'],
      GOLD: data['90'],
      SILVER: data['91'],
      timestamp: new Date().toISOString()
    });

    // Convert object to array format that widget expects
    // Widget uses data[0], data[1], data[90], data[91]
    const pricesArray = [];
    pricesArray[0] = data['0'];   // BTC
    pricesArray[1] = data['1'];   // ETH
    pricesArray[90] = data['90']; // GOLD
    pricesArray[91] = data['91']; // SILVER

    // Return as array
    res.status(200).json(pricesArray);
  } catch (error) {
    console.error('gTrade proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
