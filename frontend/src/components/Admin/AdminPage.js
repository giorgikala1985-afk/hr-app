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

const SUB_STATUS_STYLE = {
  active:   { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  pending:  { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' },
  expired:  { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  failed:   { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  canceled: { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' },
  none:     { background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' },
};

function SubBadge({ sub }) {
  const status = sub?.status || 'none';
  const st = SUB_STATUS_STYLE[status] || SUB_STATUS_STYLE.none;
  const label = status === 'none' ? 'No plan' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap', ...st }}>{label}</span>;
}

const money = (amt, cur) => (amt || amt === 0) ? `${Number(amt).toLocaleString()} ${cur || 'GEL'}` : '—';

function BillingTab({ companyId, subscription, onUpdated }) {
  const [form, setForm] = useState({
    amount: subscription.amount ?? '',
    currency: subscription.currency || 'GEL',
    plan: subscription.plan || '',
    auto_charge: !!subscription.auto_charge,
  });
  const [months, setMonths] = useState(1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [payLink, setPayLink] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const callSave = async (extra = {}, okMsg = 'Saved.') => {
    setSaving(true); setMsg(''); setPayLink('');
    try {
      const res = await api.put(`/admin/companies/${companyId}/billing`, { ...form, ...extra });
      onUpdated(res.data.subscription);
      setMsg(okMsg);
    } catch (e) { setMsg(e.response?.data?.error || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const genLink = async () => {
    setSaving(true); setMsg(''); setPayLink('');
    try {
      const res = await api.post(`/admin/companies/${companyId}/payment-link`, { amount: form.amount, currency: form.currency });
      setPayLink(res.data.url);
    } catch (e) { setMsg(e.response?.data?.error || 'Failed to create payment link.'); }
    finally { setSaving(false); }
  };

  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5, display: 'block' };
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' };
  const btn = (bg, color, border) => ({ padding: '8px 16px', border: border || 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: bg, color, opacity: saving ? 0.6 : 1 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Current status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 10 }}>
        <SubBadge sub={subscription} />
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
          <strong>{money(subscription.amount, subscription.currency)}</strong>
          {subscription.plan ? ` · ${subscription.plan}` : ''}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)' }}>
          {subscription.current_period_end ? `Renews / expires ${fmt(subscription.current_period_end)}` : 'No active period'}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Amount</label>
          <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="e.g. 49" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Currency</label>
          <select value={form.currency} onChange={e => set('currency', e.target.value)} style={inputStyle}>
            {['GEL', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Plan (optional)</label>
          <input value={form.plan} onChange={e => set('plan', e.target.value)} placeholder="e.g. Pro" style={inputStyle} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.auto_charge} onChange={e => set('auto_charge', e.target.checked)} />
        Auto-charge a saved card each period <span style={{ fontSize: 11, color: 'var(--text-4)' }}>(requires the company to save a card — Phase 2)</span>
      </label>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => callSave()} disabled={saving} style={btn('var(--surface-2)', 'var(--text)', '1px solid var(--border-2)')}>Save pricing</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="number" min={1} value={months} onChange={e => setMonths(e.target.value)} style={{ ...inputStyle, width: 56 }} />
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>mo</span>
          <button onClick={() => callSave({ extendMonths: months }, `Activated/extended by ${months} month(s).`)} disabled={saving} style={btn('#16a34a', '#fff')}>Activate / Extend</button>
        </div>
        <button onClick={genLink} disabled={saving} style={btn('#2563eb', '#fff')}>Generate payment link</button>
        {subscription.status === 'active' && (
          <button onClick={() => callSave({ status: 'canceled' }, 'Subscription canceled.')} disabled={saving} style={btn('transparent', '#dc2626', '1px solid #fecaca')}>Cancel</button>
        )}
      </div>

      {msg && <div style={{ fontSize: 13, color: msg.includes('Fail') ? '#dc2626' : '#16a34a' }}>{msg}</div>}

      {payLink && (
        <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border-2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>Payment link — send this to the company:</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={payLink} style={{ ...inputStyle, fontSize: 12 }} onFocus={e => e.target.select()} />
            <button onClick={() => navigator.clipboard?.writeText(payLink)} style={btn('var(--surface)', 'var(--text-2)', '1px solid var(--border-2)')}>Copy</button>
            <a href={payLink} target="_blank" rel="noreferrer" style={{ ...btn('#2563eb', '#fff'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Open</a>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '20px 28px', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: color || 'var(--text)' }}>{value ?? '—'}</div>
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
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--border-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {loading || !data ? (
            <div style={{ color: 'var(--text-3)' }}>Loading…</div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>{data.company.email}</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                Joined {fmt(data.company.created_at)} · Last login {fmtTime(data.company.last_sign_in_at)}
              </div>
            </div>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {!loading && data && (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, padding: '16px 28px', borderBottom: '1px solid var(--border-3)' }}>
              {[
                { label: 'Employees', value: data.employees.length, color: 'var(--text)' },
                { label: 'Team Members', value: data.app_users.length, color: 'var(--text)' },
                { label: 'Departments', value: data.departments.length, color: 'var(--text)' },
                { label: 'Positions', value: data.positions.length, color: 'var(--text)' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Inner tabs */}
            <div style={{ display: 'flex', padding: '12px 28px', borderBottom: '1px solid var(--border-2)' }}>
              <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4 }}>
                {[
                  { key: 'employees', label: 'Employees' },
                  { key: 'team', label: 'Team Members' },
                  { key: 'billing', label: 'Billing' },
                ].map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                    padding: '7px 18px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: activeTab === t.key ? 'var(--surface)' : 'transparent',
                    color: activeTab === t.key ? 'var(--text)' : 'var(--text-3)',
                    boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.15s',
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px' }}>
              {activeTab === 'employees' && (
                data.employees.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '32px 0', fontSize: 14 }}>No employees yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                        {['Name', 'Position', 'Department', 'Start Date'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid var(--border-3)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{e.first_name} {e.last_name}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-3)' }}>{e.position || '—'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-3)' }}>{e.department || '—'}</td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-3)' }}>{fmt(e.start_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
              {activeTab === 'team' && (
                data.app_users.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '32px 0', fontSize: 14 }}>No team members yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                        {['Name', 'Email', 'Phone', 'Role'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.app_users.map(u => {
                        const rs = RIGHTS_STYLE[u.rights] || RIGHTS_STYLE['Member'];
                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--border-3)' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{u.name}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-3)' }}>{u.email || '—'}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-3)' }}>{u.phone || '—'}</td>
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
              {activeTab === 'billing' && (
                <BillingTab
                  companyId={companyId}
                  subscription={data.subscription || { status: 'none', currency: 'GEL', auto_charge: false }}
                  onUpdated={(sub) => setData(d => ({ ...d, subscription: sub }))}
                />
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
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Platform Admin</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 14 }}>Overview of all registered companies and users on Finpilot.</p>
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
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {[{ key: 'companies', label: 'Companies' }, { key: 'users', label: 'All Users' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '7px 20px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
            background: activeTab === t.key ? 'var(--surface)' : 'transparent',
            color: activeTab === t.key ? 'var(--text)' : 'var(--text-3)',
            boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email…"
          style={{ padding: '8px 14px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 13, width: 280, outline: 'none', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '60px 0', fontSize: 15 }}>Loading…</div>
      ) : activeTab === 'companies' ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                {['#', 'Company', 'Owner', 'Joined', 'Last Login', 'Employees', 'Team', 'Billing', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '40px 0' }}>No companies found.</td></tr>
              ) : filtered.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-3)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '12px 14px', color: 'var(--text-4)', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.company_name
                      ? <><div style={{ fontWeight: 700, color: 'var(--text)' }}>{c.company_name}</div>{c.company_id && <div style={{ fontSize: 11, color: 'var(--text-4)' }}>ID: {c.company_id}</div>}</>
                      : <span style={{ color: 'var(--text-4)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {c.first_name ? <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.first_name} {c.last_name}</div> : null}
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.email}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmt(c.created_at)}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtTime(c.last_sign_in_at)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, color: c.employee_count > 0 ? 'var(--text)' : 'var(--text-4)' }}>{c.employee_count}</span>
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, color: c.team_member_count > 0 ? 'var(--text)' : 'var(--text-4)' }}>{c.team_member_count}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <SubBadge sub={c.subscription} />
                      {c.subscription?.amount != null && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{money(c.subscription.amount, c.subscription.currency)}</span>}
                    </div>
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
                    <button onClick={() => setSelectedId(c.id)} style={{ padding: '5px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' }}>
                {['#', 'Email (Owner)', 'Account ID', 'Joined', 'Last Login', 'Employees', 'Status'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '40px 0' }}>No users found.</td></tr>
              ) : filtered.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-3)' }}>
                  <td style={{ padding: '12px 14px', color: 'var(--text-4)', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{c.email}</td>
                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-4)' }} title={c.id}>{truncate(c.id)}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmt(c.created_at)}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtTime(c.last_sign_in_at)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: c.employee_count > 0 ? 'var(--text)' : 'var(--text-4)' }}>{c.employee_count}</td>
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
