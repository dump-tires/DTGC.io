// api/gtrade-prices.js
// Vercel serverless function to proxy gTrade prices (bypasses CORS)

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');

  try {
    const response = await fetch('https://backend-arbitrum.gains.trade/prices', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DTGC-MetalPerps/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`gTrade API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Return the raw array (gTrade format)
    res.status(200).json(data);
  } catch (error) {
    console.error('gTrade proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
