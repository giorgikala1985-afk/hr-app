import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const RIGHTS_STYLE = {
  'Super Admin': { background: '#fdf4ff', color: '#7e22ce', border: '1px solid #e9d5ff' },
  'Admin':       { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  'Member':      { background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' },
};

const fmt = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const truncate = (str, n = 8) => str ? `${str.slice(0, n)}…` : '—';

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 28px', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: color || '#0f172a' }}>{value ?? '—'}</div>
    </div>
  );
}

function CompanyModal({ companyId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');

  useEffect(() => {
    api.get(`/admin/companies/${companyId}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {loading || !data ? (
            <div style={{ color: '#64748b' }}>Loading…</div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>{data.company.email}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Joined {fmt(data.company.created_at)} · Last login {fmtTime(data.company.last_sign_in_at)}
              </div>
            </div>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {!loading && data && (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, padding: '16px 28px', borderBottom: '1px solid #f1f5f9' }}>
              {[
                { label: 'Employees', value: data.employees.length, color: '#0f172a' },
                { label: 'Team Members', value: data.app_users.length, color: '#0f172a' },
                { label: 'Departments', value: data.departments.length, color: '#0f172a' },
                { label: 'Positions', value: data.positions.length, color: '#0f172a' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Inner tabs */}
            <div style={{ display: 'flex', gap: 4, padding: '0 28px', borderBottom: '1px solid #e2e8f0' }}>
              {[
                { key: 'employees', label: 'Employees' },
                { key: 'team', label: 'Team Members' },
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  padding: '10px 18px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  color: activeTab === t.key ? '#16a34a' : '#64748b',
                  borderBottom: activeTab === t.key ? '2px solid #16a34a' : '2px solid transparent',
                  marginBottom: -1,
                }}>{t.label}</button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px' }}>
              {activeTab === 'employees' && (
                data.employees.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontSize: 14 }}>No employees yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {['Name', 'Position', 'Department', 'Start Date'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.first_name} {e.last_name}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{e.position || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{e.department || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{fmt(e.start_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
              {activeTab === 'team' && (
                data.app_users.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontSize: 14 }}>No team members yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {['Name', 'Email', 'Phone', 'Role'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.app_users.map(u => {
                        const rs = RIGHTS_STYLE[u.rights] || RIGHTS_STYLE['Member'];
                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{u.name}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.email || '—'}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.phone || '—'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, ...rs }}>{u.rights || 'Member'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdminPage() {
  const [activeTab, setActiveTab] = useState('companies');
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, companiesRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/companies'),
      ]);
      setStats(statsRes.data);
      setCompanies(companiesRes.data.companies || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = companies.filter(c =>
    !search || c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Platform Admin</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Overview of all registered companies and users on Finpilot.</p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard label="Registered Companies" value={stats.total_companies} color="#16a34a" />
          <StatCard label="Total Employees" value={stats.total_employees} color="#2563eb" />
          <StatCard label="Total Team Members" value={stats.total_app_users} color="#7c3aed" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
        {[{ key: 'companies', label: 'Companies' }, { key: 'users', label: 'All Users' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '8px 20px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: activeTab === t.key ? '#16a34a' : '#64748b',
            borderBottom: activeTab === t.key ? '2px solid #16a34a' : '2px solid transparent',
            marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email…"
          style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: 280, outline: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px 0', fontSize: 15 }}>Loading…</div>
      ) : activeTab === 'companies' ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['#', 'Company', 'Owner', 'Joined', 'Last Login', 'Employees', 'Team', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No companies found.</td></tr>
              ) : filtered.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.company_name
                      ? <><div style={{ fontWeight: 700 }}>{c.company_name}</div>{c.company_id && <div style={{ fontSize: 11, color: '#94a3b8' }}>ID: {c.company_id}</div>}</>
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.first_name ? <div style={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</div> : null}
                    <div style={{ fontSize: 12, color: '#64748b' }}>{c.email}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(c.created_at)}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtTime(c.last_sign_in_at)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, color: c.employee_count > 0 ? '#0f172a' : '#cbd5e1' }}>{c.employee_count}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, color: c.team_member_count > 0 ? '#0f172a' : '#cbd5e1' }}>{c.team_member_count}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                      background: c.confirmed ? '#f0fdf4' : '#fff7ed',
                      color: c.confirmed ? '#16a34a' : '#ea580c',
                      border: `1px solid ${c.confirmed ? '#bbf7d0' : '#fed7aa'}` }}>
                      {c.confirmed ? 'Active' : 'Unconfirmed'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => setSelectedId(c.id)} style={{ padding: '5px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* All Users tab */
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['#', 'Email (Owner)', 'Account ID', 'Joined', 'Last Login', 'Employees', 'Status'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No users found.</td></tr>
              ) : filtered.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>{c.email}</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }} title={c.id}>{truncate(c.id)}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmt(c.created_at)}</td>
                  <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtTime(c.last_sign_in_at)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: c.employee_count > 0 ? '#0f172a' : '#cbd5e1' }}>{c.employee_count}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                      background: c.confirmed ? '#f0fdf4' : '#fff7ed',
                      color: c.confirmed ? '#16a34a' : '#ea580c',
                      border: `1px solid ${c.confirmed ? '#bbf7d0' : '#fed7aa'}` }}>
                      {c.confirmed ? 'Active' : 'Unconfirmed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && <CompanyModal companyId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

export default AdminPage;
