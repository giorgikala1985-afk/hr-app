import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const TYPES = {
  purchase:    { label: 'Purchase',      color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  sale:        { label: 'Sale',          color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  invoice:     { label: 'Invoice',       color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
  invoice_due: { label: 'Invoice Due',   color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  transaction: { label: 'Transaction',   color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtAmount(amount, currency) {
  if (amount == null) return '';
  return `${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
}

function toDateKey(d) {
  if (!d) return null;
  return d.slice(0, 10); // YYYY-MM-DD
}

function buildEventMap(purchases, sales, invoices, transactions) {
  const map = {};
  const add = (dateKey, event) => {
    if (!dateKey) return;
    if (!map[dateKey]) map[dateKey] = [];
    map[dateKey].push(event);
  };

  purchases.forEach(r => add(toDateKey(r.date), { type: 'purchase', label: r.vendor || r.description || 'Purchase', amount: r.amount, currency: r.currency, id: r.id }));
  sales.forEach(r => add(toDateKey(r.date), { type: 'sale', label: r.client || r.description || 'Sale', amount: r.amount, currency: r.currency, id: r.id }));
  invoices.forEach(r => {
    add(toDateKey(r.date), { type: 'invoice', label: r.client || r.invoice_number || 'Invoice', amount: r.total, currency: r.currency, id: r.id, sub: r.invoice_number });
    if (r.due_date) add(toDateKey(r.due_date), { type: 'invoice_due', label: r.client || r.invoice_number || 'Invoice Due', amount: r.total, currency: r.currency, id: r.id, sub: r.invoice_number });
  });
  transactions.forEach(r => add(toDateKey(r.date), { type: 'transaction', label: r.client || r.item_type || 'Transaction', amount: r.amount, currency: null, id: r.id }));

  return map;
}

export default function PaymentCalendar() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [selectedDay, setSelectedDay] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, s, inv, tr] = await Promise.all([
        api.get('/accounting/purchases'),
        api.get('/accounting/sales'),
        api.get('/accounting/invoices'),
        api.get('/accounting/transactions'),
      ]);
      setEvents(buildEventMap(
        p.data.records   || [],
        s.data.records   || [],
        inv.data.records || [],
        tr.data.records  || [],
      ));
    } catch {
      setError('Failed to load payment data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Navigation
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(null); };

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const cells = [];
  // Leading days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, cur: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, cur: true });
  }
  // Trailing days
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ day: d, cur: false });
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const dayKey = (d) => `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const selectedEvents = selectedDay ? (events[dayKey(selectedDay)] || []) : [];

  // Unique type colors present in a day (max 4 dots)
  const dotsFor = (d) => {
    const key = dayKey(d);
    const evs = events[key];
    if (!evs) return [];
    const seen = new Set();
    const dots = [];
    evs.forEach(e => { if (!seen.has(e.type)) { seen.add(e.type); dots.push(e.type); } });
    return dots.slice(0, 4);
  };

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* Calendar card */}
      <div style={{ flex: '1 1 520px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', minWidth: 320 }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: '#fafbfc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Payment Schedule</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>Click a day to see payment details</div>
          </div>
          {loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          )}
        </div>

        {error && (
          <div style={{ margin: '12px 16px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>
        )}

        {/* Month nav */}
        <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
            onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
            {MONTHS[month]} {year}
          </div>
          <button onClick={nextMonth} style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
            onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
          </button>
          <button onClick={goToday} style={{ padding: '5px 12px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2563eb' }}
            onMouseEnter={e => e.currentTarget.style.background='#eff6ff'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
            Today
          </button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 12px', gap: 2, marginBottom: 4 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 0', letterSpacing: '0.04em' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 12px 16px', gap: 2 }}>
          {cells.map((cell, idx) => {
            if (!cell.cur) {
              return <div key={idx} style={{ minHeight: 52, padding: '6px 4px', borderRadius: 8, opacity: 0.3, cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{cell.day}</div>
              </div>;
            }
            const key = dayKey(cell.day);
            const isToday = key === todayKey;
            const isSelected = selectedDay === cell.day;
            const dots = dotsFor(cell.day);
            const hasEvents = dots.length > 0;
            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(isSelected ? null : cell.day)}
                style={{
                  minHeight: 52, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  background: isSelected ? '#eff6ff' : isToday ? '#f8fafc' : 'transparent',
                  border: isSelected ? '2px solid #2563eb' : isToday ? '2px solid #e2e8f0' : '2px solid transparent',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? '#f8fafc' : 'transparent'; }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: isToday || isSelected ? 700 : 500,
                  color: isToday ? '#2563eb' : '#1e293b',
                  background: isToday ? '#dbeafe' : 'transparent',
                }}>
                  {cell.day}
                </div>
                {hasEvents && (
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {dots.map(type => (
                      <div key={type} style={{ width: 6, height: 6, borderRadius: '50%', background: TYPES[type].color }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ padding: '10px 20px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {Object.entries(TYPES).map(([key, t]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: '0 1 300px', minWidth: 260 }}>
        {selectedDay ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#fafbfc', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{MONTHS[month]} {selectedDay}, {year}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ width: 26, height: 26, border: 'none', background: '#f1f5f9', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ padding: '24px 18px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No payments on this day</div>
            ) : (
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedEvents.map((ev, i) => {
                  const t = TYPES[ev.type];
                  return (
                    <div key={i} style={{ padding: '10px 12px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 9, borderLeft: `3px solid ${t.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: t.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.label}</span>
                        {ev.amount != null && <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{fmtAmount(ev.amount, ev.currency)}</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 3 }}>{ev.label}</div>
                      {ev.sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>#{ev.sub}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Select a day</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Click any date to view payment details</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
