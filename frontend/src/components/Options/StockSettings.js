import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const EMPTY = { name: '', add_date: '', area: '', address: '' };

function StockSettings() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState(EMPTY);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/stock-locations');
      setLocations(res.data.locations || []);
    } catch { setError('Failed to load stock locations.'); }
    finally { setLoading(false); }
  };

  const f  = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const ef = k => e => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true); setError('');
    try {
      await api.post('/stock-locations', form);
      setForm(EMPTY); load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to add.'); }
    finally { setSaving(false); }
  };

  const startEdit = (loc) => {
    setEditId(loc.id);
    setEditForm({ name: loc.name || '', add_date: loc.add_date || '', area: loc.area || '', address: loc.address || '' });
  };
  const cancelEdit = () => { setEditId(null); setEditForm(EMPTY); };

  const handleUpdate = async (id) => {
    if (!editForm.name.trim()) return;
    setError('');
    try {
      await api.put(`/stock-locations/${id}`, editForm);
      setEditId(null); load();
    } catch (err) { setError(err.response?.data?.error || 'Failed to update.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this stock location?')) return;
    setError('');
    try { await api.delete(`/stock-locations/${id}`); load(); }
    catch { setError('Failed to delete.'); }
  };

  const INPUT = {
    flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Stock Locations</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>Manage warehouse and storage locations for stock items.</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#64748b', background: '#f1f5f9', borderRadius: 20, padding: '3px 10px' }}>
          {locations.length} {locations.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 8, marginBottom: 8 }}>
          <input type="text" placeholder="Name *" value={form.name} onChange={f('name')} style={INPUT}
            onFocus={e => e.target.style.borderColor = '#16a34a'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
          <input type="date" value={form.add_date} onChange={f('add_date')} style={INPUT}
            onFocus={e => e.target.style.borderColor = '#16a34a'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
          <input type="text" placeholder="Area" value={form.area} onChange={f('area')} style={INPUT}
            onFocus={e => e.target.style.borderColor = '#16a34a'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Address" value={form.address} onChange={f('address')} style={{ ...INPUT, flex: 1 }}
            onFocus={e => e.target.style.borderColor = '#16a34a'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
          <button type="submit" disabled={saving || !form.name.trim()} style={{
            padding: '8px 18px', background: saving || !form.name.trim() ? '#e2e8f0' : '#16a34a',
            color: saving || !form.name.trim() ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8,
            fontWeight: 600, fontSize: 13, cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s', fontFamily: 'inherit',
          }}>
            {saving ? 'Adding…' : '+ Add'}
          </button>
        </div>
      </form>

      {error && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>}

      {/* List */}
      {loading ? (
        <div style={{ padding: '32px 24px', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : locations.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>No stock locations yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add your first location above.</div>
        </div>
      ) : (
        <div>
          {locations.map((loc, i) => (
            <div key={loc.id}
              style={{ padding: '12px 24px', borderBottom: i < locations.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.1s' }}
              onMouseEnter={e => { if (editId !== loc.id) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              {editId === loc.id ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 8, marginBottom: 8 }}>
                    <input type="text" placeholder="Name *" value={editForm.name} onChange={ef('name')}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(loc.id); if (e.key === 'Escape') cancelEdit(); }}
                      autoFocus style={{ ...INPUT, borderColor: '#16a34a' }} />
                    <input type="date" value={editForm.add_date} onChange={ef('add_date')} style={{ ...INPUT, borderColor: '#16a34a' }} />
                    <input type="text" placeholder="Area" value={editForm.area} onChange={ef('area')} style={{ ...INPUT, borderColor: '#16a34a' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" placeholder="Address" value={editForm.address} onChange={ef('address')} style={{ ...INPUT, flex: 1, borderColor: '#16a34a' }} />
                    <button onClick={() => handleUpdate(loc.id)} style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                    <button onClick={cancelEdit} style={{ padding: '7px 12px', background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{loc.name}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                      {loc.add_date && <span style={{ fontSize: 11, color: '#64748b' }}>{loc.add_date}</span>}
                      {loc.area    && <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '1px 6px' }}>{loc.area}</span>}
                      {loc.address && <span style={{ fontSize: 11, color: '#94a3b8' }}>{loc.address}</span>}
                    </div>
                  </div>
                  <button onClick={() => startEdit(loc)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(loc.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StockSettings;
