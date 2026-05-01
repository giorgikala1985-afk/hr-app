import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

function fmtAmount(amount, currency) {
  if (amount == null) return '';
  return `${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
}

function toDateKey(d) {
  if (!d) return null;
  return d.slice(0, 10);
}

function buildEventMap(purchases, sales, invoices, transactions, labels) {
  const map = {};
  const add = (dateKey, event) => {
    if (!dateKey) return;
    if (!map[dateKey]) map[dateKey] = [];
    map[dateKey].push(event);
  };

  purchases.forEach(r => add(toDateKey(r.date), { type: 'purchase', label: r.vendor || labels.purchase, amount: r.amount, currency: r.currency, id: r.id, sub: r.description }));
  sales.forEach(r => add(toDateKey(r.date), { type: 'sale', label: r.client || labels.sale, amount: r.amount, currency: r.currency, id: r.id, sub: r.description }));
  invoices.forEach(r => {
    add(toDateKey(r.date), { type: 'invoice', label: r.client || labels.invoice, amount: r.total, currency: r.currency, id: r.id, sub: r.invoice_number });
    if (r.due_date) add(toDateKey(r.due_date), { type: 'invoice_due', label: r.client || labels.invoiceDue, amount: r.total, currency: r.currency, id: r.id, sub: r.invoice_number });
  });
  transactions.forEach(r => add(toDateKey(r.date), { type: 'transaction', label: r.client || labels.transaction, amount: r.amount, currency: null, id: r.id, sub: r.item_type, note: r.note }));

  return map;
}

export default function PaymentCalendar() {
  const { t } = useLanguage();
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const DAYS = [t('cal.sun'), t('cal.mon'), t('cal.tue'), t('cal.wed'), t('cal.thu'), t('cal.fri'), t('cal.sat')];
  const MONTHS = [t('cal.jan'), t('cal.feb'), t('cal.mar'), t('cal.apr'), t('cal.may'), t('cal.jun'), t('cal.jul'), t('cal.aug'), t('cal.sep'), t('cal.oct'), t('cal.nov'), t('cal.dec')];

  const TYPES = {
    purchase:    { label: t('cal.purchase'),    color: '#dc2626', bg: isDark ? 'rgba(220,38,38,0.12)'   : '#fef2f2', border: isDark ? 'rgba(220,38,38,0.3)'   : '#fca5a5' },
    sale:        { label: t('cal.sale'),        color: '#16a34a', bg: isDark ? 'rgba(22,163,74,0.1)'    : '#f0fdf4', border: isDark ? 'rgba(22,163,74,0.3)'    : '#86efac' },
    invoice:     { label: t('cal.invoice'),     color: '#2563eb', bg: isDark ? 'rgba(37,99,235,0.12)'   : '#eff6ff', border: isDark ? 'rgba(37,99,235,0.3)'    : '#93c5fd' },
    invoice_due: { label: t('cal.invoiceDue'),  color: '#d97706', bg: isDark ? 'rgba(217,119,6,0.12)'   : '#fffbeb', border: isDark ? 'rgba(217,119,6,0.3)'    : '#fcd34d' },
    transaction: { label: t('cal.transaction'), color: '#7c3aed', bg: isDark ? 'rgba(124,58,237,0.12)'  : '#f5f3ff', border: isDark ? 'rgba(124,58,237,0.3)'   : '#c4b5fd' },
  };

  const typeLabels = {
    purchase: t('cal.purchase'),
    sale: t('cal.sale'),
    invoice: t('cal.invoice'),
    invoiceDue: t('cal.invoiceDue'),
    transaction: t('cal.transaction'),
  };

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
        typeLabels,
      ));
    } catch {
      setError(t('cal.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, cur: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, cur: true });
  }
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ day: d, cur: false });
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const dayKey = (d) => `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const selectedEvents = selectedDay ? (events[dayKey(selectedDay)] || []) : [];

  const dotsFor = (d) => {
    const key = dayKey(d);
    const evs = events[key];
    if (!evs) return [];
    const seen = new Set();
    const dots = [];
    evs.forEach(e => { if (!seen.has(e.type)) { seen.add(e.type); dots.push(e.type); } });
    return dots.slice(0, 4);
  };

  const navBtnStyle = {
    width: 30, height: 30, border: '1px solid var(--border-2)', borderRadius: 7,
    background: 'var(--surface)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)',
  };

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* Calendar card */}
      <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', minWidth: 320 }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{t('cal.paymentSchedule')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>{t('cal.clickDay')}</div>
          </div>
          {loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          )}
        </div>

        {error && (
          <div style={{ margin: '12px 16px', padding: '10px 14px', background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2', color: '#dc2626', border: '1px solid', borderColor: isDark ? 'rgba(220,38,38,0.3)' : '#fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>
        )}

        {/* Month nav */}
        <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={navBtnStyle}
            onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            {MONTHS[month]} {year}
          </div>
          <button onClick={nextMonth} style={navBtnStyle}
            onMouseEnter={e => e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
          </button>
          <button onClick={goToday} style={{ padding: '5px 12px', border: '1px solid var(--border-2)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2563eb' }}
            onMouseEnter={e => e.currentTarget.style.background=isDark ? 'rgba(37,99,235,0.12)' : '#eff6ff'} onMouseLeave={e => e.currentTarget.style.background='var(--surface)'}>
            {t('cal.today')}
          </button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 12px', gap: 2, marginBottom: 4 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-4)', padding: '4px 0', letterSpacing: '0.04em' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 12px 16px', gap: 2 }}>
          {cells.map((cell, idx) => {
            if (!cell.cur) {
              return <div key={idx} style={{ minHeight: 52, padding: '6px 4px', borderRadius: 8, opacity: 0.3, cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{cell.day}</div>
              </div>;
            }
            const key = dayKey(cell.day);
            const isToday = key === todayKey;
            const isSelected = selectedDay === cell.day;
            const dots = dotsFor(cell.day);
            const hasEvents = dots.length > 0;
            const cellBg = isSelected
              ? (isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff')
              : isToday
              ? 'var(--surface-2)'
              : 'transparent';
            const cellBorder = isSelected
              ? '2px solid #2563eb'
              : isToday
              ? '2px solid var(--border-2)'
              : '2px solid transparent';
            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(isSelected ? null : cell.day)}
                style={{
                  minHeight: 52, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  background: cellBg,
                  border: cellBorder,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'var(--surface-2)' : 'transparent'; }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: isToday || isSelected ? 700 : 500,
                  color: isToday ? '#2563eb' : 'var(--text)',
                  background: isToday ? (isDark ? 'rgba(37,99,235,0.2)' : '#dbeafe') : 'transparent',
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
        <div style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--border-3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {Object.entries(TYPES).map(([key, tp]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: tp.color }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{tp.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, minWidth: 260 }}>
        {selectedDay ? (
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{MONTHS[month]} {selectedDay}, {year}</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>
                  {t('cal.events').replace('{count}', selectedEvents.length).replace('{s}', selectedEvents.length !== 1 ? 's' : '')}
                </div>
              </div>
              <button onClick={() => setSelectedDay(null)} style={{ width: 26, height: 26, border: 'none', background: 'var(--surface-3)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>{t('cal.noPayments')}</div>
            ) : (
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedEvents.map((ev, i) => {
                  const tp = TYPES[ev.type];
                  return (
                    <div key={i} style={{ padding: '10px 12px', background: tp.bg, border: `1px solid ${tp.border}`, borderRadius: 9, borderLeft: `3px solid ${tp.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: tp.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tp.label}</span>
                        {ev.amount != null && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{fmtAmount(ev.amount, ev.currency)}</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>{ev.label}</div>
                      {ev.sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{ev.sub}</div>}
                      {ev.note && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, fontStyle: 'italic' }}>{ev.note}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>{t('cal.selectDay')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{t('cal.clickDate')}</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
