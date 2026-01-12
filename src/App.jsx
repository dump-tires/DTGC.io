import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WhiteDiamondStaking from './components/WhiteDiamondStaking';
// Import your other tier components here

const CONTRACT_ADDRESSES = {
  // DTGC Token
  dtgcToken: '0xD0676B28a457371D58d47E5247b439114e40Eb0F',
  
  // V4 Staking Contracts
  bronzeStaking: '0xYOUR_BRONZE_ADDRESS', // Replace with actual address
  silverStaking: '0xYOUR_SILVER_ADDRESS', // Replace with actual address
  diamondPlusStaking: '0xYOUR_DIAMOND_PLUS_ADDRESS', // Replace with actual address
  flexStaking: '0xYOUR_FLEX_ADDRESS', // Replace with actual address
  
  // White Diamond NFT (NEW - Correct LP)
  whiteDiamondNFT: '0x326F86e7d594B55B7BA08DFE5195b10b159033fD',
  
  // LP Tokens
  dtgcPlsLP: '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7', // DTGC/PLS LP
  dtgcUrmomLP: '0x670c972Bb5388E087a2934a063064d97278e01F3', // DTGC/URMOM LP (White Diamond)
  
  // DAO & Treasury
  daoVoting: '0xYOUR_DAO_ADDRESS', // Replace with actual address
  devWallet: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
};

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [activeTier, setActiveTier] = useState('white-diamond');

  useEffect(() => {
    checkWalletConnection();
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          await connectWallet();
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const network = await web3Provider.getNetwork();
      
      setProvider(web3Provider);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));

      // Check if on PulseChain (369)
      if (Number(network.chainId) !== 369) {
        alert('Please switch to PulseChain network (Chain ID: 369)');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet: ' + error.message);
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount(null);
      setProvider(null);
    } else {
      setAccount(accounts[0]);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const switchToPulseChain = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x171' }], // 369 in hex
      });
    } catch (switchError) {
      // Chain hasn't been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x171',
              chainName: 'PulseChain',
              nativeCurrency: {
                name: 'Pulse',
                symbol: 'PLS',
                decimals: 18
              },
              rpcUrls: ['https://rpc.pulsechain.com'],
              blockExplorerUrls: ['https://scan.pulsechain.com']
            }]
          });
        } catch (addError) {
          console.error('Error adding PulseChain:', addError);
        }
      }
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="app-container">
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          background: #0a0a0f;
          color: #fff;
          font-family: 'Segoe UI', Arial, sans-serif;
        }

        .app-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
        }

        .navbar {
          background: rgba(26, 26, 46, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 2px solid #FFD700;
          padding: 20px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .logo-icon {
          font-size: 36px;
        }

        .logo-text {
          font-size: 28px;
          font-weight: bold;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .wallet-button {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wallet-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(255, 215, 0, 0.3);
        }

        .wallet-connected {
          background: rgba(76, 175, 80, 0.2);
          color: #4CAF50;
          border: 2px solid #4CAF50;
        }

        .network-warning {
          background: rgba(244, 67, 54, 0.2);
          border: 2px solid #f44336;
          color: #f44336;
          padding: 15px 30px;
          text-align: center;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .switch-network-button {
          background: #f44336;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          margin-left: 15px;
        }

        .tier-tabs {
          background: rgba(26, 26, 46, 0.6);
          padding: 20px;
          display: flex;
          gap: 10px;
          overflow-x: auto;
          border-bottom: 1px solid #333;
        }

        .tier-tab {
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid #444;
          color: #888;
          padding: 12px 24px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: bold;
          white-space: nowrap;
          transition: all 0.3s;
        }

        .tier-tab:hover {
          border-color: #FFD700;
          color: #FFD700;
        }

        .tier-tab.active {
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2));
          border-color: #FFD700;
          color: #FFD700;
        }

        .main-content {
          padding: 40px 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .hero-section {
          text-align: center;
          padding: 60px 20px;
          margin-bottom: 40px;
        }

        .hero-title {
          font-size: 56px;
          font-weight: bold;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 20px;
        }

        .hero-subtitle {
          font-size: 24px;
          color: #888;
          margin-bottom: 30px;
        }

        .hero-tagline {
          font-size: 18px;
          color: #ccc;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .navbar {
            padding: 15px 20px;
            flex-direction: column;
            gap: 15px;
          }

          .tier-tabs {
            padding: 10px;
          }

          .hero-title {
            font-size: 36px;
          }

          .hero-subtitle {
            font-size: 18px;
          }
        }
      `}</style>

      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">
          <span className="logo-icon">⚔️</span>
          <span className="logo-text">DTGC.io</span>
        </div>
        <button
          className={`wallet-button ${account ? 'wallet-connected' : ''}`}
          onClick={account ? null : connectWallet}
        >
          {account ? (
            <>
              <span>🟢</span>
              <span>{formatAddress(account)}</span>
            </>
          ) : (
            <>
              <span>🔌</span>
              <span>Connect Wallet</span>
            </>
          )}
        </button>
      </nav>

      {/* Network Warning */}
      {account && chainId !== 369 && (
        <div className="network-warning">
          <span>⚠️</span>
          <span>Wrong Network! Please switch to PulseChain</span>
          <button className="switch-network-button" onClick={switchToPulseChain}>
            Switch Network
          </button>
        </div>
      )}

      {/* Tier Tabs */}
      <div className="tier-tabs">
        <div
          className={`tier-tab ${activeTier === 'bronze' ? 'active' : ''}`}
          onClick={() => setActiveTier('bronze')}
        >
          🥉 Bronze (30d)
        </div>
        <div
          className={`tier-tab ${activeTier === 'silver' ? 'active' : ''}`}
          onClick={() => setActiveTier('silver')}
        >
          🥈 Silver (90d)
        </div>
        <div
          className={`tier-tab ${activeTier === 'white-diamond' ? 'active' : ''}`}
          onClick={() => setActiveTier('white-diamond')}
        >
          💎 White Diamond (90d NFT)
        </div>
        <div
          className={`tier-tab ${activeTier === 'diamond-plus' ? 'active' : ''}`}
          onClick={() => setActiveTier('diamond-plus')}
        >
          💎+ Diamond+ (180d)
        </div>
        <div
          className={`tier-tab ${activeTier === 'flex' ? 'active' : ''}`}
          onClick={() => setActiveTier('flex')}
        >
          ⚡ FLEX (No Lock)
        </div>
      </div>

      {/* Main Content */}
      <main className="main-content">
        {!account && (
          <div className="hero-section">
            <h1 className="hero-title">The Shopify of DeFi Staking</h1>
            <p className="hero-subtitle">
              Multi-tier staking ecosystem on PulseChain
            </p>
            <p className="hero-tagline">
              "The power of the Empire, now in your portfolio"
            </p>
          </div>
        )}

        {/* Render Active Tier Component */}
        {account && chainId === 369 && (
          <>
            {activeTier === 'white-diamond' && (
              <WhiteDiamondStaking provider={provider} account={account} />
            )}
            {/* Add other tier components here */}
            {activeTier === 'bronze' && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                <h2>🥉 Bronze Tier</h2>
                <p>Coming soon...</p>
              </div>
            )}
            {activeTier === 'silver' && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                <h2>🥈 Silver Tier</h2>
                <p>Coming soon...</p>
              </div>
            )}
            {activeTier === 'diamond-plus' && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                <h2>💎+ Diamond+ Tier</h2>
                <p>Coming soon...</p>
              </div>
            )}
            {activeTier === 'flex' && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                <h2>⚡ FLEX Tier</h2>
                <p>Coming soon...</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
