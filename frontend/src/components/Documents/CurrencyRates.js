import React, { useState, useEffect, useCallback } from 'react';

const CURRENCIES = ['USD', 'EUR', 'GBP'];
const CURRENCY_COLORS = { USD: '#16a34a', EUR: '#2563eb', GBP: '#7c3aed' };
const CURRENCY_LABELS = { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound' };
const FLAG = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧' };

const PERIODS = [
  { key: 'day',   label: 'Day' },
  { key: 'week',  label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDatePoints(period) {
  const end = todayStr();
  if (period === 'week') {
    return Array.from({ length: 7 }, (_, i) => shiftDate(end, -(6 - i)));
  }
  if (period === 'month') {
    return Array.from({ length: 15 }, (_, i) => shiftDate(end, -(28 - i * 2)));
  }
  if (period === 'year') {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - i));
      return d.toISOString().slice(0, 10);
    });
  }
  return [];
}

async function fetchRatesForDate(date) {
  try {
    const url = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/?date=${date}&lang=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const list = json?.[0]?.currencies || [];
    const result = { date };
    CURRENCIES.forEach(code => {
      const found = list.find(c => c.code === code);
      if (found) result[code] = found.rate / (found.quantity || 1);
    });
    return result;
  } catch {
    return null;
  }
}

