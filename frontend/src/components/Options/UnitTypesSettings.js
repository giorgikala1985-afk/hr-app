import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

function UnitTypesSettings() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [unitTypes, setUnitTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState('deduction');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDirection, setEditDirection] = useState('deduction');

  useEffect(() => { loadUnitTypes(); }, []);

  const loadUnitTypes = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/units');
      setUnitTypes(res.data.unit_types);
    } catch { setError(t('ut.loadFailed')); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await api.post('/units', { name: name.trim(), direction });
      setName(''); setDirection('deduction'); loadUnitTypes();
    } catch (err) { setError(err.response?.data?.error || t('ut.createFailed')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('ut.deleteConfirm'))) return;
    setError('');
    try { await api.delete(`/units/${id}`); loadUnitTypes(); }
    catch { setError(t('ut.deleteFailed')); }
  };

  const startEdit = (ut) => { setEditId(ut.id); setEditName(ut.name); setEditDirection(ut.direction); };
  const cancelEdit = () => { setEditId(null); setEditName(''); setEditDirection('deduction'); };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setError('');
    try {
      await api.put(`/units/${id}`, { name: editName.trim(), direction: editDirection });
      setEditId(null); loadUnitTypes();
    } catch (err) { setError(err.response?.data?.error || t('ut.updateFailed')); }
  };

  const DirToggle = ({ value, onChange }) => (
    <div style={{ display: 'flex', background: 'var(--surface-3)', borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 }}>
      {[{ key: 'deduction', label: '− Deduct', color: '#dc2626', bg: '#fef2f2', inactivecolor: 'var(--text-4)' }, { key: 'addition', label: '+ Add', color: '#16a34a', bg: '#f0fdf4', inactiveColor: '#86efac' }].map(opt => (
        <button key={opt.key} type="button" onClick={() => onChange(opt.key)} style={{
          padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          background: value === opt.key ? opt.bg : 'transparent',
          color: value === opt.key ? opt.color : opt.inactiveColor,
          boxShadow: value === opt.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}>{opt.label}</button>
      ))}
    </div>
  );

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-3)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{t('ut.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>{t('ut.desc')}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', background: 'var(--surface-3)', borderRadius: 20, padding: '3px 10px' }}>
          {unitTypes.length} {unitTypes.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-3)', display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={t('ut.placeholder')}
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '9px 12px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#ea580c'}
          onBlur={e => e.target.style.borderColor = 'var(--border-2)'}
        />
        <DirToggle value={direction} onChange={setDirection} />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          style={{ padding: '9px 18px', background: saving || !name.trim() ? '#e2e8f0' : '#16a34a', color: saving || !name.trim() ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        >
          {saving ? t('ut.adding') : `+ ${t('ut.add')}`}
        </button>
      </form>

      {error && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>}

      {/* List */}
      {loading ? (
        <div style={{ padding: '32px 24px', color: 'var(--text-4)', fontSize: 13 }}>Loading…</div>
      ) : unitTypes.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⊞</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>No unit types yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add your first unit type above.</div>
        </div>
      ) : (
        <div>
          {unitTypes.map((ut, i) => (
            <div key={ut.id} style={{ padding: '12px 24px', borderBottom: i < unitTypes.length - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (editId !== ut.id) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
            >
              {editId === ut.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdate(ut.id); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #ea580c', borderRadius: 7, fontSize: 13, outline: 'none' }}
                  />
                  <DirToggle value={editDirection} onChange={setEditDirection} />
                  <button onClick={() => handleUpdate(ut.id)} style={{ padding: '7px 14px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{t('ut.save')}</button>
                  <button onClick={cancelEdit} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>{t('ut.cancel')}</button>
                </>
              ) : (
                <>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: ut.direction === 'addition' ? (theme === 'dark' ? 'rgba(22,163,74,0.18)' : '#f0fdf4') : (theme === 'dark' ? 'rgba(220,38,38,0.18)' : '#fef2f2'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 14, color: ut.direction === 'addition' ? (theme === 'dark' ? '#4ade80' : '#16a34a') : (theme === 'dark' ? '#f87171' : '#dc2626') }}>
                    {ut.direction === 'addition' ? '+' : '−'}
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{ut.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: ut.direction === 'addition' ? (theme === 'dark' ? 'rgba(22,163,74,0.18)' : '#f0fdf4') : (theme === 'dark' ? 'rgba(220,38,38,0.18)' : '#fef2f2'), color: ut.direction === 'addition' ? (theme === 'dark' ? '#4ade80' : '#16a34a') : (theme === 'dark' ? '#f87171' : '#dc2626'), border: `1px solid ${ut.direction === 'addition' ? (theme === 'dark' ? 'rgba(74,222,128,0.35)' : '#bbf7d0') : (theme === 'dark' ? 'rgba(248,113,113,0.35)' : '#fca5a5')}` }}>
                    {ut.direction === 'addition' ? 'Addition' : 'Deduction'}
                  </span>
                  <button onClick={() => startEdit(ut)} title={t('ut.edit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ea580c'} onMouseLeave={e => e.currentTarget.style.color = 'var(--border)'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(ut.id)} title={t('ut.delete')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--border)'}>
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

export default UnitTypesSettings;
