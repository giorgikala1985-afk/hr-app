import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { HugeiconsIcon } from '@hugeicons/react';
import { ExchangeDollarIcon } from '@hugeicons/core-free-icons';

const CURRENCIES = [
  { code: 'USD', flag: '🇺🇸', color: '#16a34a' },
  { code: 'EUR', flag: '🇪🇺', color: '#2563eb' },
  { code: 'GBP', flag: '🇬🇧', color: '#7c3aed' },
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

  const iconBg = theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#ecfdf5';

  return (
    <div className="home-stat-card" style={{ gap: 14 }}>
      <div className="home-stat-icon" style={{ background: iconBg, color: '#16a34a', flexShrink: 0 }}>
        <HugeiconsIcon icon={ExchangeDollarIcon} size={22} color="#16a34a" strokeWidth={1.8} />
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
              {CURRENCIES.map(({ code, flag, color }) => (
                <div key={code} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 13 }}>{flag}</span>
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
