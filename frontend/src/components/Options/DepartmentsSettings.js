import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function DepartmentsSettings() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { loadDepartments(); }, []);

  const loadDepartments = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/departments');
      setDepartments(res.data.departments);
    } catch { setError('Failed to load departments.'); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      await api.post('/departments', { name: name.trim() });
      setName(''); loadDepartments();
    } catch (err) { setError(err.response?.data?.error || 'Failed to create department.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department?')) return;
    setError('');
    try { await api.delete(`/departments/${id}`); loadDepartments(); }
    catch { setError('Failed to delete department.'); }
  };

  const startEdit = (dept) => { setEditId(dept.id); setEditName(dept.name); };
  const cancelEdit = () => { setEditId(null); setEditName(''); };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setError('');
    try {
      await api.put(`/departments/${id}`, { name: editName.trim() });
      setEditId(null); loadDepartments();
    } catch (err) { setError(err.response?.data?.error || 'Failed to update department.'); }
  };

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border-2)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-3)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Departments</div>
          <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 1 }}>Organize employees by team or division</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', background: 'var(--surface-3)', borderRadius: 20, padding: '3px 10px' }}>
          {departments.length} {departments.length === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-3)', display: 'flex', gap: 10, background: 'var(--surface)' }}>
        <input
          type="text"
          placeholder="Department name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = '#7c3aed'}
          onBlur={e => e.target.style.borderColor = 'var(--border-2)'}
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          style={{ padding: '9px 18px', background: saving || !name.trim() ? '#e2e8f0' : '#16a34a', color: saving || !name.trim() ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        >
          {saving ? 'Adding…' : '+ Add Department'}
        </button>
      </form>

      {error && <div style={{ margin: '12px 24px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13 }}>{error}</div>}

      {/* List */}
      {loading ? (
        <div style={{ padding: '32px 24px', color: 'var(--text-4)', fontSize: 13 }}>Loading…</div>
      ) : departments.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-4)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>No departments yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add your first department above.</div>
        </div>
      ) : (
        <div>
          {departments.map((dept, i) => (
            <div key={dept.id} style={{ padding: '12px 24px', borderBottom: i < departments.length - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
              onMouseEnter={e => { if (editId !== dept.id) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
            >
              {editId === dept.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdate(dept.id); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #7c3aed', borderRadius: 7, fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={() => handleUpdate(dept.id)} style={{ padding: '7px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Save</button>
                  <button onClick={cancelEdit} style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
                    </svg>
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{dept.name}</span>
                  <button onClick={() => startEdit(dept)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#7c3aed'} onMouseLeave={e => e.currentTarget.style.color = 'var(--border)'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => handleDelete(dept.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
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

export default DepartmentsSettings;