/* ── SVG Line Chart ── */
function SVGChart({ data, activeCurrencies }) {
  if (!data || data.length < 2) return null;

  const W = 580;
  const H = 220;
  const PAD = { top: 28, right: 20, bottom: 36, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allValues = [];
  activeCurrencies.forEach(cur => {
    data.forEach(d => { if (d[cur] != null) allValues.push(d[cur]); });
  });
  if (allValues.length === 0) return null;

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const pad = (rawMax - rawMin) * 0.12 || 0.05;
  const minVal = rawMin - pad;
  const maxVal = rawMax + pad;
  const valRange = maxVal - minVal;

  const xOf = (i) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yOf = (v) => PAD.top + chartH - ((v - minVal) / valRange) * chartH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => minVal + t * valRange);

  const xLabelSet = new Set();
  const step = Math.max(1, Math.floor(data.length / 5));
  for (let i = 0; i < data.length; i += step) xLabelSet.add(i);
  xLabelSet.add(data.length - 1);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Y gridlines + labels */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yOf(v)} x2={PAD.left + chartW} y2={yOf(v)}
            stroke="#f1f5f9" strokeWidth="1" />
          <text x={PAD.left - 8} y={yOf(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
            {v.toFixed(3)}
          </text>
        </g>
      ))}

      {/* X axis */}
      <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
        stroke="#e2e8f0" strokeWidth="1" />

      {/* Lines + dots per currency */}
      {activeCurrencies.map(cur => {
        const pts = data
          .map((d, i) => d[cur] != null ? { i, v: d[cur] } : null)
          .filter(Boolean);
        if (pts.length === 0) return null;
        const polyPoints = pts.map(({ i, v }) => `${xOf(i)},${yOf(v)}`).join(' ');
        return (
          <g key={cur}>
            <polyline points={polyPoints} fill="none"
              stroke={CURRENCY_COLORS[cur]} strokeWidth="2.5"
              strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(({ i, v }) => {
              const x = xOf(i);
              const y = yOf(v);
              const labelAbove = y > PAD.top + 18;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="3.5"
                    fill="white" stroke={CURRENCY_COLORS[cur]} strokeWidth="2" />
                  <text
                    x={x} y={labelAbove ? y - 8 : y + 16}
                    textAnchor="middle" fontSize="9" fontWeight="600"
                    fill={CURRENCY_COLORS[cur]}
                  >
                    {v.toFixed(3)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* X labels */}
      {data.map((d, i) => {
        if (!xLabelSet.has(i)) return null;
        return (
          <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {d.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Main Component ── */
export default function CurrencyRates() {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(todayStr());
  const [dayRates, setDayRates] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [activeCurrencies, setActiveCurrencies] = useState(['USD', 'EUR']);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDay = useCallback(async (d) => {
    setLoading(true);
    setError('');
    setDayRates([]);
    try {
      const url = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/?date=${d}&lang=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const list = json?.[0]?.currencies || [];
      setDayRates(list.filter(c => CURRENCIES.includes(c.code)));
    } catch {
      setError('Failed to load rates. NBG API may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChart = useCallback(async (p) => {
    setChartLoading(true);
    setError('');
    try {
      const dates = getDatePoints(p);
      const results = await Promise.all(dates.map(fetchRatesForDate));
      setChartData(results.filter(Boolean));
    } catch {
      setError('Failed to load historical data.');
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    if (period === 'day') {
      fetchDay(date);
    } else {
      fetchChart(period);
    }
  }, [period, date, fetchDay, fetchChart]);

  const toggleCurrency = (cur) => {
    setActiveCurrencies(prev =>
      prev.includes(cur)
        ? prev.length > 1 ? prev.filter(c => c !== cur) : prev
        : [...prev, cur]
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 700 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>NBG Exchange Rates</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>National Bank of Georgia — rates against GEL</p>
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding: '6px 20px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            background: period === p.key ? 'white' : 'transparent',
            color: period === p.key ? '#1e293b' : '#64748b',
            boxShadow: period === p.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {period === 'day' ? (
        /* ── Day view: rate cards ── */
        <div>
          <div style={{ marginBottom: 16 }}>
            <input type="date" value={date} max={todayStr()}
              onChange={e => setDate(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#1e293b', outline: 'none', cursor: 'pointer' }}
            />
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 40, fontSize: 13 }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dayRates.map(r => (
                <div key={r.code} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 32 }}>{FLAG[r.code]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{r.code}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{CURRENCY_LABELS[r.code]}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {r.quantity > 1 ? `${r.quantity} ${r.code}` : `1 ${r.code}`} = <strong style={{ color: '#1e293b' }}>{r.rate?.toFixed(4)}</strong> GEL
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{r.rate?.toFixed(4)}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color: r.diff > 0 ? '#16a34a' : r.diff < 0 ? '#dc2626' : '#94a3b8' }}>
                      {r.diff > 0 ? '▲' : r.diff < 0 ? '▼' : '—'} {Math.abs(r.diff)?.toFixed(4)}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && dayRates.length === 0 && !error && (
                <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 40, fontSize: 13 }}>No rates found for this date.</div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Chart view ── */
        <div>
          {/* Currency toggles */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {CURRENCIES.map(cur => {
              const active = activeCurrencies.includes(cur);
              return (
                <button key={cur} onClick={() => toggleCurrency(cur)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px',
                  border: `2px solid ${active ? CURRENCY_COLORS[cur] : '#e2e8f0'}`,
                  borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  background: active ? `${CURRENCY_COLORS[cur]}18` : 'white',
                  color: active ? CURRENCY_COLORS[cur] : '#94a3b8',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? CURRENCY_COLORS[cur] : '#e2e8f0', display: 'inline-block' }} />
                  {FLAG[cur]} {cur}
                </button>
              );
            })}
          </div>

          {/* Chart card */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 16px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {chartLoading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 13 }}>
                Loading chart data…
              </div>
            ) : chartData.length > 0 ? (
              <>
                <SVGChart data={chartData} activeCurrencies={activeCurrencies} />
                {/* Legend */}
                <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 10 }}>
                  {activeCurrencies.map(cur => (
                    <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                      <div style={{ width: 20, height: 3, background: CURRENCY_COLORS[cur], borderRadius: 2 }} />
                      {cur} / GEL
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 13 }}>No data available.</div>
            )}
          </div>

          {/* Latest value + period change cards */}
          {chartData.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              {activeCurrencies.map(cur => {
                const latest = [...chartData].reverse().find(d => d[cur] != null);
                const oldest = chartData.find(d => d[cur] != null);
                const change = latest && oldest ? latest[cur] - oldest[cur] : null;
                return (
                  <div key={cur} style={{ flex: 1, background: 'white', border: `1.5px solid ${CURRENCY_COLORS[cur]}30`, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{FLAG[cur]} {cur} / GEL</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{latest?.[cur]?.toFixed(4) ?? '—'}</div>
                    {change != null && (
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 3, color: change > 0.0001 ? '#16a34a' : change < -0.0001 ? '#dc2626' : '#94a3b8' }}>
                        {change > 0.0001 ? '▲' : change < -0.0001 ? '▼' : '—'} {Math.abs(change).toFixed(4)}
                        <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4 }}>this {period}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
