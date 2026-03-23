import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const RIGHTS = ['Super Admin', 'Admin', 'Member'];

const RIGHTS_STYLE = {
  'Super Admin': { background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff' },
  'Admin':       { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  'Member':      { background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' },
};

const ROLES_INFO = [
  {
    role: 'Super Admin',
    style: RIGHTS_STYLE['Super Admin'],
    description: 'Full access to all features including settings, billing, and user management.',
    permissions: ['Manage users & roles', 'Access all modules', 'Edit settings', 'View billing', 'Delete records'],
  },
  {
    role: 'Admin',
    style: RIGHTS_STYLE['Admin'],
    description: 'Can manage most features but cannot access billing or user management.',
    permissions: ['Access all modules', 'Edit records', 'Export data', 'View reports'],
  },
  {
    role: 'Member',
    style: RIGHTS_STYLE['Member'],
    description: 'Standard access with read and limited write permissions.',
    permissions: ['View records', 'Add basic entries', 'Export own data'],
  },
];

const EMPTY = { name: '', email: '', phone: '', rights: 'Member' };

function UsersSettings() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => { setForm(EMPTY); setEditId(null); setError(''); setShowForm(true); };
  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email || '', phone: u.phone || '', rights: u.rights || 'Member' });
    setEditId(u.id);
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) await api.put(`/users/${editId}`, form);
      else await api.post('/users', form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    setError('');
    try {
      await api.delete(`/users/${u.id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const truncateId = (id) => id ? `${id.slice(0, 8)}…` : '—';

  return (
    <div className="unit-types-settings">
      <h3>Users &amp; Roles</h3>
      <p className="pagination-desc">Manage team members and their access rights.</p>

      {/* Inner tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {['users', 'roles'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '7px 20px',
              border: 'none',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: activeTab === t ? 'var(--surface)' : 'transparent',
              color: activeTab === t ? 'var(--text)' : 'var(--text-3)',
              boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <>
          {error && <div className="msg-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn-add btn-sm" onClick={openNew}>+ Add User</button>
          </div>

          {loading ? (
            <div style={{ padding: '20px 0', color: 'var(--text-4)' }}>Loading…</div>
          ) : users.length === 0 ? (
            <div className="ut-empty">No users yet. Add one above.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Rights</th>
                    <th style={{ ...thStyle, width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const rs = RIGHTS_STYLE[u.rights] || RIGHTS_STYLE['Member'];
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-3)' }}>
                        <td style={tdStyle}><strong style={{ color: 'var(--text)' }}>{u.name}</strong></td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-4)' }} title={u.id}>{truncateId(u.id)}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-3)' }}>{u.email || '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-3)' }}>{u.phone || '—'}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, ...rs }}>
                            {u.rights || 'Member'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div className="action-btns">
                            <button className="btn-icon" onClick={() => openEdit(u)} title="Edit" style={{ color: '#3b82f6' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="btn-icon btn-delete" onClick={() => handleDelete(u)} title="Delete">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ROLES_INFO.map(({ role, style, description, permissions }) => (
            <div key={role} style={{ border: '1px solid var(--border-2)', borderRadius: 12, padding: '20px 24px', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, ...style }}>{role}</span>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{description}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {permissions.map((p) => (
                  <span key={p} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--surface-2)', color: 'var(--text-2)', borderRadius: 6, border: '1px solid var(--border-2)' }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit User' : 'New User'}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group full">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Smith" />
              </div>
              {editId && (
                <div className="acc-form-group full">
                  <label>ID</label>
                  <input value={editId} readOnly style={{ background: 'var(--surface-2)', color: 'var(--text-4)', fontFamily: 'monospace', fontSize: 12, cursor: 'default' }} />
                </div>
              )}
              <div className="acc-form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. john@example.com" />
              </div>
              <div className="acc-form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +995 555 000 000" />
              </div>
              <div className="acc-form-group full">
                <label>Rights</label>
                <select value={form.rights} onChange={(e) => setForm({ ...form, rights: e.target.value })}>
                  {RIGHTS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-3)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 14px',
  verticalAlign: 'middle',
};

export default UsersSettings;
