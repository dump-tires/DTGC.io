# DT Gold Coin (DTGC) Gold Paper
## Detailed Tokenomics & Economic Model

---

## 1. Economic Overview

### 1.1 Protocol Revenue Model

DTGC generates sustainable revenue through a 7.5% round-trip fee structure:

```
Total Protocol Revenue = TVL × 7.5% × Cycles/Year

Example at $1M TVL (4 cycles/year):
Revenue = $1,000,000 × 7.5% × 4 = $300,000/year
```

### 1.2 Revenue Distribution

| Recipient | Entry (3.75%) | Exit (3.75%) | EES (20%) | Annual Share |
|-----------|---------------|--------------|-----------|--------------|
| DAO Treasury | 1.875% | 1.875% | 12% | 53.7% |
| Dev Fee | 0.625% | 0.625% | 5% | 17.8% |
| Auto LP | 1.0% | 1.0% | 3% | 22.9% |
| Token Burn | 0.25% | 0.25% | - | 5.7% |

---

## 2. Staking Economics

### 2.1 Net APR Calculations

After accounting for 7.5% fees:

| Tier | Gross APR | Fee Impact | Net APR (60d) | Net APR (Annual) |
|------|-----------|------------|---------------|------------------|
| Silver | 15.4% | -7.5% | +7.9% | +7.9% |
| Gold | 16.8% | -7.5% | +9.3% | +9.3% |
| Whale | 18.2% | -7.5% | +10.7% | +10.7% |
| Diamond | 42% (eff) | -7.5% | +34.5% | +34.5% |
| Diamond+ | 70% (eff) | -7.5% | +62.5% | +62.5% |

### 2.2 Break-Even Analysis

| Tier | Lock Period | Break-Even Point |
|------|-------------|------------------|
| Silver | 60 days | 178 days |
| Gold | 90 days | 163 days |
| Whale | 180 days | 150 days |
| Diamond | 90 days | 65 days |
| Diamond+ | 90 days | 39 days |

---

## 3. Treasury Sustainability Model

### 3.1 Starting Position
- DAO Treasury: 500,000,000 DTGC
- Current Price: $0.000343
- Treasury Value: $171,500

### 3.2 Projected Treasury Growth

| Year | Stakers | TVL | Fee Income | Rewards Paid | Net Flow | Treasury |
|------|---------|-----|------------|--------------|----------|----------|
| 1 | 30-100 | $50K | $14K | $10K | +$4K | 502M |
| 2 | 200 | $150K | $45K | $31K | +$14K | 516M |
| 3 | 400 | $400K | $120K | $83K | +$37K | 553M |
| 4 | 600 | $1M | $300K | $180K | +$120K | 673M |
| 5 | 1000 | $2.5M | $750K | $394K | +$356K | 1.03B |

### 3.3 Sustainability Formula

```
Treasury Sustainable When:
Fee Income ≥ Rewards Paid

Fee Income = TVL × 7.5% × 4 cycles = TVL × 30%
Rewards = TVL × Average APR

Break-even APR = 30% / 1.0 = 30%

Current Average APR ≈ 18%
Sustainability Margin: +12%
```

---

## 4. Dynamic APR Scaling

### 4.1 Market Cap Phase Triggers

| Phase | Market Cap | Price Target | APR Multiplier |
|-------|------------|--------------|----------------|
| Genesis | < $10M | < $0.01 | 100% |
| Growth | $10M - $25M | $0.01 - $0.025 | 85% |
| Expansion | $25M - $50M | $0.025 - $0.05 | 70% |
| Mature | $50M - $100M | $0.05 - $0.10 | 50% |
| Scaled | > $100M | > $0.10 | 35% |

### 4.2 APR at Each Phase

| Tier | Genesis | Growth | Expansion | Mature | Scaled |
|------|---------|--------|-----------|--------|--------|
| Silver | 15.4% | 13.1% | 10.8% | 7.7% | 5.4% |
| Gold | 16.8% | 14.3% | 11.8% | 8.4% | 5.9% |
| Whale | 18.2% | 15.5% | 12.7% | 9.1% | 6.4% |
| Diamond | 42% | 35.7% | 29.4% | 21% | 14.7% |
| Diamond+ | 70% | 59.5% | 49% | 35% | 24.5% |

