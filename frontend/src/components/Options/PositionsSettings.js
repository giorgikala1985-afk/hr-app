import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

function PositionsSettings() {
  const { t } = useLanguage();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { loadPositions(); }, []);

  const loadPositions = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/positions');
      setPositions(res.data.positions);
    } catch { setError(t('pos.loadFailed')); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await api.post('/positions', { name: name.trim() });
      setName(''); loadPositions();
    } catch (err) { setError(err.response?.data?.error || t('pos.createFailed')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('pos.deleteConfirm'))) return;
    setError('');
    try { await api.delete(`/positions/${id}`); loadPositions(); }
    catch { setError(t('pos.deleteFailed')); }
  };

  const startEdit = (pos) => { setEditId(pos.id); setEditName(pos.name); };
  const cancelEdit = () => { setEditId(null); setEditName(''); };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setError('');
    try {
      await api.put(`/positions/${id}`, { name: editName.trim() });
      setEditId(null); loadPositions();
    } catch (err) { setError(err.response?.data?.error || t('pos.updateFailed')); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{t('pos.title')}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{t('pos.desc')}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#64748b', background: '#f1f5f9', borderRadius: 20, padding: '3px 10px' }}>
          {positions.length} {positions.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, background: '#fff' }}>
        <input
          type="text"
          placeholder={t('pos.placeholder')}
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
          onFocus={e => e.target.style.borderColor = '#3b82f6'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          style={{ padding: '9px 18px', background: saving || !name.trim() ? '#e2e8f0' : '#3b82f6', color: saving || !name.trim() ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        >
          {saving ? t('pos.adding') : `+ ${t('pos.add')}`}
        </button>
      </form>

      {error && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>}

      {/* List */}
      {loading ? (
        <div style={{ padding: '32px 24px', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : positions.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>No positions yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add your first position above.</div>
        </div>
      ) : (
        <div>
          {positions.map((pos, i) => (
            <div key={pos.id} style={{ padding: '12px 24px', borderBottom: i < positions.length - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (editId !== pos.id) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              {editId === pos.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdate(pos.id); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #3b82f6', borderRadius: 7, fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={() => handleUpdate(pos.id)} style={{ padding: '7px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{t('pos.save')}</button>
                  <button onClick={cancelEdit} style={{ padding: '7px 12px', background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>{t('pos.cancel')}</button>
                </>
              ) : (
                <>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{pos.name}</span>
                  <button onClick={() => startEdit(pos)} title={t('pos.edit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(pos.id)} title={t('pos.delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
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

export default PositionsSettings;
