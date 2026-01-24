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
    // Add cache-busting timestamp to gTrade request
    const timestamp = Date.now();
    const response = await fetch(`https://backend-arbitrum.gains.trade/prices?t=${timestamp}`, {
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
    
    // Log sample data for debugging
    if (Array.isArray(data) && data.length > 0) {
      console.log('gTrade prices fetched:', {
        BTC: data[0],
        ETH: data[1],
        count: data.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // Return the raw array (gTrade format)
    res.status(200).json(data);
  } catch (error) {
    console.error('gTrade proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
