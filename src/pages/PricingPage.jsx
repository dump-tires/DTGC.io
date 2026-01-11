/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💰 PRICING PAGE - DTGC SaaS Landing & Pricing (Tab Version)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Marketing page for the white-label staking platform.
 * "The Shopify of DeFi Staking"
 * 
 * This version is designed to be embedded as a tab within App.jsx
 */

import React, { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// PRICING DATA
// ═══════════════════════════════════════════════════════════════════════════

const PLANS = [
  {
    name: 'Starter',
    price: '$499',
    priceNote: 'one-time',
    description: 'Perfect for new tokens',
    color: '#C0C0C0',
    features: [
      '3 Staking Tiers',
      'Single-Token Staking',
      'Basic Branding',
      'Standard Support',
      'Self-Hosted',
    ],
    notIncluded: [
      'LP Staking',
      'DAO Voting',
      'Growth Engine',
      'Custom Domain',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Professional',
    price: '$1,499',
    priceNote: 'one-time',
    description: 'Most popular choice',
    color: '#FFD700',
    popular: true,
    features: [
      '5 Staking Tiers',
      'Single-Token Staking',
      'LP Staking',
      'Full Branding Suite',
      'Priority Support',
      'Managed Hosting',
      'Custom Domain',
      'Analytics Dashboard',
    ],
    notIncluded: [
      'DAO Voting',
      'Growth Engine',
    ],
    cta: 'Most Popular',
  },
  {
    name: 'Enterprise',
    price: '$4,999',
    priceNote: 'one-time',
    description: 'Full platform access',
    color: '#9C27B0',
    features: [
      'Unlimited Tiers',
      'Single-Token Staking',
      'LP Staking',
      'Flex Staking',
      'DAO Voting System',
      'Growth Engine',
      'Full Branding Suite',
      'Dedicated Support',
      'Managed Hosting',
      'Custom Domain',
      'White-Label Removal',
      'Source Code Access',
      'Custom Integrations',
    ],
    notIncluded: [],
    cta: 'Contact Us',
  },
];

const FEATURES = [
  {
    icon: '⚡',
    title: 'One-Click Deploy',
    description: 'Launch your staking platform in minutes, not months.',
  },
  {
    icon: '🎨',
    title: 'Full Customization',
    description: 'Your branding, your colors, your domain. Completely white-label.',
  },
  {
    icon: '🔒',
    title: 'Battle-Tested Contracts',
    description: 'Smart contracts audited and proven on PulseChain.',
  },
  {
    icon: '📊',
    title: 'Built-in Analytics',
    description: 'Track TVL, stakers, and rewards in real-time.',
  },
  {
    icon: '🗳️',
    title: 'DAO Governance',
    description: 'Let your community vote on proposals.',
  },
  {
    icon: '🚀',
    title: 'Growth Engine',
    description: 'Automated buybacks and LP building.',
  },
];

const TESTIMONIALS = [
  {
    quote: "Launched our staking platform in 2 days instead of 2 months.",
    author: "MemeToken Team",
    role: "PulseChain Project",
  },
  {
    quote: "The tiered staking increased our holder retention by 300%.",
    author: "DeFi Protocol",
    role: "Yield Platform",
  },
  {
    quote: "Finally a professional staking solution that just works.",
    author: "Anonymous Dev",
    role: "Token Founder",
  },
];

const FAQ = [
  {
    q: "What blockchain does this support?",
    a: "Currently optimized for PulseChain, with Ethereum and BSC coming soon.",
  },
  {
    q: "Do I need technical knowledge?",
    a: "Basic understanding of crypto wallets is helpful, but our admin dashboard makes everything point-and-click.",
  },
  {
    q: "Can I customize the smart contracts?",
    a: "Enterprise plan includes source code access for custom modifications.",
  },
  {
    q: "What about ongoing costs?",
    a: "One-time payment covers deployment. Optional $99/mo for managed hosting and updates.",
  },
  {
    q: "How long until my platform is live?",
    a: "Starter plans deploy instantly. Professional takes 24-48 hours for custom branding.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PricingPage() {
  const [expandedFaq, setExpandedFaq] = useState(null);
  
  return (
    <section className="section" style={{ padding: '20px 0' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <div style={{ 
          display: 'inline-block',
          padding: '8px 20px',
          background: 'linear-gradient(135deg, rgba(76,175,80,0.2), rgba(76,175,80,0.05))',
          border: '1px solid rgba(76,175,80,0.4)',
          borderRadius: '30px',
          fontSize: '0.8rem',
          color: '#4CAF50',
          fontWeight: 600,
          marginBottom: '20px',
        }}>
          🏭 SAAS PLATFORM
        </div>
        
        <h1 style={{ 
          fontSize: 'clamp(2rem, 5vw, 3rem)', 
          fontWeight: 800, 
          marginBottom: '16px',
          background: 'linear-gradient(135deg, #4CAF50 0%, #81C784 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontFamily: 'Cinzel, serif',
        }}>
          The Shopify of DeFi Staking
        </h1>
        
        <p style={{ color: '#888', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 30px', lineHeight: 1.6 }}>
          Launch your own branded staking platform in minutes, not months.
          No coding required. Battle-tested smart contracts included.
        </p>
        
        {/* Trust badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', marginTop: '30px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#FFD700' }}>50+</div>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Platforms Launched</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#FFD700' }}>$10M+</div>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Total Value Locked</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#FFD700' }}>100%</div>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Uptime</div>
          </div>
        </div>
      </div>
      
      {/* Features Grid */}
      <div style={{ marginBottom: '60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: '30px', color: '#fff' }}>
          Everything You Need
        </h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '20px' 
        }}>
          {FEATURES.map((feature, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '16px',
              padding: '24px',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{feature.icon}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#fff' }}>{feature.title}</div>
              <div style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5 }}>{feature.description}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Pricing Cards */}
      <div style={{ marginBottom: '60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: '10px', color: '#fff' }}>
          Simple Pricing
        </h2>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: '40px' }}>
          One-time payment. No hidden fees. Your platform forever.
        </p>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '24px',
          alignItems: 'start',
        }}>
          {PLANS.map((plan, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `2px solid ${plan.popular ? plan.color : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '24px',
                padding: '32px',
                position: 'relative',
                transform: plan.popular ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.3s ease',
              }}
            >
              {plan.popular && (
                <div style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  color: '#000',
                  padding: '6px 20px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  MOST POPULAR
                </div>
              )}
              
              <div style={{ color: plan.color, fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>
                {plan.name}
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                {plan.price}
              </div>
              <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '16px' }}>
                {plan.priceNote}
              </div>
              <div style={{ color: '#aaa', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {plan.description}
              </div>
              
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
                {plan.features.map((feature, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', fontSize: '0.9rem' }}>
                    <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</span>
                    <span style={{ color: '#ddd' }}>{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature, j) => (
                  <li key={`not-${j}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', fontSize: '0.9rem', color: '#666' }}>
                    <span>✕</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: plan.popular
                    ? `linear-gradient(135deg, ${plan.color} 0%, #FFA500 100%)`
                    : 'rgba(255,255,255,0.1)',
                  color: plan.popular ? '#000' : '#fff',
                  border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.2)',
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
        
        {/* Add-ons */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '20px', color: '#fff' }}>Optional Add-ons</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: '#FFD700' }}>Managed Hosting</strong> — $99/mo
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: '#FFD700' }}>Priority Support</strong> — $199/mo
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <strong style={{ color: '#FFD700' }}>Custom Development</strong> — Contact Us
            </div>
          </div>
        </div>
      </div>
      
      {/* Testimonials */}
      <div style={{ 
        marginBottom: '60px',
        padding: '40px 20px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '20px',
      }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: '30px', color: '#fff' }}>
          Trusted by Projects
        </h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '20px' 
        }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={{
              background: 'rgba(255,215,0,0.05)',
              border: '1px solid rgba(255,215,0,0.1)',
              borderRadius: '16px',
              padding: '24px',
            }}>
              <div style={{ fontSize: '1rem', fontStyle: 'italic', marginBottom: '16px', lineHeight: 1.6, color: '#ddd' }}>
                "{t.quote}"
              </div>
              <div style={{ fontWeight: 600, color: '#FFD700' }}>{t.author}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>{t.role}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* FAQ */}
      <div style={{ marginBottom: '60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: '30px', color: '#fff' }}>
          Frequently Asked Questions
        </h2>
        
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {FAQ.map((item, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
              marginBottom: '10px',
              overflow: 'hidden',
            }}>
              <div
                style={{
                  padding: '18px 24px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 600,
                  color: '#fff',
                }}
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              >
                {item.q}
                <span style={{ color: '#FFD700' }}>{expandedFaq === i ? '−' : '+'}</span>
              </div>
              {expandedFaq === i && (
                <div style={{ padding: '0 24px 18px', color: '#888', lineHeight: 1.6 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* CTA */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,165,0,0.05) 100%)',
        borderRadius: '24px',
        padding: '50px 30px',
        textAlign: 'center',
        border: '1px solid rgba(255,215,0,0.2)',
      }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '16px', color: '#fff' }}>
          Ready to Launch Your Staking Platform?
        </h2>
        <p style={{ color: '#888', marginBottom: '30px' }}>
          Join 50+ projects already using our infrastructure
        </p>
        <button style={{
          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
          color: '#000',
          border: 'none',
          borderRadius: '12px',
          padding: '16px 40px',
          fontSize: '1.1rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          Get Started Now →
        </button>
        
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
          <a href="https://t.me/dtgoldcoin" target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'none' }}>
            💬 Telegram
          </a>
          <a href="https://twitter.com/DTGoldCoin" target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'none' }}>
            🐦 Twitter
          </a>
          <a href="mailto:saas@dtgc.io" style={{ color: '#888', textDecoration: 'none' }}>
            ✉️ saas@dtgc.io
          </a>
        </div>
      </div>
    </section>
  );
}
