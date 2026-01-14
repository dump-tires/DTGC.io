/**
 * Vercel Serverless Function: Token Info API
 * 
 * Fetches DTGC token info from PulseChain Explorer API
 * including accurate holder count
 * 
 * Deploy to: /api/token-info.js
 */

const DTGC_ADDRESS = '0xd0676b28a457371d58d47e5247b439114e40eb0f';
const PULSECHAIN_API = `https://api.scan.pulsechain.com/api/v2/tokens/${DTGC_ADDRESS}`;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('📊 Fetching DTGC token info from PulseChain...');
    
    const response = await fetch(PULSECHAIN_API, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DTGC-Staking-Platform/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`PulseChain API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Extract relevant token info
    const tokenInfo = {
      success: true,
      name: data.name || 'DT Gold Coin',
      symbol: data.symbol || 'DTGC',
      decimals: data.decimals || 18,
      total_supply: data.total_supply,
      holders_count: data.holders_count || data.holders || null,
      circulating_market_cap: data.circulating_market_cap,
      exchange_rate: data.exchange_rate,
      icon_url: data.icon_url,
      address: data.address,
      // Additional fields if available
      transfers_count: data.transfers_count,
      type: data.type,
    };

    console.log('✅ Token info fetched:', {
      holders_count: tokenInfo.holders_count,
      symbol: tokenInfo.symbol,
    });

    // Cache for 60 seconds
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    
    return res.status(200).json(tokenInfo);

  } catch (error) {
    console.error('❌ Token info API error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      holders_count: null,
    });
  }
}
