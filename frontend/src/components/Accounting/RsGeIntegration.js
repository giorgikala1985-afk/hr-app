import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const fmt = (n) =>
  n != null ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '';

const SUB_TABS = [
  { key: 'employees', label: 'Employee Registration' },
  { key: 'declarations', label: 'Tax Declarations' },
  { key: 'waybills', label: 'Waybills' },
  { key: 'einvoices', label: 'E-Invoices' },
];

function RsGeIntegration() {
  const [activeTab, setActiveTab] = useState('employees');
  const [configured, setConfigured] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);

  // Check if RS.ge credentials are configured
  useEffect(() => {
    api.get('/rsge/status')
      .then(res => setConfigured(res.data.configured))
      .catch(() => setConfigured(false));
  }, []);

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await api.get('/rsge/test-connection');
      setConnectionStatus(res.data.success ? 'connected' : 'failed');
    } catch {
      setConnectionStatus('failed');
    }
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>RS.ge</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-3)', fontSize: 14 }}>Revenue Service of Georgia — employee registration, tax declarations, waybills, e-invoices</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {configured === true && (
            <>
              <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Credentials configured</span>
              <button onClick={testConnection} disabled={connectionStatus === 'testing'}
                style={{ fontSize: 12, padding: '4px 12px', border: '1px solid var(--border-2)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-3)', cursor: 'pointer' }}>
                {connectionStatus === 'testing' ? 'Testing...' : connectionStatus === 'connected' ? 'Connected' : 'Test Connection'}
              </button>
            </>
          )}
          {configured === false && (
            <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>RS.ge credentials not configured in .env</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border-2)', paddingBottom: 0 }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none',
              color: activeTab === tab.key ? '#3b82f6' : 'var(--text-3)',
              fontWeight: activeTab === tab.key ? 700 : 500, fontSize: 14, cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'employees' && <EmployeeRegistration />}
      {activeTab === 'declarations' && <TaxDeclarations />}
      {activeTab === 'waybills' && <Waybills />}
      {activeTab === 'einvoices' && <EInvoices />}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// EMPLOYEE REGISTRATION
