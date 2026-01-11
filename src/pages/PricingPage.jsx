/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💰 PRICING PAGE - DTGC SaaS Landing & Pricing
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Marketing page for the white-label staking platform.
 * "The Shopify of DeFi Staking"
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
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  logo: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#FFD700',
  },
  navLinks: {
    display: 'flex',
    gap: '32px',
    alignItems: 'center',
  },
  navLink: {
    color: '#888',
    textDecoration: 'none',
    transition: 'color 0.2s',
    cursor: 'pointer',
  },
  hero: {
    textAlign: 'center',
    padding: '80px 20px 120px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  heroTitle: {
    fontSize: '3.5rem',
    fontWeight: 800,
    marginBottom: '24px',
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1.2,
  },
  heroSubtitle: {
    fontSize: '1.25rem',
    color: '#888',
    marginBottom: '40px',
    lineHeight: 1.6,
  },
  heroButtons: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 32px',
    fontSize: '1.1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  secondaryButton: {
    background: 'transparent',
    color: '#fff',
    border: '2px solid rgba(255,255,255,0.2)',
    borderRadius: '12px',
    padding: '14px 30px',
    fontSize: '1.1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  section: {
    padding: '80px 20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '16px',
  },
  sectionSubtitle: {
    textAlign: 'center',
    color: '#888',
    fontSize: '1.1rem',
    marginBottom: '60px',
  },
  pricingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
    alignItems: 'start',
  },
  pricingCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '32px',
    position: 'relative',
    transition: 'transform 0.3s, border-color 0.3s',
  },
  popularBadge: {
    position: 'absolute',
    top: '-12px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    color: '#000',
    padding: '6px 20px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  planName: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '8px',
  },
  planPrice: {
    fontSize: '3rem',
    fontWeight: 800,
    marginBottom: '4px',
  },
  planNote: {
    color: '#888',
    fontSize: '0.9rem',
    marginBottom: '16px',
  },
  planDescription: {
    color: '#aaa',
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px 0',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    fontSize: '0.95rem',
  },
  checkIcon: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  xIcon: {
    color: '#666',
  },
  planButton: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '32px',
  },
  featureCard: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '24px',
  },
  featureIcon: {
    fontSize: '2rem',
    marginBottom: '16px',
  },
  featureTitle: {
    fontSize: '1.2rem',
    fontWeight: 600,
    marginBottom: '8px',
  },
  featureDescription: {
    color: '#888',
    fontSize: '0.95rem',
    lineHeight: 1.6,
  },
  testimonialGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
  },
  testimonialCard: {
    background: 'rgba(255,215,0,0.05)',
    border: '1px solid rgba(255,215,0,0.1)',
    borderRadius: '16px',
    padding: '24px',
  },
  testimonialQuote: {
    fontSize: '1.1rem',
    fontStyle: 'italic',
    marginBottom: '16px',
    lineHeight: 1.6,
  },
  testimonialAuthor: {
    fontWeight: 600,
  },
  testimonialRole: {
    color: '#888',
    fontSize: '0.9rem',
  },
  faqList: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  faqItem: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px',
    marginBottom: '12px',
    overflow: 'hidden',
  },
  faqQuestion: {
    padding: '20px 24px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 600,
  },
  faqAnswer: {
    padding: '0 24px 20px',
    color: '#888',
    lineHeight: 1.6,
  },
  cta: {
    background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,165,0,0.05) 100%)',
    borderRadius: '24px',
    padding: '60px 40px',
    textAlign: 'center',
    margin: '40px 0',
  },
  ctaTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    marginBottom: '16px',
  },
  ctaSubtitle: {
    color: '#888',
    marginBottom: '32px',
  },
  footer: {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    padding: '40px 20px',
    textAlign: 'center',
    color: '#666',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PricingPage() {
  const [expandedFaq, setExpandedFaq] = useState(null);
  
  return (
    <div style={styles.page}>
      {/* Navigation */}
      <nav style={styles.nav}>
        <div style={styles.logo}>🏭 DTGC SaaS</div>
        <div style={styles.navLinks}>
          <a href="#features" style={styles.navLink}>Features</a>
          <a href="#pricing" style={styles.navLink}>Pricing</a>
          <a href="#faq" style={styles.navLink}>FAQ</a>
          <button style={{ ...styles.primaryButton, padding: '10px 20px', fontSize: '0.9rem' }}>
            Launch App
          </button>
        </div>
      </nav>
      
      {/* Hero */}
      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>
          The Shopify of<br />DeFi Staking
        </h1>
        <p style={styles.heroSubtitle}>
          Launch your own branded staking platform in minutes.<br />
          No coding required. Battle-tested smart contracts included.
        </p>
        <div style={styles.heroButtons}>
          <button style={styles.primaryButton}>
            Start Free Trial →
          </button>
          <button style={styles.secondaryButton}>
            View Demo
          </button>
        </div>
        
        {/* Trust badges */}
        <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FFD700' }}>50+</div>
            <div style={{ color: '#888', fontSize: '0.9rem' }}>Platforms Launched</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FFD700' }}>$10M+</div>
            <div style={{ color: '#888', fontSize: '0.9rem' }}>Total Value Locked</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FFD700' }}>100%</div>
            <div style={{ color: '#888', fontSize: '0.9rem' }}>Uptime</div>
          </div>
        </div>
      </section>
      
      {/* Features */}
      <section id="features" style={styles.section}>
        <h2 style={styles.sectionTitle}>Everything You Need</h2>
        <p style={styles.sectionSubtitle}>
          Professional staking infrastructure without the development headaches
        </p>
        
        <div style={styles.featuresGrid}>
          {FEATURES.map((feature, i) => (
            <div key={i} style={styles.featureCard}>
              <div style={styles.featureIcon}>{feature.icon}</div>
              <div style={styles.featureTitle}>{feature.title}</div>
              <div style={styles.featureDescription}>{feature.description}</div>
            </div>
          ))}
        </div>
      </section>
      
      {/* Pricing */}
      <section id="pricing" style={styles.section}>
        <h2 style={styles.sectionTitle}>Simple Pricing</h2>
        <p style={styles.sectionSubtitle}>
          One-time payment. No hidden fees. Your platform forever.
        </p>
        
        <div style={styles.pricingGrid}>
          {PLANS.map((plan, i) => (
            <div
              key={i}
              style={{
                ...styles.pricingCard,
                borderColor: plan.popular ? plan.color : 'rgba(255,255,255,0.1)',
                transform: plan.popular ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {plan.popular && <div style={styles.popularBadge}>MOST POPULAR</div>}
              
              <div style={{ ...styles.planName, color: plan.color }}>{plan.name}</div>
              <div style={styles.planPrice}>{plan.price}</div>
              <div style={styles.planNote}>{plan.priceNote}</div>
              <div style={styles.planDescription}>{plan.description}</div>
              
              <ul style={styles.featureList}>
                {plan.features.map((feature, j) => (
                  <li key={j} style={styles.featureItem}>
                    <span style={styles.checkIcon}>✓</span>
                    {feature}
                  </li>
                ))}
                {plan.notIncluded.map((feature, j) => (
                  <li key={`not-${j}`} style={{ ...styles.featureItem, color: '#666' }}>
                    <span style={styles.xIcon}>✕</span>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <button
                style={{
                  ...styles.planButton,
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
        <div style={{ marginTop: '60px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '24px' }}>Optional Add-ons</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px 24px', borderRadius: '12px' }}>
              <strong>Managed Hosting</strong> — $99/mo
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px 24px', borderRadius: '12px' }}>
              <strong>Priority Support</strong> — $199/mo
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px 24px', borderRadius: '12px' }}>
              <strong>Custom Development</strong> — Contact Us
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials */}
      <section style={{ ...styles.section, background: 'rgba(0,0,0,0.3)' }}>
        <h2 style={styles.sectionTitle}>Trusted by Projects</h2>
        <p style={styles.sectionSubtitle}>
          See what our clients have to say
        </p>
        
        <div style={styles.testimonialGrid}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={styles.testimonialCard}>
              <div style={styles.testimonialQuote}>"{t.quote}"</div>
              <div style={styles.testimonialAuthor}>{t.author}</div>
              <div style={styles.testimonialRole}>{t.role}</div>
            </div>
          ))}
        </div>
      </section>
      
      {/* FAQ */}
      <section id="faq" style={styles.section}>
        <h2 style={styles.sectionTitle}>Frequently Asked Questions</h2>
        <p style={styles.sectionSubtitle}>
          Got questions? We've got answers.
        </p>
        
        <div style={styles.faqList}>
          {FAQ.map((item, i) => (
            <div key={i} style={styles.faqItem}>
              <div
                style={styles.faqQuestion}
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              >
                {item.q}
                <span>{expandedFaq === i ? '−' : '+'}</span>
              </div>
              {expandedFaq === i && (
                <div style={styles.faqAnswer}>{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>
      
      {/* CTA */}
      <section style={styles.section}>
        <div style={styles.cta}>
          <h2 style={styles.ctaTitle}>Ready to Launch Your Staking Platform?</h2>
          <p style={styles.ctaSubtitle}>
            Join 50+ projects already using our infrastructure
          </p>
          <button style={styles.primaryButton}>
            Get Started Now →
          </button>
        </div>
      </section>
      
      {/* Footer */}
      <footer style={styles.footer}>
        <div style={{ marginBottom: '16px' }}>
          <span style={{ color: '#FFD700', fontWeight: 700 }}>🏭 DTGC SaaS</span>
          {' '}— The Shopify of DeFi Staking
        </div>
        <div>
          © 2026 DTGC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
