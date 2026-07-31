import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { HugeiconsIcon } from '@hugeicons/react';
import { ExchangeDollarIcon } from '@hugeicons/core-free-icons';

// Windows commonly renders flag emoji (🇺🇸🇪🇺🇬🇧) as plain two-letter text
// instead of a flag glyph, so these are drawn as small inline SVGs instead —
// guaranteed to render the same everywhere.
function FlagUS() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <clipPath id="cw-flag-us"><circle cx="12" cy="12" r="12" /></clipPath>
      <g clipPath="url(#cw-flag-us)">
        <rect width="24" height="24" fill="#B22234" />
        <rect y="1.85" width="24" height="1.85" fill="#fff" />
        <rect y="5.54" width="24" height="1.85" fill="#fff" />
        <rect y="9.23" width="24" height="1.85" fill="#fff" />
        <rect y="12.92" width="24" height="1.85" fill="#fff" />
        <rect y="16.62" width="24" height="1.85" fill="#fff" />
        <rect y="20.31" width="24" height="1.85" fill="#fff" />
        <rect width="10" height="13" fill="#3C3B6E" />
      </g>
    </svg>
  );
}

function FlagEU() {
  const dots = [...Array(8)].map((_, i) => {
    const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
    return { x: 12 + 7 * Math.cos(angle), y: 12 + 7 * Math.sin(angle) };
  });
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <clipPath id="cw-flag-eu"><circle cx="12" cy="12" r="12" /></clipPath>
      <g clipPath="url(#cw-flag-eu)">
        <rect width="24" height="24" fill="#003399" />
        {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="1.15" fill="#FFCC00" />)}
      </g>
    </svg>
  );
}

function FlagGB() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <clipPath id="cw-flag-gb"><circle cx="12" cy="12" r="12" /></clipPath>
      <g clipPath="url(#cw-flag-gb)">
        <rect width="24" height="24" fill="#00247D" />
        <path d="M0,0 L24,24 M24,0 L0,24" stroke="#fff" strokeWidth="4" />
        <path d="M0,0 L24,24 M24,0 L0,24" stroke="#CF142B" strokeWidth="2" />
        <path d="M12,0 V24 M0,12 H24" stroke="#fff" strokeWidth="6" />
        <path d="M12,0 V24 M0,12 H24" stroke="#CF142B" strokeWidth="3.5" />
      </g>
    </svg>
  );
}

const CURRENCIES = [
  { code: 'USD', Flag: FlagUS, color: '#479c73' },
  { code: 'EUR', Flag: FlagEU, color: '#2563eb' },
  { code: 'GBP', Flag: FlagGB, color: '#7c3aed' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function CurrencyWidget() {
  const { theme } = useTheme();
  const [rates, setRates] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const url = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/?date=${todayStr()}&lang=en`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const list = json?.[0]?.currencies || [];
        const result = {};
        CURRENCIES.forEach(({ code }) => {
          const found = list.find(c => c.code === code);
          if (found) result[code] = found.rate / (found.quantity || 1);
        });
        setRates(result);
      } catch {
        setError(true);
      }
    };
    fetchRates();
  }, []);

  if (error) return null;

  const iconBg = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(71,156,115,0.12)';

  return (
    <div className="home-stat-card" style={{ gap: 14 }}>
      <div className="home-stat-icon" style={{ background: iconBg, color: '#479c73', flexShrink: 0 }}>
        <HugeiconsIcon icon={ExchangeDollarIcon} size={22} color="#479c73" strokeWidth={1.8} />
      </div>
      <div>
        {rates === null ? (
          <>
            <div className="home-stat-value" style={{ fontSize: '1.1rem' }}>—</div>
            <div className="home-stat-label">Loading rates…</div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              {CURRENCIES.map(({ code, Flag, color }) => (
                <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Flag />
                  <span style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                    {rates[code]?.toFixed(4) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
            <div className="home-stat-label">NBG Rates · GEL</div>
          </>
        )}
      </div>
    </div>
  );
}

export default CurrencyWidget;
