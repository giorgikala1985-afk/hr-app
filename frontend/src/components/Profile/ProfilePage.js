import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon, Briefcase01Icon, Calendar03Icon, MoneyBag01Icon } from '@hugeicons/core-free-icons';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
const money = (a, c) => (a || a === 0) ? `${Number(a).toLocaleString()} ${c || 'GEL'}` : '—';

const SUB_STYLE = {
  active:   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'Active' },
  pending:  { bg: '#fffbeb', color: '#b45309', border: '#fde68a', label: 'Pending' },
  expired:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Expired' },
  failed:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Failed' },
  canceled: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: 'Canceled' },
};

function ProfilePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', company_name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/account')
      .then(r => {
        setData(r.data);
        const p = r.data.profile || {};
        setForm({
          first_name: p.first_name || '', last_name: p.last_name || '',
          company_name: p.company_name || '', phone: p.phone || '',
        });
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load account.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const r = await api.put('/account', form);
      setData(d => ({ ...d, profile: r.data.profile }));
      setMsg('Profile saved.');
    } catch (e) { setMsg(e.response?.data?.error || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-4)' }}>Loading…</div>;
  if (error) return <div style={{ maxWidth: 760, margin: '32px auto', padding: '0 24px', color: '#dc2626' }}>{error}</div>;

  const { profile, counts, subscription, is_owner } = data;
  const sub = subscription && subscription.status && subscription.status !== 'none' ? subscription : null;
  const ss = sub ? (SUB_STYLE[sub.status] || SUB_STYLE.pending) : null;
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '—';
  const initial = (profile.first_name || profile.company_name || profile.email || 'U').charAt(0).toUpperCase();

  const card = { background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '20px 24px' };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5, display: 'block' };
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' };
  const ro = { fontSize: 14, color: 'var(--text)', fontWeight: 500 };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 40px' }}>
      {/* Header card */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, flexShrink: 0 }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{profile.company_name || fullName}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{profile.email}</div>
        </div>
        {ss && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 6, background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
            {ss.label}{sub.plan ? ` · ${sub.plan}` : ''}
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { icon: UserGroupIcon, color: '#7c3aed', label: 'Team Members', value: counts.team_members },
          { icon: Briefcase01Icon, color: '#3b82f6', label: 'Employees', value: counts.employees },
          { icon: MoneyBag01Icon, color: '#16a34a', label: 'Plan', value: sub ? money(sub.amount, sub.currency) : 'Free' },
          { icon: Calendar03Icon, color: '#f59e0b', label: 'Registered', value: fmtDate(profile.created_at) },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.color + '18', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <HugeiconsIcon icon={s.icon} size={20} color={s.color} strokeWidth={1.8} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Account details */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Account Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>First Name</label>
            {is_owner ? <input style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} /> : <div style={ro}>{profile.first_name || '—'}</div>}
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            {is_owner ? <input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} /> : <div style={ro}>{profile.last_name || '—'}</div>}
          </div>
          <div>
            <label style={labelStyle}>Company Name</label>
            {is_owner ? <input style={inputStyle} value={form.company_name} onChange={e => set('company_name', e.target.value)} /> : <div style={ro}>{profile.company_name || '—'}</div>}
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            {is_owner ? <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+995 …" /> : <div style={ro}>{profile.phone || '—'}</div>}
          </div>
          <div>
            <label style={labelStyle}>Company ID</label>
            <div style={{ ...ro, fontFamily: 'var(--font-mono), monospace' }}>{profile.company_id || '—'}</div>
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <div style={ro}>{profile.email}</div>
          </div>
          <div>
            <label style={labelStyle}>Registered</label>
            <div style={ro}>{fmtDate(profile.created_at)}</div>
          </div>
          <div>
            <label style={labelStyle}>Last Login</label>
            <div style={ro}>{fmtDateTime(profile.last_sign_in_at)}</div>
          </div>
        </div>

        {is_owner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
            <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {msg && <span style={{ fontSize: 13, color: msg.includes('Fail') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
          </div>
        )}
      </div>

      {/* Subscription details */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Subscription</div>
        {!sub ? (
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>No active plan. You're on the free tier.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={labelStyle}>Status</label><div style={ro}>{ss.label}</div></div>
            <div><label style={labelStyle}>Plan</label><div style={ro}>{sub.plan || '—'}</div></div>
            <div><label style={labelStyle}>Price</label><div style={ro}>{money(sub.amount, sub.currency)}</div></div>
            <div><label style={labelStyle}>Renews / Expires</label><div style={ro}>{fmtDate(sub.current_period_end)}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