// ══════════════════════════════════════════════════════
function EmployeeRegistration() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  // Deregister modal
  const [deregEmp, setDeregEmp] = useState(null);
  const [deregDate, setDeregDate] = useState('');
  const [deregReason, setDeregReason] = useState('');
  const [deregProcessing, setDeregProcessing] = useState(false);

  useEffect(() => { loadEmployees(); loadHistory(); }, []);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees');
      setEmployees((res.data.employees || res.data || []).filter(e => e.personal_id));
    } catch (err) {
      setError('Failed to load employees');
    } finally { setLoading(false); }
  };

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res = await api.get('/rsge/employees/history');
      setHistory(res.data.records || []);
    } catch {} finally { setHistLoading(false); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkRegister = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Register ${selected.size} employee(s) with RS.ge?`)) return;
    setProcessing(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/rsge/employees/register-bulk', { employeeIds: [...selected] });
      setSuccess(`Registered: ${res.data.registered}, Failed: ${res.data.failed}`);
      if (res.data.errors?.length) {
        setError(res.data.errors.map(e => `${e.employee}: ${e.error}`).join('; '));
      }
      loadHistory();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register');
    } finally { setProcessing(false); }
  };

  const handleDeregister = async () => {
    if (!deregEmp) return;
    setDeregProcessing(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/rsge/employees/deregister', {
        employeeId: deregEmp.id,
        endDate: deregDate || new Date().toISOString().split('T')[0],
        reason: deregReason || 'Contract ended',
      });
      setSuccess(res.data.message);
      setDeregEmp(null);
      loadHistory();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deregister');
    } finally { setDeregProcessing(false); }
  };

  // Check which employees are already registered
  const registeredIds = new Set(history.filter(h => h.action === 'register' && h.status === 'registered').map(h => h.employee_id));

  return (
    <div>
      {error && <div style={errBox}>{error}</div>}
      {success && <div style={successBox}>{success}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Employees</h3>
        <button onClick={handleBulkRegister} disabled={processing || selected.size === 0}
          style={{ ...primaryBtn, opacity: (processing || selected.size === 0) ? 0.6 : 1 }}>
          {processing ? 'Registering...' : `Register ${selected.size} with RS.ge`}
        </button>
      </div>

      {loading ? <div style={{ color: 'var(--text-3)' }}>Loading...</div> : employees.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No employees with personal IDs found.</div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={tableStyle}>
            <thead>
              <tr style={headRow}>
                <th style={{ ...th, width: 40 }}>
                  <input type="checkbox"
                    checked={selected.size === employees.length && employees.length > 0}
                    onChange={() => {
                      if (selected.size === employees.length) setSelected(new Set());
                      else setSelected(new Set(employees.map(e => e.id)));
                    }}
                  />
                </th>
                <th style={th}>Employee</th>
                <th style={th}>Personal ID (TIN)</th>
                <th style={th}>Position</th>
                <th style={th}>Start Date</th>
                <th style={th}>RS.ge Status</th>
                <th style={{ ...th, width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => {
                const isRegistered = registeredIds.has(emp.id);
                return (
                  <tr key={emp.id} style={{ ...bodyRow, background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <td style={td}><input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelect(emp.id)} /></td>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{emp.first_name} {emp.last_name}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{emp.personal_id}</td>
                    <td style={{ ...td, color: 'var(--text-2)' }}>{emp.position || '-'}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>{emp.start_date}</td>
                    <td style={td}>
                      {isRegistered
                        ? <span style={badgeGreen}>Registered</span>
                        : <span style={badgeYellow}>Not registered</span>
                      }
                    </td>
                    <td style={td}>
                      {isRegistered && (
                        <button onClick={() => { setDeregEmp(emp); setDeregDate(emp.end_date || ''); setDeregReason(''); }}
                          style={{ ...dangerBtn, fontSize: 11, padding: '4px 10px' }}>
                          Deregister
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Registration History */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Registration History</h3>
      {histLoading ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading...</div> : history.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No registration history yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr style={headRow}>
              <th style={th}>Employee</th><th style={th}>Action</th><th style={th}>Date</th><th style={th}>Status</th>
            </tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={h.id} style={{ ...bodyRow, background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{h.personal_id}</td>
                  <td style={td}>{h.action === 'register' ? 'Register' : 'Deregister'}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>{h.action_date}</td>
                  <td style={td}>
                    {h.status === 'registered' ? <span style={badgeGreen}>Registered</span>
                      : h.status === 'deregistered' ? <span style={badgeRed}>Deregistered</span>
                      : <span style={badgeYellow}>{h.status}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deregister Modal */}
      {deregEmp && (
        <div style={overlay} onClick={() => setDeregEmp(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Deregister: {deregEmp.first_name} {deregEmp.last_name}
            </h3>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>End Date *</label>
              <input type="date" value={deregDate} onChange={e => setDeregDate(e.target.value)} style={inpStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Reason</label>
              <input value={deregReason} onChange={e => setDeregReason(e.target.value)} placeholder="Contract ended" style={inpStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setDeregEmp(null)} style={cancelBtn}>Cancel</button>
              <button onClick={handleDeregister} disabled={deregProcessing} style={{ ...dangerBtn, opacity: deregProcessing ? 0.6 : 1 }}>
                {deregProcessing ? 'Processing...' : 'Deregister from RS.ge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// TAX DECLARATIONS
// ══════════════════════════════════════════════════════
function TaxDeclarations() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  // Portal login state
  const [portalStatus, setPortalStatus] = useState('not_connected'); // not_connected, logging_in, needs_2fa, logged_in
  const [portalUser, setPortalUser] = useState('');
  const [portalPass, setPortalPass] = useState('');
  const [portalCode, setPortalCode] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await api.get('/rsge/declarations');
      setHistory(res.data.records || []);
    } catch {} finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Check portal status on mount
  useEffect(() => {
    api.get('/rsge/portal/status')
      .then(res => setPortalStatus(res.data.status))
      .catch(() => {});
  }, []);

  const handlePortalLogin = async () => {
    if (!portalUser || !portalPass) { setPortalError('Enter your RS.ge portal username and password'); return; }
    setPortalLoading(true); setPortalError('');
    try {
      const res = await api.post('/rsge/portal/login', { username: portalUser, password: portalPass });
      setPortalStatus(res.data.status);
      if (res.data.status === 'logged_in') setPortalPass('');
    } catch (err) {
      setPortalError(err.response?.data?.error || 'Login failed');
    } finally { setPortalLoading(false); }
  };

  const handleVerify2FA = async () => {
    if (!portalCode) { setPortalError('Enter the SMS code'); return; }
    setPortalLoading(true); setPortalError('');
    try {
      const res = await api.post('/rsge/portal/verify-2fa', { code: portalCode });
      setPortalStatus(res.data.status);
      setPortalCode('');
      setPortalPass('');
    } catch (err) {
      setPortalError(err.response?.data?.error || 'Verification failed');
    } finally { setPortalLoading(false); }
  };

  const handleDisconnect = async () => {
    await api.post('/rsge/portal/disconnect');
    setPortalStatus('not_connected');
    setPortalUser(''); setPortalPass('');
  };

  // Save declaration locally
  const handleSaveLocal = async () => {
    if (!month) { setError('Select a month'); return; }
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/rsge/declarations/salary', { month });
      setSuccess(res.data.message);
      loadHistory();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save declaration');
    } finally { setSubmitting(false); }
  };

  // Submit declaration via portal automation
  const handlePortalSubmit = async () => {
    if (!month) { setError('Select a month'); return; }
    if (!window.confirm(`Submit salary tax declaration for ${month} to RS.ge portal?`)) return;
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/rsge/portal/submit-declaration', { month });
      setSuccess(res.data.message || 'Declaration submitted to RS.ge portal');
      loadHistory();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit declaration');
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      {error && <div style={errBox}>{error}</div>}
      {success && <div style={successBox}>{success}</div>}

      {/* Portal Connection */}
      <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border-2)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: portalStatus === 'logged_in' ? 0 : 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: portalStatus === 'logged_in' ? '#4ade80' : portalStatus === 'needs_2fa' ? '#fbbf24' : '#6b7280',
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              RS.ge Portal: {portalStatus === 'logged_in' ? 'Connected' : portalStatus === 'needs_2fa' ? 'Awaiting SMS Code' : 'Not Connected'}
            </span>
          </div>
          {portalStatus === 'logged_in' && (
            <button onClick={handleDisconnect} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid var(--border-2)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-3)', cursor: 'pointer' }}>
              Disconnect
            </button>
          )}
        </div>

        {portalError && <div style={{ ...errBox, marginBottom: 10, fontSize: 13 }}>{portalError}</div>}

        {portalStatus === 'not_connected' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...lbl, fontSize: 11 }}>Portal Username</label>
              <input value={portalUser} onChange={e => setPortalUser(e.target.value)} placeholder="eservices.rs.ge username" style={{ ...inpStyle, fontSize: 13 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...lbl, fontSize: 11 }}>Portal Password</label>
              <input type="password" value={portalPass} onChange={e => setPortalPass(e.target.value)} placeholder="Password"
                style={{ ...inpStyle, fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && handlePortalLogin()} />
            </div>
            <button onClick={handlePortalLogin} disabled={portalLoading}
              style={{ ...primaryBtn, fontSize: 13, padding: '8px 16px', whiteSpace: 'nowrap', opacity: portalLoading ? 0.6 : 1 }}>
              {portalLoading ? 'Connecting...' : 'Connect to RS.ge'}
            </button>
          </div>
        )}

        {portalStatus === 'needs_2fa' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...lbl, fontSize: 11 }}>SMS Verification Code</label>
              <input value={portalCode} onChange={e => setPortalCode(e.target.value)} placeholder="Enter code from SMS"
                style={{ ...inpStyle, fontSize: 13, textAlign: 'center', letterSpacing: 3, fontFamily: 'monospace' }}
                onKeyDown={e => e.key === 'Enter' && handleVerify2FA()} autoFocus />
            </div>
            <button onClick={handleVerify2FA} disabled={portalLoading}
              style={{ ...primaryBtn, fontSize: 13, padding: '8px 16px', opacity: portalLoading ? 0.6 : 1 }}>
              {portalLoading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        )}
      </div>

      {/* Declaration Actions */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24 }}>
        <div>
          <label style={lbl}>Period (Month)</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inpStyle, width: 180 }} />
        </div>
        <button onClick={handleSaveLocal} disabled={submitting} style={{ ...cancelBtn, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Saving...' : 'Save Locally'}
        </button>
        <button onClick={handlePortalSubmit} disabled={submitting || portalStatus !== 'logged_in'}
          style={{ ...primaryBtn, opacity: (submitting || portalStatus !== 'logged_in') ? 0.5 : 1 }}
          title={portalStatus !== 'logged_in' ? 'Connect to RS.ge portal first' : ''}>
          {submitting ? 'Submitting...' : 'Export to RS.ge'}
        </button>
      </div>

      <div style={{ padding: 16, background: 'rgba(59,130,246,0.08)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)', marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
          <strong style={{ color: '#60a5fa' }}>Georgian Tax Rates Applied:</strong><br />
          Income Tax: 20% &middot; Pension Contribution: 2%<br />
          Declaration includes all employees with personal IDs and salaries.
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Declaration History</h3>
      {histLoading ? <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading...</div> : history.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>No declarations submitted yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr style={headRow}>
              <th style={th}>Period</th><th style={th}>Employees</th>
              <th style={{ ...th, textAlign: 'right' }}>Total Gross</th>
              <th style={{ ...th, textAlign: 'right' }}>Tax (20%)</th>
              <th style={{ ...th, textAlign: 'right' }}>Pension (2%)</th>
              <th style={th}>Status</th><th style={th}>Date</th>
            </tr></thead>
            <tbody>
              {history.map((d, i) => (
                <tr key={d.id} style={{ ...bodyRow, background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{d.period}</td>
                  <td style={td}>{d.employee_count}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(d.total_gross)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>{fmt(d.total_tax)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#fbbf24' }}>{fmt(d.total_pension)}</td>
                  <td style={td}>
                    {d.status === 'accepted' ? <span style={badgeGreen}>Accepted</span>
                      : d.status === 'rejected' ? <span style={badgeRed}>Rejected</span>
                      : d.status === 'submitted' ? <span style={badgeBlue}>Submitted</span>
                      : <span style={badgeYellow}>{d.status}</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--text-3)', fontSize: 12 }}>{new Date(d.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// WAYBILLS
// ══════════════════════════════════════════════════════
function Waybills() {
  const [waybills, setWaybills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [buyerTin, setBuyerTin] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [startAddr, setStartAddr] = useState('');
  const [endAddr, setEndAddr] = useState('');
  const [driverTin, setDriverTin] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [comment, setComment] = useState('');
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);

  const loadWaybills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/rsge/waybills');
      setWaybills(res.data.records || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadWaybills(); }, [loadWaybills]);

  const addItem = () => setItems(prev => [...prev, { name: '', quantity: 1, price: 0 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const resetForm = () => {
    setBuyerTin(''); setBuyerName(''); setStartAddr(''); setEndAddr('');
    setDriverTin(''); setDriverName(''); setVehiclePlate(''); setComment('');
    setItems([{ name: '', quantity: 1, price: 0 }]);
  };

  const handleCreate = async () => {
    if (!buyerTin || !buyerName || !startAddr || !endAddr) {
      setError('Buyer TIN, name, start and end addresses are required');
      return;
    }
    const validItems = items.filter(it => it.name.trim());
    if (validItems.length === 0) { setError('At least one item is required'); return; }

    setSaving(true); setError(''); setSuccess('');
    try {
      await api.post('/rsge/waybills', {
        buyerTin, buyerName, startAddress: startAddr, endAddress: endAddr,
        driverTin, driverName, vehiclePlate, comment,
        items: validItems.map(it => ({ name: it.name, quantity: parseFloat(it.quantity) || 1, price: parseFloat(it.price) || 0 })),
      });
      setSuccess('Waybill created');
      setShowForm(false);
      resetForm();
      loadWaybills();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create waybill');
    } finally { setSaving(false); }
  };

  const handleAction = async (id, action) => {
    const labels = { activate: 'Activate', close: 'Close', delete: 'Delete' };
    if (!window.confirm(`${labels[action]} this waybill?`)) return;
    setError(''); setSuccess('');
    try {
      if (action === 'delete') {
        await api.delete(`/rsge/waybills/${id}`);
      } else {
        await api.post(`/rsge/waybills/${id}/${action}`);
      }
      setSuccess(`Waybill ${action}d`);
      loadWaybills();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${action} waybill`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Waybills (ზედნადები)</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-add">+ New Waybill</button>
      </div>

      {error && <div style={errBox}>{error}</div>}
      {success && <div style={successBox}>{success}</div>}

      {loading ? <div style={{ color: 'var(--text-3)' }}>Loading...</div> : waybills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>No waybills yet</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr style={headRow}>
              <th style={th}>RS ID</th><th style={th}>Buyer</th><th style={th}>Route</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Items</th>
              <th style={th}>Status</th><th style={{ ...th, width: 160 }}></th>
            </tr></thead>
            <tbody>
              {waybills.map((wb, i) => (
                <tr key={wb.id} style={{ ...bodyRow, background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{wb.rs_waybill_id || '-'}</td>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{wb.buyer_name}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text-2)' }}>{wb.start_address} → {wb.end_address}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(wb.total_amount)}</td>
                  <td style={td}>{wb.item_count}</td>
                  <td style={td}>
                    {wb.status === 'active' ? <span style={badgeGreen}>Active</span>
                      : wb.status === 'closed' ? <span style={badgeBlue}>Closed</span>
                      : wb.status === 'deleted' ? <span style={badgeRed}>Deleted</span>
                      : <span style={badgeYellow}>Saved</span>}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {wb.status === 'saved' && (
                        <>
                          <button onClick={() => handleAction(wb.id, 'activate')} style={{ ...smallBtn, color: '#4ade80' }}>Activate</button>
                          <button onClick={() => handleAction(wb.id, 'delete')} style={{ ...smallBtn, color: '#f87171' }}>Delete</button>
                        </>
                      )}
                      {wb.status === 'active' && (
                        <button onClick={() => handleAction(wb.id, 'close')} style={{ ...smallBtn, color: '#60a5fa' }}>Close</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Waybill Modal */}
      {showForm && (
        <div style={overlay} onClick={() => setShowForm(false)}>
          <div style={{ ...modal, maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>New Waybill</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Buyer TIN *</label>
                <input value={buyerTin} onChange={e => setBuyerTin(e.target.value)} placeholder="000000000" style={inpStyle} />
              </div>
              <div>
                <label style={lbl}>Buyer Name *</label>
                <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Company LLC" style={inpStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Start Address *</label>
                <input value={startAddr} onChange={e => setStartAddr(e.target.value)} placeholder="Tbilisi, ..." style={inpStyle} />
              </div>
              <div>
                <label style={lbl}>End Address *</label>
                <input value={endAddr} onChange={e => setEndAddr(e.target.value)} placeholder="Batumi, ..." style={inpStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Driver TIN</label>
                <input value={driverTin} onChange={e => setDriverTin(e.target.value)} style={inpStyle} />
              </div>
              <div>
                <label style={lbl}>Driver Name</label>
                <input value={driverName} onChange={e => setDriverName(e.target.value)} style={inpStyle} />
              </div>
              <div>
                <label style={lbl}>Vehicle Plate</label>
                <input value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} placeholder="AA-000-AA" style={inpStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Comment</label>
              <input value={comment} onChange={e => setComment(e.target.value)} style={inpStyle} />
            </div>

            {/* Items */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Items</label>
                <button onClick={addItem} style={{ ...smallBtn, color: '#60a5fa' }}>+ Add Item</button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                  <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name" style={inpStyle} />
                  <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" style={{ ...inpStyle, fontFamily: 'monospace' }} />
                  <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)} placeholder="Price" style={{ ...inpStyle, fontFamily: 'monospace' }} />
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} style={{ ...smallBtn, color: '#f87171', padding: '4px 8px' }}>X</button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Creating...' : 'Create Waybill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// E-INVOICES
// ══════════════════════════════════════════════════════
function EInvoices() {
  const [einvoices, setEinvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [buyerTin, setBuyerTin] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [einvComment, setEinvComment] = useState('');
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0, vatType: 1 }]);

  const loadEInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/rsge/einvoices');
      setEinvoices(res.data.records || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEInvoices(); }, [loadEInvoices]);

  const addItem = () => setItems(prev => [...prev, { name: '', quantity: 1, price: 0, vatType: 1 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const resetForm = () => {
    setBuyerTin(''); setBuyerName('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setEinvComment('');
    setItems([{ name: '', quantity: 1, price: 0, vatType: 1 }]);
  };

  const handleCreate = async () => {
    if (!buyerTin || !buyerName) { setError('Buyer TIN and name are required'); return; }
    const validItems = items.filter(it => it.name.trim());
    if (validItems.length === 0) { setError('At least one item is required'); return; }

    setSaving(true); setError(''); setSuccess('');
    try {
      await api.post('/rsge/einvoices', {
        buyerTin, buyerName, invoiceDate, comment: einvComment,
        items: validItems.map(it => ({
          name: it.name, quantity: parseFloat(it.quantity) || 1,
          price: parseFloat(it.price) || 0, vatType: parseInt(it.vatType) || 1,
        })),
      });
      setSuccess('E-Invoice created on RS.ge');
      setShowForm(false);
      resetForm();
      loadEInvoices();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create e-invoice');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this e-invoice?')) return;
    try {
      await api.delete(`/rsge/einvoices/${id}`);
      setSuccess('E-Invoice deleted');
      loadEInvoices();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const totalCalc = items.reduce((s, it) => {
    const amt = (parseFloat(it.quantity) || 0) * (parseFloat(it.price) || 0);
    const vat = parseInt(it.vatType) === 2 ? 0 : amt * 0.18;
    return { amount: s.amount + amt, vat: s.vat + vat };
  }, { amount: 0, vat: 0 });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>E-Invoices (ანგარიშ-ფაქტურა)</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-add">+ New E-Invoice</button>
      </div>

      {error && <div style={errBox}>{error}</div>}
      {success && <div style={successBox}>{success}</div>}

      {loading ? <div style={{ color: 'var(--text-3)' }}>Loading...</div> : einvoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>No e-invoices yet</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr style={headRow}>
              <th style={th}>RS ID</th><th style={th}>Buyer</th><th style={th}>Date</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={{ ...th, textAlign: 'right' }}>VAT</th>
              <th style={th}>Status</th><th style={{ ...th, width: 60 }}></th>
            </tr></thead>
            <tbody>
              {einvoices.map((inv, i) => (
                <tr key={inv.id} style={{ ...bodyRow, background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{inv.rs_invoice_id || '-'}</td>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{inv.buyer_name}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>{inv.invoice_date}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(inv.total_amount)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#fbbf24' }}>{fmt(inv.total_vat)}</td>
                  <td style={td}>
                    {inv.status === 'confirmed' ? <span style={badgeGreen}>Confirmed</span>
                      : inv.status === 'sent' ? <span style={badgeBlue}>Sent</span>
                      : <span style={badgeYellow}>{inv.status}</span>}
                  </td>
                  <td style={td}>
                    <button onClick={() => handleDelete(inv.id)} style={{ ...smallBtn, color: '#f87171' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create E-Invoice Modal */}
      {showForm && (
        <div style={overlay} onClick={() => setShowForm(false)}>
          <div style={{ ...modal, maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>New E-Invoice</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Buyer TIN *</label>
                <input value={buyerTin} onChange={e => setBuyerTin(e.target.value)} placeholder="000000000" style={inpStyle} />
              </div>
              <div>
                <label style={lbl}>Buyer Name *</label>
                <input value={buyerName} onChange={e => setBuyerName(e.target.value)} style={inpStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Invoice Date</label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inpStyle} />
              </div>
              <div>
                <label style={lbl}>Comment</label>
                <input value={einvComment} onChange={e => setEinvComment(e.target.value)} style={inpStyle} />
              </div>
            </div>

            {/* Items with VAT */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Items</label>
                <button onClick={addItem} style={{ ...smallBtn, color: '#60a5fa' }}>+ Add Item</button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 120px auto', gap: 8, marginBottom: 6 }}>
                  <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name" style={inpStyle} />
                  <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" style={{ ...inpStyle, fontFamily: 'monospace' }} />
                  <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)} placeholder="Price" style={{ ...inpStyle, fontFamily: 'monospace' }} />
                  <select value={item.vatType} onChange={e => updateItem(idx, 'vatType', e.target.value)} style={{ ...inpStyle, fontSize: 12 }}>
                    <option value={1}>18% VAT</option>
                    <option value={2}>VAT Exempt</option>
                    <option value={3}>0% VAT</option>
                  </select>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} style={{ ...smallBtn, color: '#f87171', padding: '4px 8px' }}>X</button>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)', fontFamily: 'monospace' }}>
                Subtotal: {fmt(totalCalc.amount)} &middot; VAT: {fmt(totalCalc.vat)} &middot; <strong>Total: {fmt(totalCalc.amount + totalCalc.vat)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Creating...' : 'Create E-Invoice on RS.ge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared styles ────────────────────────────────────
const th = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-3)', whiteSpace: 'nowrap' };
const td = { padding: '9px 14px', verticalAlign: 'middle' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 };
const inpStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border-2)', borderRadius: 7, fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface-2)', color: 'var(--text)' };
const errBox = { background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 };
const successBox = { background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 };
const primaryBtn = { padding: '8px 22px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const cancelBtn = { padding: '8px 18px', border: '1px solid var(--border-2)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 };
const dangerBtn = { padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const smallBtn = { background: 'none', border: '1px solid var(--border-2)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal = { background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-2)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const headRow = { background: 'var(--surface-2)', borderBottom: '2px solid var(--border-2)' };
const bodyRow = { borderBottom: '1px solid var(--border-2)' };
const badgeGreen = { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: '#4ade80', background: 'rgba(22,163,74,0.12)' };
const badgeYellow = { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: '#fbbf24', background: 'rgba(234,179,8,0.12)' };
const badgeRed = { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: '#f87171', background: 'rgba(220,38,38,0.12)' };
const badgeBlue = { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: '#60a5fa', background: 'rgba(59,130,246,0.12)' };

export default RsGeIntegration;
