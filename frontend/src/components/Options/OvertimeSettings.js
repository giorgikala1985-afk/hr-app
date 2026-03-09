import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const FONT_MONO = 'ui-monospace, "Cascadia Code", "SF Mono", "Fira Mono", Menlo, Consolas, monospace';

function OvertimeSettings() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editRate, setEditRate] = useState('');

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/overtime-rates');
      setRates(res.data.overtime_rates);
    } catch { setError('Failed to load overtime rates.'); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!label.trim() || !rate) return;
    setSaving(true); setError('');
    try {
      await api.post('/overtime-rates', { label: label.trim(), rate: parseFloat(rate) });
      setLabel(''); setRate(''); loadRates();
    } catch (err) { setError(err.response?.data?.error || 'Failed to create overtime rate.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this overtime rate?')) return;
    setError('');
    try { await api.delete(`/overtime-rates/${id}`); loadRates(); }
    catch { setError('Failed to delete overtime rate.'); }
  };

  const startEdit = (r) => { setEditId(r.id); setEditLabel(r.label); setEditRate(String(r.rate)); };
  const cancelEdit = () => { setEditId(null); setEditLabel(''); setEditRate(''); };

  const handleUpdate = async (id) => {
    if (!editLabel.trim() || !editRate) return;
    setError('');
    try {
      await api.put(`/overtime-rates/${id}`, { label: editLabel.trim(), rate: parseFloat(editRate) });
      setEditId(null); loadRates();
    } catch (err) { setError(err.response?.data?.error || 'Failed to update overtime rate.'); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Overtime Rates</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>Configure percentage rates used in salary calculations</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#64748b', background: '#f1f5f9', borderRadius: 20, padding: '3px 10px' }}>
          {rates.length} {rates.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, flexWrap: 'wrap', background: '#fff', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Label (e.g. Standard OT)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#ca8a04'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
        <input
          type="number"
          placeholder="Rate % (e.g. 110)"
          value={rate}
          onChange={e => setRate(e.target.value)}
          min="1"
          step="0.1"
          style={{ width: 150, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#ca8a04'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
        <button
          type="submit"
          disabled={saving || !label.trim() || !rate}
          style={{ padding: '9px 18px', background: saving || !label.trim() || !rate ? '#e2e8f0' : '#16a34a', color: saving || !label.trim() || !rate ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: saving || !label.trim() || !rate ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        >
          {saving ? 'Adding…' : '+ Add Rate'}
        </button>
      </form>

      {error && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>}

      {/* List */}
      {loading ? (
        <div style={{ padding: '32px 24px', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : rates.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏱</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>No overtime rates yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add your first rate above.</div>
        </div>
      ) : (
        <div>
          {rates.map((r, i) => (
            <div key={r.id} style={{ padding: '12px 24px', borderBottom: i < rates.length - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (editId !== r.id) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              {editId === r.id ? (
                <>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdate(r.id); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #ca8a04', borderRadius: 7, fontSize: 13, outline: 'none' }}
                  />
                  <input
                    type="number"
                    value={editRate}
                    onChange={e => setEditRate(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdate(r.id); if (e.key === 'Escape') cancelEdit(); }}
                    min="1"
                    step="0.1"
                    style={{ width: 100, padding: '7px 10px', border: '1px solid #ca8a04', borderRadius: 7, fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={() => handleUpdate(r.id)} style={{ padding: '7px 14px', background: '#ca8a04', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Save</button>
                  <button onClick={cancelEdit} style={{ padding: '7px 12px', background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                    </svg>
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{r.label}</span>
                  <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: '#2563eb', background: '#eff6ff', padding: '3px 10px', borderRadius: 20, border: '1px solid #bfdbfe' }}>
                    {r.rate}%
                  </span>
                  <button onClick={() => startEdit(r)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ca8a04'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(r.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OvertimeSettings;
