/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 DTGC.io Entry Point - SaaS-Enabled
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This wraps the App with the SaaS configuration provider,
 * enabling white-label customization based on domain/subdomain.
 * 
 * Domain-based config loading:
 *   - dtgc.io          → DTGC config (default)
 *   - memecoin.dtgc.io → MemeCoin config
 *   - ?client=demo     → Demo config (URL param)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Import the SaaS-wrapped App (includes ConfigProvider)
import SaaSApp from './SaaSApp';

// For backwards compatibility, you can also import App directly:
// import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <SaaSApp />
  </React.StrictMode>
);

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALTERNATIVE: Direct App without SaaS wrapper (for development)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * If you want to bypass the SaaS config system during development:
 * 
 * import App from './App';
 * import { SaaSConfigProvider } from './SaaSApp';
 * 
 * root.render(
 *   <React.StrictMode>
 *     <SaaSConfigProvider>
 *       <App />
 *     </SaaSConfigProvider>
 *   </React.StrictMode>
 * );
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * CUSTOM CLIENT CONFIG (for testing)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * To test a custom config without deploying:
 * 
 * import { SaaSConfigProvider } from './SaaSApp';
 * import App from './App';
 * 
 * const customConfig = {
 *   branding: {
 *     name: 'TestCoin',
 *     colors: { primary: '#FF0000' }
 *   }
 * };
 * 
 * root.render(
 *   <SaaSConfigProvider overrideConfig={customConfig}>
 *     <App />
 *   </SaaSConfigProvider>
 * );
 */
