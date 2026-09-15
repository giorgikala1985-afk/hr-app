import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const today = () => new Date().toISOString().split('T')[0];
const DAY_MS = 86400000;

const EMPTY = { agent_id: '', company_name: '', order_date: today(), item_name: '', quantity: '', is_common: true };

const PALETTE = ['#2563eb', '#479c73', '#f59e0b', '#dc2626', '#7c3aed', '#0d9488', '#ec4899', '#f97316'];
function colorForItem(name) {
  let h = 0;
  const s = name || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function groupKey(o) {
  return `${o.agent_id || (o.company_name || '').trim().toLowerCase() || '—'}__${(o.item_name || '').trim().toLowerCase()}`;
}

function computeForecast(groupOrders) {
  const common = groupOrders.filter(o => o.is_common !== false).sort((a, b) => new Date(a.order_date) - new Date(b.order_date));
  if (common.length < 4) return null;
  const last4 = common.slice(-4);
  const intervals = [];
  for (let i = 1; i < last4.length; i++) intervals.push((new Date(last4[i].order_date) - new Date(last4[i - 1].order_date)) / DAY_MS);
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const avgQty = last4.reduce((s, o) => s + parseFloat(o.quantity || 0), 0) / last4.length;
  const lastOrder = last4[last4.length - 1];
  const forecastDate = new Date(new Date(lastOrder.order_date).getTime() + avgInterval * DAY_MS);
  return {
    avgIntervalDays: Math.round(avgInterval),
    avgQty,
    forecastDate: forecastDate.toISOString().slice(0, 10),
    lastOrderDate: lastOrder.order_date,
  };
}

function IconEdit() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconDelete() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>; }
function IconPlus() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }

export default function ItemOrders() {
  const { t } = useLanguage();
  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentOpen, setAgentOpen] = useState(false);
  const [view, setView] = useState('list');

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => { load(); loadAgents(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/item-orders');
      setRecords(res.data.records || []);
    } catch { setError(t('itemOrders.failedLoad')); }
    finally { setLoading(false); }
  };
  const loadAgents = async () => {
    try { const res = await api.get('/accounting/agents'); setAgents(res.data.records || []); } catch { /* non-critical */ }
  };

  const companyLabel = (o) => o.agent_id ? (agents.find(a => a.id === o.agent_id)?.name || t('itemOrders.unknownCompany')) : (o.company_name || '—');

  const groups = useMemo(() => {
    const map = {};
    records.forEach(o => {
      const k = groupKey(o);
      if (!map[k]) map[k] = { key: k, agent_id: o.agent_id, company_name: o.company_name, item_name: o.item_name, orders: [] };
      map[k].orders.push(o);
    });
    return Object.values(map).map(g => ({ ...g, forecast: computeForecast(g.orders) }));
  }, [records]);

  const forecastGroups = useMemo(
    () => groups.filter(g => g.forecast).sort((a, b) => new Date(a.forecast.forecastDate) - new Date(b.forecast.forecastDate)),
    [groups]
  );

  const sortedRecords = useMemo(() => [...records].sort((a, b) => new Date(b.order_date) - new Date(a.order_date)), [records]);

  /* ── Form ── */
  const openNew = () => { setForm({ ...EMPTY, order_date: today() }); setEditId(null); setAgentSearch(''); setShowForm(true); setError(''); };
  const openEdit = (r) => {
    setForm({
      agent_id: r.agent_id || '', company_name: r.company_name || '',
      order_date: r.order_date || today(), item_name: r.item_name || '',
      quantity: r.quantity ?? '', is_common: r.is_common !== false,
    });
    setAgentSearch(r.agent_id ? (agents.find(a => a.id === r.agent_id)?.name || '') : (r.company_name || ''));
    setEditId(r.id); setShowForm(true); setError('');
  };

  const handleSave = async () => {
    if (!form.order_date || !form.item_name.trim() || form.quantity === '') { setError(t('itemOrders.requiredFields')); return; }
    if (!form.agent_id && !form.company_name.trim()) { setError(t('itemOrders.companyRequired')); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        agent_id: form.agent_id || null,
        company_name: form.agent_id ? null : form.company_name.trim(),
        order_date: form.order_date,
        item_name: form.item_name.trim(),
        quantity: form.quantity,
        is_common: form.is_common,
      };
      if (editId) await api.put(`/accounting/item-orders/${editId}`, payload);
      else await api.post('/accounting/item-orders', payload);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('itemOrders.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('itemOrders.deleteConfirm'))) return;
    try { await api.delete(`/accounting/item-orders/${id}`); load(); }
    catch { setError(t('itemOrders.failedDelete')); }
  };

  /* ── Calendar ── */
  const DAYS = [t('cal.sun'), t('cal.mon'), t('cal.tue'), t('cal.wed'), t('cal.thu'), t('cal.fri'), t('cal.sat')];
  const MONTHS = [t('cal.jan'), t('cal.feb'), t('cal.mar'), t('cal.apr'), t('cal.may'), t('cal.jun'), t('cal.jul'), t('cal.aug'), t('cal.sep'), t('cal.oct'), t('cal.nov'), t('cal.dec')];

  const calEvents = useMemo(() => {
    const map = {};
    const add = (dateKey, ev) => { if (!dateKey) return; if (!map[dateKey]) map[dateKey] = []; map[dateKey].push(ev); };
    records.forEach(o => add(o.order_date?.slice(0, 10), {
      kind: 'order', color: colorForItem(o.item_name), item_name: o.item_name,
      company: companyLabel(o), quantity: o.quantity, is_common: o.is_common !== false,
    }));
    forecastGroups.forEach(g => add(g.forecast.forecastDate, {
      kind: 'forecast', color: colorForItem(g.item_name), item_name: g.item_name,
      company: g.agent_id ? (agents.find(a => a.id === g.agent_id)?.name || '—') : (g.company_name || '—'),
      quantity: Math.round(g.forecast.avgQty * 10) / 10,
    }));
    return map;
  }, [records, forecastGroups, agents]);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); setSelectedDay(null); };
  const goToday = () => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()); setSelectedDay(null); };

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev = new Date(calYear, calMonth, 0).getDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, cur: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, cur: true });
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) cells.push({ day: d, cur: false });

  const todayKey = today();
  const dayKey = (d) => `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const selectedEvents = selectedDay ? (calEvents[dayKey(selectedDay)] || []) : [];

  /* ── Shared styles ── */
  const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 };
  const inpStyle = { width: '100%', padding: '9px 11px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' };
  const cancelBtn = { padding: '9px 16px', border: '1px solid var(--border-2)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  const navBtnStyle = { width: 30, height: 30, border: '1px solid var(--border-2)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' };

  return (
    <div>
      <h2>{t('itemOrders.title')}</h2>
      <p className="acc-subtitle">{t('itemOrders.subtitle')}</p>

      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('itemOrders.totalOrders')}</span>
          <span className="acc-summary-value">{records.length}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('itemOrders.itemsTracked')}</span>
          <span className="acc-summary-value">{groups.length}</span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">{t('itemOrders.upcomingForecasts')}</span>
          <span className="acc-summary-value" style={{ color: '#2563eb' }}>{forecastGroups.length}</span>
        </div>
      </div>

      {forecastGroups.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('itemOrders.forecastsHeading')}</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {forecastGroups.map(g => {
              const color = colorForItem(g.item_name);
              const companyName = g.agent_id ? (agents.find(a => a.id === g.agent_id)?.name || '—') : (g.company_name || '—');
              const overdue = new Date(g.forecast.forecastDate) < new Date(todayKey);
              return (
                <div key={g.key} style={{ minWidth: 220, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border-2)', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{g.item_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{companyName}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-3)' }}>{t('itemOrders.nextExpected')}</span>
                    <span style={{ fontWeight: 700, color: overdue ? '#dc2626' : 'var(--text)' }}>{g.forecast.forecastDate}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 3 }}>
                    <span style={{ color: 'var(--text-3)' }}>{t('itemOrders.forecastQty')}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>~{Math.round(g.forecast.avgQty * 10) / 10}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="acc-header-row">
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
          <button onClick={() => setView('list')} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: view === 'list' ? 'var(--surface)' : 'transparent', boxShadow: view === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: 12, fontWeight: 600, color: view === 'list' ? 'var(--text)' : 'var(--text-4)', cursor: 'pointer' }}>{t('itemOrders.viewList')}</button>
          <button onClick={() => setView('calendar')} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: view === 'calendar' ? 'var(--surface)' : 'transparent', boxShadow: view === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: 12, fontWeight: 600, color: view === 'calendar' ? 'var(--text)' : 'var(--text-4)', cursor: 'pointer' }}>{t('itemOrders.viewCalendar')}</button>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#479c73', borderColor: '#479c73' }}>
          <IconPlus /> {t('itemOrders.newOrder')}
        </button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      {view === 'list' ? (
        <div className="acc-table-wrapper">
          {loading ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-4)' }}>{t('itemOrders.loading')}</div>
          ) : records.length === 0 ? (
            <div className="acc-empty"><p>{t('itemOrders.noRecords')}</p></div>
          ) : (
            <table className="acc-table">
              <thead>
                <tr>
                  <th>{t('itemOrders.colDate')}</th>
                  <th>{t('itemOrders.colCompany')}</th>
                  <th>{t('itemOrders.colItem')}</th>
                  <th>{t('itemOrders.colQty')}</th>
                  <th>{t('itemOrders.colCommon')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map(r => (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--text-3)' }}>{r.order_date ? new Date(r.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>{companyLabel(r)}</td>
                    <td><strong>{r.item_name}</strong></td>
                    <td>{r.quantity}</td>
                    <td>
                      {r.is_common !== false
                        ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(71,156,115,0.12)', color: '#479c73' }}>{t('itemOrders.common')}</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(148,163,184,0.15)', color: 'var(--text-4)' }}>{t('itemOrders.uncommon')}</span>}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon" onClick={() => openEdit(r)} title="Edit" style={{ color: '#3b82f6' }}><IconEdit /></button>
                        <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete"><IconDelete /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden', minWidth: 320 }}>
            <div style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={prevMonth} style={navBtnStyle}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg></button>
              <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{MONTHS[calMonth]} {calYear}</div>
              <button onClick={nextMonth} style={navBtnStyle}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg></button>
              <button onClick={goToday} style={{ padding: '5px 12px', border: '1px solid var(--border-2)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2563eb' }}>{t('cal.today')}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 12px', gap: 2, marginBottom: 4 }}>
              {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-4)', padding: '4px 0' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 12px 16px', gap: 2 }}>
              {cells.map((cell, idx) => {
                if (!cell.cur) return <div key={idx} style={{ minHeight: 52, padding: '6px 4px', opacity: 0.3 }}><div style={{ fontSize: 12, color: 'var(--text-4)' }}>{cell.day}</div></div>;
                const key = dayKey(cell.day);
                const isToday = key === todayKey;
                const isSelected = selectedDay === cell.day;
                const evs = calEvents[key] || [];
                return (
                  <div key={idx} onClick={() => setSelectedDay(isSelected ? null : cell.day)}
                    style={{
                      minHeight: 52, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      background: isSelected ? 'var(--surface-2)' : isToday ? 'var(--surface-2)' : 'transparent',
                      border: isSelected ? '2px solid #2563eb' : isToday ? '2px solid var(--border-2)' : '2px solid transparent',
                    }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isToday || isSelected ? 700 : 500, color: isToday ? '#2563eb' : 'var(--text)' }}>{cell.day}</div>
                    {evs.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {evs.slice(0, 4).map((e, i) => (
                          <div key={i} style={e.kind === 'forecast'
                            ? { width: 6, height: 6, borderRadius: '50%', border: `1.5px dashed ${e.color}`, background: 'transparent' }
                            : { width: 6, height: 6, borderRadius: '50%', background: e.color }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--border-3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-3)' }} /><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('itemOrders.legendOrder')}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px dashed var(--text-3)' }} /><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('itemOrders.legendForecast')}</span></div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            {selectedDay ? (
              <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-3)', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{MONTHS[calMonth]} {selectedDay}, {calYear}</div>
                {selectedEvents.length === 0 ? (
                  <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>{t('itemOrders.noEvents')}</div>
                ) : (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedEvents.map((e, i) => (
                      <div key={i} style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 9, borderLeft: `3px solid ${e.color}`, borderStyle: e.kind === 'forecast' ? 'dashed' : 'solid', borderWidth: e.kind === 'forecast' ? '0 0 0 3px' : '0 0 0 3px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: e.color, textTransform: 'uppercase' }}>{e.kind === 'forecast' ? t('itemOrders.legendForecast') : t('itemOrders.legendOrder')}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>{e.item_name} — {e.quantity}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{e.company}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', padding: '28px 20px', textAlign: 'center', fontSize: 12, color: 'var(--text-4)' }}>{t('itemOrders.selectDay')}</div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h3>{editId ? t('itemOrders.editOrder') : t('itemOrders.newOrder')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={lbl}>{t('itemOrders.company')}</label>
              <input
                value={agentSearch || form.company_name}
                onChange={e => { setAgentSearch(e.target.value); setForm(prev => ({ ...prev, company_name: e.target.value, agent_id: '' })); setAgentOpen(true); }}
                onFocus={() => setAgentOpen(true)}
                onBlur={() => setTimeout(() => setAgentOpen(false), 150)}
                placeholder={t('itemOrders.companyPlaceholder')}
                style={inpStyle}
              />
              {agentOpen && agents.filter(a => a.name.toLowerCase().includes((agentSearch || form.company_name).toLowerCase())).length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 10, maxHeight: 180, overflowY: 'auto' }}>
                  {agents.filter(a => a.name.toLowerCase().includes((agentSearch || form.company_name).toLowerCase())).map(a => (
                    <div key={a.id} onMouseDown={() => { setForm(prev => ({ ...prev, agent_id: a.id, company_name: a.name })); setAgentSearch(a.name); setAgentOpen(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--border-2)', color: 'var(--text)' }}>
                      {a.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>{t('itemOrders.orderDate')}</label>
                <input type="date" value={form.order_date} onChange={e => setForm(prev => ({ ...prev, order_date: e.target.value }))} style={inpStyle} />
              </div>
              <div>
                <label style={lbl}>{t('itemOrders.quantity')}</label>
                <input type="number" min="0" step="1" value={form.quantity} onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))} placeholder="0" style={inpStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{t('itemOrders.itemName')}</label>
              <input list="item-orders-item-names" value={form.item_name} onChange={e => setForm(prev => ({ ...prev, item_name: e.target.value }))} placeholder={t('itemOrders.itemNamePlaceholder')} style={inpStyle} />
              <datalist id="item-orders-item-names">
                {[...new Set(records.map(r => r.item_name).filter(Boolean))].map(name => <option key={name} value={name} />)}
              </datalist>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>{t('itemOrders.markLabel')}</label>
              <select value={form.is_common ? 'common' : 'uncommon'} onChange={e => setForm(prev => ({ ...prev, is_common: e.target.value === 'common' }))} style={inpStyle}>
                <option value="common">{t('itemOrders.common')}</option>
                <option value="uncommon">{t('itemOrders.uncommon')}</option>
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 5 }}>{t('itemOrders.markHint')}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={cancelBtn} onClick={() => setShowForm(false)}>{t('itemOrders.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('itemOrders.saving') : t('itemOrders.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
