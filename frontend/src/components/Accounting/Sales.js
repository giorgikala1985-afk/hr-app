import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

const DEFAULT_WIDTHS = [110, 160, 150, 130, 140, 200, 120, 80];

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconDelete() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

const EMPTY = { client: '', product: '', description: '', amount: '', currency: 'USD', category: '', date: '', hierarchy_id: '', hierarchy_node_id: '' };
const CATEGORIES = ['Product', 'Service', 'Consulting', 'License', 'Subscription', 'Other'];
// Builds parent→children map from edges (from=parent, to=child) and finds roots
// (nodes with no incoming edge). Falls back to the first node if none found.
function buildTree(nodes, edges) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const childrenMap = {};
  const hasParent = new Set();
  edges.forEach(e => {
    if (!nodeMap[e.from] || !nodeMap[e.to]) return;
    (childrenMap[e.from] = childrenMap[e.from] || []).push(e.to);
    hasParent.add(e.to);
  });
  let roots = nodes.filter(n => !hasParent.has(n.id)).map(n => n.id);
  if (roots.length === 0 && nodes.length > 0) roots = [nodes[0].id];
  return { nodeMap, childrenMap, roots };
}

function TreeRow({ id, depth, nodeMap, childrenMap, expanded, toggleExpand, selectedNodeId, onSelect, visited }) {
  if (visited.has(id)) return null; // guard against cycles
  const node = nodeMap[id];
  if (!node) return null;
  const children = (childrenMap[id] || []).filter(c => nodeMap[c]);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(id);
  const isSel = selectedNodeId === id;
  const childVisited = new Set(visited); childVisited.add(id);

  return (
    <div>
      <div
        onClick={() => onSelect(isSel ? '' : id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingLeft: 8 + depth * 20, paddingRight: 8,
          height: 30, borderRadius: 6, cursor: 'pointer',
          background: isSel ? '#3b82f61a' : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--surface)'; }}
        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(id); }}
            style={{
              width: 16, height: 16, flexShrink: 0, borderRadius: 4,
              border: '1px solid var(--border-2)', background: 'var(--surface)',
              color: 'var(--text-3)', fontSize: 11, fontWeight: 700, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
            }}
          >{isExpanded ? '−' : '+'}</button>
        ) : (
          <span style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-2)' }} />
          </span>
        )}
        <span style={{
          fontSize: 13, fontWeight: isSel ? 700 : 500,
          color: isSel ? '#3b82f6' : 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{node.name}</span>
      </div>
      {hasChildren && isExpanded && (
        <div style={{ marginLeft: 8 + depth * 20 + 8, borderLeft: '1px solid var(--border-2)' }}>
          {children.map(cid => (
            <TreeRow
              key={cid} id={cid} depth={depth + 1}
              nodeMap={nodeMap} childrenMap={childrenMap}
              expanded={expanded} toggleExpand={toggleExpand}
              selectedNodeId={selectedNodeId} onSelect={onSelect}
              visited={childVisited}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HierarchyTreeSelect({ hierarchy, selectedNodeId, onSelect }) {
  const nodes = hierarchy?.nodes || [];
  const edges = hierarchy?.edges || [];
  const { nodeMap, childrenMap, roots } = useMemo(() => buildTree(nodes, edges), [nodes, edges]);
  const [expanded, setExpanded] = useState(() => new Set(nodes.map(n => n.id)));

  useEffect(() => { setExpanded(new Set(nodes.map(n => n.id))); }, [hierarchy?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (nodes.length === 0) return null;

  const toggleExpand = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div style={{
      marginTop: 10, border: '1px solid var(--border-2)', borderRadius: 10,
      background: 'var(--surface-2)', maxHeight: 220, overflow: 'auto', padding: '6px 4px',
    }}>
      {roots.map(rid => (
        <TreeRow
          key={rid} id={rid} depth={0}
          nodeMap={nodeMap} childrenMap={childrenMap}
          expanded={expanded} toggleExpand={toggleExpand}
          selectedNodeId={selectedNodeId} onSelect={onSelect}
          visited={new Set()}
        />
      ))}
    </div>
  );
}

function Sales() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const [records, setRecords] = useState([]);
  const [agents, setAgents] = useState([]);
  const [hierarchies, setHierarchies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState('info');
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => { load(); loadAgents(); loadHierarchies(); }, []);

  useEffect(() => {
    if (user?.email !== 'giorgi@powerbi.ge') return;
    if (localStorage.getItem('hr_demo_sales_seeded')) return;
    const mkDate = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().split('T')[0]; };
    const items = [
      { client: 'Magti GSM', product: 'IT Consulting', description: 'HR system consultation Q2', amount: 2500, currency: 'USD', category: 'Consulting' },
      { client: 'Bank of Georgia', product: 'Software License', description: 'Annual Finpilot license', amount: 4800, currency: 'USD', category: 'License' },
      { client: 'Silknet', product: 'Network Maintenance', description: 'Monthly retainer July', amount: 1200, currency: 'USD', category: 'Service' },
      { client: 'Aris.ge', product: 'Marketing Package', description: 'Social media & SEO', amount: 800, currency: 'USD', category: 'Service' },
      { client: 'GPB', product: 'HR Platform', description: 'Annual subscription renewal', amount: 3600, currency: 'USD', category: 'Subscription' },
      { client: 'Rustavi Steel', product: 'ERP Consulting', description: 'Business process audit', amount: 2100, currency: 'USD', category: 'Consulting' },
      { client: 'Tegeta Motors', product: 'ERP Integration', description: 'System integration phase 1', amount: 5500, currency: 'USD', category: 'Product' },
      { client: 'Georgian Oil & Gas', product: 'Data Analytics', description: 'BI dashboard setup', amount: 1800, currency: 'USD', category: 'Service' },
      { client: 'GTC', product: 'Training Program', description: 'Staff onboarding training', amount: 950, currency: 'USD', category: 'Service' },
      { client: 'Skytel', product: 'Software Product', description: 'Custom reporting module', amount: 3200, currency: 'USD', category: 'Product' },
    ];
    items.forEach((item, i) => {
      api.post('/accounting/sales', { ...item, date: mkDate(i * 5 + 2) }).catch(() => {});
    });
    localStorage.setItem('hr_demo_sales_seeded', 'true');
  }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/sales');
      setRecords(res.data.records || []);
    } catch { setError(t('sales.failedLoad')); }
    finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/accounting/agents');
      setAgents(res.data.records || []);
    } catch { /* non-critical */ }
  };

  const loadHierarchies = async () => {
    try {
      const res = await api.get('/hierarchies');
      setHierarchies(res.data.hierarchies || []);
    } catch { /* non-critical */ }
  };

  const openNew = () => { setForm({ ...EMPTY, date: today() }); setEditId(null); setShowForm(true); setFormTab('info'); setError(''); };
  const openEdit = (r) => { setForm({ client: r.client, product: r.product || '', description: r.description || '', amount: r.amount, currency: r.currency, category: r.category || '', date: r.date, hierarchy_id: r.hierarchy_id || '', hierarchy_node_id: r.hierarchy_node_id || '' }); setEditId(r.id); setShowForm(true); setFormTab('info'); setError(''); };

  const handleSave = async () => {
    if (!form.client || !form.amount || !form.date) { setError(t('sales.validationError')); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/accounting/sales/${editId}`, form);
      else await api.post('/accounting/sales', form);
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.error || t('sales.failedSave')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('sales.deleteConfirm'))) return;
    try { await api.delete(`/accounting/sales/${id}`); load(); }
    catch { setError(t('sales.failedDelete')); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length && records.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(t('sales.deleteSelectedConfirm', { count: selectedIds.size }))) return;
    try {
      await api.delete('/accounting/sales/bulk', { data: { ids: Array.from(selectedIds) } });
      setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch { setError(t('sales.failedDeleteSelected')); }
  };

  return (
    <>
      <h2>{t('sales.title')}</h2>
      <p className="acc-subtitle">{t('sales.subtitle')}</p>

      <div className="acc-header-row">
        <div />
        <button className="btn-add" onClick={openNew}>{t('sales.addSale')}</button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, fontWeight: 500, color: '#555' }}>
          <span>{t('sales.selectedCount', { count: selectedIds.size })}</span>
          <button
            onClick={handleBulkDelete}
            style={{ background: '#e53935', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <IconDelete /> {t('sales.deleteSelected')}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ background: '#f5f5f5', color: '#666', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('sales.clear')}
          </button>
        </div>
      )}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>{t('sales.loading')}</p></div> : records.length === 0 ? (
          <div className="acc-empty"><div className="acc-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><p>{t('sales.noSales')}</p></div>
        ) : (
          <table className="acc-table">
            <colgroup>
              <col style={{ width: 40 }} />
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead><tr>
              <th style={{ width: 40, textAlign: 'center', verticalAlign: 'middle' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === records.length && records.length > 0}
                  onChange={toggleSelectAll}
                  title={t('sales.selectAll')}
                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                />
              </th>
              <th style={{ position: 'relative', width: colWidths[0], whiteSpace: 'nowrap' }}>{t('sales.colDate')}<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[1], whiteSpace: 'nowrap' }}>{t('sales.colClient')}<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[2], whiteSpace: 'nowrap' }}>{t('sales.colProduct')}<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[3], whiteSpace: 'nowrap' }}>{t('sales.colCategory')}<div onMouseDown={e => onResizeMouseDown(e, 3)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[4], whiteSpace: 'nowrap' }}>{t('sales.hierarchy')}<div onMouseDown={e => onResizeMouseDown(e, 4)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[5], whiteSpace: 'nowrap' }}>{t('sales.colDescription')}<div onMouseDown={e => onResizeMouseDown(e, 5)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[6], whiteSpace: 'nowrap' }}>{t('sales.colAmount')}<div onMouseDown={e => onResizeMouseDown(e, 6)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
              <th style={{ position: 'relative', width: colWidths[7], whiteSpace: 'nowrap' }}><div onMouseDown={e => onResizeMouseDown(e, 7)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
            </tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={selectedIds.has(r.id) ? { background: '#f0f9ff' } : {}}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.date}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><strong>{r.client}</strong></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.product || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.category && <span className="acc-category-badge">{r.category}</span>}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {r.hierarchy_id ? (() => {
                      const h = hierarchies.find(h => h.id === r.hierarchy_id);
                      if (!h) return '—';
                      const node = r.hierarchy_node_id ? h.nodes?.find(n => n.id === r.hierarchy_node_id) : null;
                      return (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                          {h.name}{node ? ` · ${node.name}` : ''}
                        </span>
                      );
                    })() : '—'}
                  </td>
                  <td style={{ color: '#64748b', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.description || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><span className="acc-amount income">+{r.currency} {parseFloat(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
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

      {showForm && (
        <div className="acc-modal-overlay">
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? t('sales.editSale') : t('sales.newSale')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '2px solid var(--border-2)' }}>
              {[
                { key: 'info', label: t('sales.tabSaleInfo') },
                { key: 'category', label: t('sales.tabCategory') },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFormTab(tab.key)}
                  style={{
                    padding: '9px 18px', border: 'none', background: 'none',
                    color: formTab === tab.key ? '#3b82f6' : 'var(--text-3)',
                    fontWeight: formTab === tab.key ? 700 : 500, fontSize: 14, cursor: 'pointer',
                    borderBottom: formTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                    marginBottom: -2, transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {formTab === 'info' && (
              <div className="acc-form-grid">
                <div className="acc-form-group">
                  <label>{t('sales.client')}</label>
                  <select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                    <option value="">{t('sales.selectClient')}</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="acc-form-group"><label>{t('sales.product')}</label><input type="text" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="e.g. Website design" /></div>
                <div className="acc-form-group"><label>{t('sales.date')}</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="acc-form-group"><label>{t('sales.amount')}</label><input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></div>
                <div className="acc-form-group"><label>{t('sales.currency')}</label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    <option>USD</option><option>GEL</option><option>EUR</option>
                  </select>
                </div>
                <div className="acc-form-group full"><label>{t('sales.colDescription')}</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('sales.optionalNotes')} /></div>
              </div>
            )}

            {formTab === 'category' && (
              <div>
                <div className="acc-form-grid">
                  <div className="acc-form-group"><label>{t('sales.category')}</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      <option value="">{t('sales.selectCategory')}</option>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="acc-form-group">
                    <label>{t('sales.hierarchy')}</label>
                    <select value={form.hierarchy_id} onChange={(e) => setForm({ ...form, hierarchy_id: e.target.value, hierarchy_node_id: '' })}>
                      <option value="">{t('sales.noHierarchy')}</option>
                      {hierarchies.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {form.hierarchy_id && (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 12, marginBottom: -2 }}>
                      {t('sales.hierarchyNodeHint')}
                    </div>
                    <HierarchyTreeSelect
                      hierarchy={hierarchies.find(h => h.id === form.hierarchy_id)}
                      selectedNodeId={form.hierarchy_node_id}
                      onSelect={(id) => setForm({ ...form, hierarchy_node_id: id })}
                    />
                  </>
                )}
              </div>
            )}

            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('sales.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('sales.saving') : t('sales.save')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const today = () => new Date().toISOString().split('T')[0];
export default Sales;