---

## 5. Deflationary Mechanics

### 5.1 Burn Rate Calculation

```
Annual Burn = TVL × 0.5% × 4 cycles = TVL × 2%

At $5M TVL: $100,000 burned annually
At current price: ~291M DTGC burned per year at $5M TVL
```

### 5.2 Supply Reduction Timeline

| Year | Starting Supply | Burns | Ending Supply | Reduction |
|------|-----------------|-------|---------------|-----------|
| 1 | 1,000,000,000 | 2M | 998M | -0.2% |
| 2 | 998M | 5M | 993M | -0.7% |
| 3 | 993M | 10M | 983M | -1.7% |
| 4 | 983M | 17M | 966M | -3.4% |
| 5 | 966M | 34M | 932M | -6.8% |

---

## 6. LP Staking Economics

### 6.1 Impermanent Loss Compensation

Diamond+ tier (70% effective APR) compensates for IL:

| IL Scenario | IL Loss | APR Gain | Net Result |
|-------------|---------|----------|------------|
| 10% price drop | -0.14% | +70% | +69.86% |
| 25% price drop | -0.62% | +70% | +69.38% |
| 50% price drop | -5.72% | +70% | +64.28% |
| 2x price up | -5.72% | +70% | +64.28% |

### 6.2 LP Boost Multipliers

| Tier | Base APR | Boost | Effective APR | LP Pair |
|------|----------|-------|---------------|---------|
| Diamond | 28% | 1.5x | 42% | DTGC/PLS |
| Diamond+ | 35% | 2.0x | 70% | DTGC/URMOM |

---

## 7. Risk-Adjusted Returns

### 7.1 Sharpe Ratio Estimation

Assuming 5% risk-free rate and 25% volatility:

| Tier | Expected Return | Sharpe Ratio |
|------|-----------------|--------------|
| Silver | 7.9% | 0.12 |
| Gold | 9.3% | 0.17 |
| Whale | 10.7% | 0.23 |
| Diamond | 34.5% | 1.18 |
| Diamond+ | 62.5% | 2.30 |

### 7.2 Value at Risk (VaR)

95% VaR for $10,000 stake over 90 days:

| Tier | Expected Value | VaR (95%) | Worst Case |
|------|----------------|-----------|------------|
| Silver | $10,197 | $8,750 | -$1,250 |
| Diamond+ | $11,718 | $9,180 | -$820 |

---

## 8. Competitive Analysis

### 8.1 Fee Comparison

| Protocol | Entry Fee | Exit Fee | Total |
|----------|-----------|----------|-------|
| **DTGC** | **3.75%** | **3.75%** | **7.5%** |
| Typical DEX LP | 0.3% | 0.3% | 0.6% |
| Yield Farm | 0-4% | 0-4% | 0-8% |
| HEX | 0% | 0% | 0% |

### 8.2 APR Comparison

| Protocol | Typical APR | Sustainability |
|----------|-------------|----------------|
| **DTGC** | **15-70%** | **Self-sustaining** |
| DEX LP | 5-20% | Fee-dependent |
| Yield Farm | 50-500% | Inflationary |
| CEX Staking | 3-8% | Centralized |

---

## 9. Investment Thesis

### 9.1 Bull Case
- Protocol reaches $50M market cap
- Treasury grows to $25M+
- APRs remain attractive even at scaled phase
- Token burns reduce supply significantly

### 9.2 Base Case
- Steady growth to $10M market cap
- Treasury remains self-sustaining
- Modest returns for stakers
- Protocol operates indefinitely

### 9.3 Bear Case
- Market crash reduces TVL
- Early exits trigger EES penalties
- Treasury absorbs excess through fees
- Protocol survives but returns compressed

---

## 10. Conclusion

DTGC's V19 tokenomics represent a carefully balanced economic model designed for multi-year sustainability. The 7.5% fee structure ensures protocol revenue exceeds reward obligations across all growth phases, while dynamic APR scaling maintains attractive yields during expansion and stability during maturity.

---

**Document Version:** Gold Paper V19
**Last Updated:** January 2026
**Classification:** Investor Documentation

*This document is for qualified investors and does not constitute financial advice. Past performance does not guarantee future results.*
