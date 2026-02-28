import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

const EMPTY_FORM = {
  first_name: '', last_name: '', personal_id: '', birthdate: '',
  position: '', salary: '', start_date: '',
  end_date: '', account_number: '', tax_code: '', pension: false,
  department: '', currency: 'GEL', work_hours: '40',
  probation_months: '3', notes: '',
};

const EMPTY_AGR = {
  employee_id: '', employee_name: '', job_title: '', department: '',
  start_date: '', salary: '', currency: 'GEL', work_hours: '40',
  probation_months: '3', notes: '',
};

const EMPTY_BONUS = { employee_id: '', amount: '', reason: '', note: '', date: '' };

function HiringDocuments() {
  const [documents, setDocuments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Sign link result after creating employee + agreement
  const [signResult, setSignResult] = useState(null); // { url, empName }
  const [copiedNew, setCopiedNew] = useState(false);

  const [showAgrOnly, setShowAgrOnly] = useState(false);
  const [agrOnly, setAgrOnly] = useState(EMPTY_AGR);
  const [agrOnlySaving, setAgrOnlySaving] = useState(false);
  const [agrOnlyError, setAgrOnlyError] = useState('');
  const [agrSignResult, setAgrSignResult] = useState(null); // { url, empName }
  const [copiedAgr, setCopiedAgr] = useState(false);

  const [showBonus, setShowBonus] = useState(false);
  const [bonus, setBonus] = useState(EMPTY_BONUS);
  const [bonusSaving, setBonusSaving] = useState(false);
  const [bonusError, setBonusError] = useState('');
  const [bonuses, setBonuses] = useState([]);
  const [bonusSuccess, setBonusSuccess] = useState('');

  const [previewDoc, setPreviewDoc] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [listError, setListError] = useState('');
  const printRef = useRef();

  useEffect(() => { loadAll(); }, []);

  const loadAll = () => Promise.all([loadDocuments(), loadEmployees(), loadPositions(), loadDepartments(), loadTaxCodes(), loadBonuses()]);

  const loadDocuments = async () => {
    try { const res = await api.get('/documents'); setDocuments(res.data.documents || []); } catch { }
  };
  const loadEmployees = async () => {
    try { const res = await api.get('/employees'); setEmployees(res.data.employees || []); } catch { }
  };
  const loadPositions = async () => {
    try { const res = await api.get('/positions'); setPositions(res.data.positions || []); } catch { }
  };
  const loadDepartments = async () => {
    try { const res = await api.get('/departments'); setDepartments(res.data.departments || []); } catch { }
  };
  const loadTaxCodes = async () => {
    try { const res = await api.get('/tax-codes'); setTaxCodes(res.data.tax_codes || []); } catch { }
  };

  const loadBonuses = async () => {
    try { const res = await api.get('/bonuses'); setBonuses(res.data.bonuses || []); } catch { }
  };

  const handleBonusSubmit = async (e) => {
    e.preventDefault();
    setBonusError(''); setBonusSuccess('');
    if (!bonus.employee_id || !bonus.amount || !bonus.reason) {
      setBonusError('Employee, amount, and reason are required.'); return;
    }
    setBonusSaving(true);
    try {
      const emp = employees.find(em => em.id === bonus.employee_id);
      await api.post('/bonuses', {
        employee_id: bonus.employee_id,
        employee_name: emp ? `${emp.first_name} ${emp.last_name}` : '',
        amount: bonus.amount,
        reason: bonus.reason,
        note: bonus.note,
        date: bonus.date || null,
      });
      if (bonus.date) {
        try {
          await api.post(`/employees/${bonus.employee_id}/units`, {
            type: 'Bonus',
            amount: parseFloat(bonus.amount),
            date: bonus.date,
          });
        } catch {
          // units call failed silently — bonus is still saved
        }
      }
      setBonusSuccess(`Bonus of ${bonus.amount} added for ${emp ? `${emp.first_name} ${emp.last_name}` : 'employee'}.`);
      setBonus(EMPTY_BONUS);
      setShowBonus(false);
      await loadBonuses();
    } catch (err) {
      setBonusError(err.response?.data?.error || 'Failed to save bonus.');
    } finally {
      setBonusSaving(false);
    }
  };

  const handleBonusDelete = async (id) => {
    if (!window.confirm('Delete this bonus record?')) return;
    try { await api.delete(`/bonuses/${id}`); loadBonuses(); } catch { }
  };

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [field]: val }));
  };

  // ── Submit: create employee + document + get sign link ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (form.account_number && form.account_number.length !== 15) { setFormError('Account number must be exactly 15 characters.'); return; }

    setSaving(true);
    try {
      const empData = new FormData();
      ['first_name','last_name','personal_id','birthdate','position','salary',
       'start_date','end_date','account_number','tax_code','pension','department']
        .forEach(k => empData.append(k, form[k]));
      const empRes = await api.post('/employees', empData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const savedEmp = empRes.data.employee;

      const empName = `${form.first_name} ${form.last_name}`;
      const docRes = await api.post('/documents', {
        employee_id: savedEmp?.id || '',
        employee_name: empName,
        type: 'hiring',
        title: `Hiring Agreement – ${empName}`,
        content: {
          employee_name: empName, job_title: form.position, department: form.department,
          start_date: form.start_date, salary: form.salary, currency: form.currency,
          work_hours: form.work_hours, probation_months: form.probation_months, notes: form.notes,
        },
      });
      const docId = docRes.data.document?.id;
      const sendRes = await api.post(`/documents/${docId}/send`, {});
      const url = sendRes.data.sign_url;

      setSignResult({ url, empName });
      setCopiedNew(false);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Standalone agreement ──────────────────────────────
  const handleAgrEmployeeChange = (e) => {
    const emp = employees.find(em => em.id === e.target.value);
    setAgrOnly(p => ({
      ...p,
      employee_id: e.target.value,
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : '',
      job_title: emp ? emp.position : '',
      salary: emp ? String(emp.salary) : '',
    }));
  };

  const handleAgrOnlySave = async (getLink) => {
    if (!agrOnly.employee_id || !agrOnly.job_title || !agrOnly.start_date) {
      setAgrOnlyError('Employee, job title, and start date are required.'); return;
    }
    setAgrOnlySaving(true); setAgrOnlyError('');
    try {
      const docRes = await api.post('/documents', {
        employee_id: agrOnly.employee_id, employee_name: agrOnly.employee_name,
        type: 'hiring', title: `Hiring Agreement – ${agrOnly.employee_name}`,
        content: { ...agrOnly },
      });
      const docId = docRes.data.document?.id;
      if (getLink) {
        const sendRes = await api.post(`/documents/${docId}/send`, {});
        setAgrSignResult({ url: sendRes.data.sign_url, empName: agrOnly.employee_name });
        setCopiedAgr(false);
      }
      setShowAgrOnly(false); setAgrOnly(EMPTY_AGR);
      await loadDocuments();
    } catch (err) {
      setAgrOnlyError(err.response?.data?.error || 'Failed to save agreement.');
    } finally { setAgrOnlySaving(false); }
  };

  const handleSend = async (doc) => {
    try {
      await api.post(`/documents/${doc.id}/send`, {});
      loadDocuments();
    } catch { setListError('Failed to generate link.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try { await api.delete(`/documents/${id}`); loadDocuments(); if (previewDoc?.id === id) setPreviewDoc(null); }
    catch { setListError('Failed to delete.'); }
  };

  const copyLink = (url, id) => {
    navigator.clipboard.writeText(url); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Hiring Document</title><style>
      body{font-family:Georgia,serif;padding:60px;color:#1e293b;line-height:1.7}
      h1{text-align:center;color:#0f3460;font-size:22px;margin-bottom:4px}
      .doc-subtitle{text-align:center;color:#64748b;font-size:13px;margin-bottom:32px}
      .doc-section{margin-bottom:18px}
      .doc-section-title{font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#0f3460;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:10px}
      .doc-row{display:flex;gap:12px;font-size:14px;margin-bottom:4px}
      .doc-row strong{min-width:180px;color:#374151}
      .doc-signatures{display:flex;justify-content:space-between;margin-top:60px;gap:40px}
      .doc-sig-block{flex:1;text-align:center}
      .doc-sig-line{border-top:1px solid #374151;margin-bottom:6px}
      .doc-sig-label{font-size:12px;color:#64748b}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };

  const signUrl = (token) => `${window.location.origin}/sign/${token}`;
  const statusClass = (s) => `docs-status docs-status-${s}`;

  return (
    <>
      <h2>HR</h2>
      <p className="docs-content-subtitle">Add new employees and send them a hiring agreement to sign.</p>

      {/* ── Sign link result (new employee) ─────────── */}
      {signResult && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>
            </svg>
            <div>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: 15 }}>{signResult.empName} added successfully!</div>
              <div style={{ fontSize: 13, color: '#166534' }}>Copy the link below and share it with the employee to sign their agreement.</div>
            </div>
          </div>
          <div className="docs-link-row">
            <input className="docs-link-input" readOnly value={signResult.url} />
            <button className="btn-copy" onClick={() => { navigator.clipboard.writeText(signResult.url); setCopiedNew(true); setTimeout(() => setCopiedNew(false), 2000); }}>
              {copiedNew ? '✔ Copied' : 'Copy Link'}
            </button>
          </div>
          <button style={{ marginTop: 10, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setSignResult(null)}>Dismiss</button>
        </div>
      )}

      {/* ── Sign link result (existing employee agreement) ── */}
      {agrSignResult && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>
            </svg>
            <div>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: 15 }}>Agreement created for {agrSignResult.empName}</div>
              <div style={{ fontSize: 13, color: '#166534' }}>Copy the link below and share it with the employee to sign.</div>
            </div>
          </div>
          <div className="docs-link-row">
            <input className="docs-link-input" readOnly value={agrSignResult.url} />
            <button className="btn-copy" onClick={() => { navigator.clipboard.writeText(agrSignResult.url); setCopiedAgr(true); setTimeout(() => setCopiedAgr(false), 2000); }}>
              {copiedAgr ? '✔ Copied' : 'Copy Link'}
            </button>
          </div>
          <button style={{ marginTop: 10, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setAgrSignResult(null)}>Dismiss</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <button
          className={showForm ? 'btn-primary' : 'btn-secondary-outline'}
          style={showForm ? { boxShadow: '0 0 0 3px rgba(49,133,252,0.2)' } : {}}
          onClick={() => { setShowForm(f => !f); setShowAgrOnly(false); setShowBonus(false); setFormError(''); }}
        >
          + Add Employee &amp; Create Agreement
        </button>
        <button
          className={showAgrOnly ? 'btn-primary' : 'btn-secondary-outline'}
          style={showAgrOnly ? { boxShadow: '0 0 0 3px rgba(49,133,252,0.2)' } : {}}
          onClick={() => { setShowAgrOnly(f => !f); setShowForm(false); setShowBonus(false); setAgrOnlyError(''); }}
        >
          + Agreement for Existing Employee
        </button>
        <button
          className={showBonus ? 'btn-primary' : 'btn-secondary-outline'}
          style={showBonus ? { boxShadow: '0 0 0 3px rgba(49,133,252,0.2)' } : {}}
          onClick={() => { setShowBonus(f => !f); setShowForm(false); setShowAgrOnly(false); setBonusError(''); setBonusSuccess(''); }}
        >
          + Add Bonus
        </button>
      </div>

      {/* ── Merged form ───────────────────────────────── */}
      {showForm && (
        <div className="docs-form-panel" style={{ maxWidth: 760, borderColor: '#3185FC', borderTopWidth: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, color: '#3185FC' }}>New Employee + Hiring Agreement</h3>
          </div>
          {formError && <div className="msg-error" style={{ marginBottom: 14 }}>{formError}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 12 }}>Employee Information</div>
            <div className="docs-form-grid" style={{ marginBottom: 24 }}>
              <div className="docs-form-group"><label>First Name *</label><input value={form.first_name} onChange={set('first_name')} placeholder="John" required /></div>
              <div className="docs-form-group"><label>Last Name *</label><input value={form.last_name} onChange={set('last_name')} placeholder="Doe" required /></div>
              <div className="docs-form-group"><label>Personal ID *</label><input value={form.personal_id} onChange={set('personal_id')} placeholder="e.g. 01234567890" required /></div>
              <div className="docs-form-group"><label>Birthdate *</label><input type="date" value={form.birthdate} onChange={set('birthdate')} required /></div>
              <div className="docs-form-group">
                <label>Position *</label>
                {positions.length > 0 ? (
                  <select value={form.position} onChange={set('position')} required>
                    <option value="">— Select Position —</option>
                    {positions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                ) : <input value={form.position} onChange={set('position')} placeholder="e.g. Software Engineer" required />}
              </div>
              <div className="docs-form-group"><label>Salary *</label><input type="number" step="0.01" min="0" value={form.salary} onChange={set('salary')} placeholder="5000.00" required /></div>
              <div className="docs-form-group"><label>Start Date *</label><input type="date" value={form.start_date} onChange={set('start_date')} required /></div>
              <div className="docs-form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={set('end_date')} /></div>
              <div className="docs-form-group"><label>Account Number</label><input value={form.account_number} onChange={set('account_number')} placeholder="15 characters" maxLength={15} /></div>
              <div className="docs-form-group">
                <label>Tax Code</label>
                {taxCodes.length > 0 ? (
                  <select value={form.tax_code} onChange={set('tax_code')}>
                    <option value="">— Select —</option>
                    {taxCodes.map(tc => <option key={tc.id} value={tc.code}>{tc.code}</option>)}
                  </select>
                ) : <input value={form.tax_code} onChange={set('tax_code')} placeholder="Tax code" />}
              </div>
              <div className="docs-form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 2 }}>
                  <input type="checkbox" checked={form.pension} onChange={set('pension')} />Pension
                </label>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', margin: '4px 0 20px' }} />
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 12 }}>Agreement Details</div>

            <div className="docs-form-grid">
              <div className="docs-form-group">
                <label>Department</label>
                {departments.length > 0 ? (
                  <select value={form.department} onChange={set('department')}>
                    <option value="">— Select Department —</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                ) : <input value={form.department} onChange={set('department')} placeholder="e.g. Engineering" />}
              </div>
              <div className="docs-form-group"><label>Probation (months)</label><input type="number" min="0" value={form.probation_months} onChange={set('probation_months')} /></div>
              <div className="docs-form-group">
                <label>Currency</label>
                <select value={form.currency} onChange={set('currency')}>
                  <option value="GEL">GEL</option><option value="USD">USD</option><option value="EUR">EUR</option>
                </select>
              </div>
              <div className="docs-form-group"><label>Weekly Work Hours</label><input type="number" min="1" value={form.work_hours} onChange={set('work_hours')} /></div>
              <div className="docs-form-group full"><label>Additional Notes</label><textarea value={form.notes} onChange={set('notes')} placeholder="Any additional terms or notes…" /></div>
            </div>

            <div className="docs-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Add Employee & Get Sign Link'}
              </button>
              <button type="button" className="ut-cancel-btn" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(''); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Agreement for existing employee ──────────── */}
      {showAgrOnly && (
        <div className="docs-form-panel" style={{ maxWidth: 720, marginBottom: 28, borderColor: '#3185FC', borderTopWidth: 3 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 17, color: '#3185FC' }}>Hiring Agreement for Existing Employee</h3>
          {agrOnlyError && <div className="msg-error" style={{ marginBottom: 12 }}>{agrOnlyError}</div>}
          <div className="docs-form-grid">
            <div className="docs-form-group full">
              <label>Employee *</label>
              <select value={agrOnly.employee_id} onChange={handleAgrEmployeeChange}>
                <option value="">— Select Employee —</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
              </select>
            </div>
            <div className="docs-form-group"><label>Job Title *</label><input value={agrOnly.job_title} onChange={e => setAgrOnly(p => ({ ...p, job_title: e.target.value }))} placeholder="e.g. Software Engineer" /></div>
            <div className="docs-form-group">
              <label>Department</label>
              {departments.length > 0 ? (
                <select value={agrOnly.department} onChange={e => setAgrOnly(p => ({ ...p, department: e.target.value }))}>
                  <option value="">— Select Department —</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              ) : <input value={agrOnly.department} onChange={e => setAgrOnly(p => ({ ...p, department: e.target.value }))} placeholder="e.g. Engineering" />}
            </div>
            <div className="docs-form-group"><label>Start Date *</label><input type="date" value={agrOnly.start_date} onChange={e => setAgrOnly(p => ({ ...p, start_date: e.target.value }))} /></div>
            <div className="docs-form-group"><label>Probation (months)</label><input type="number" min="0" value={agrOnly.probation_months} onChange={e => setAgrOnly(p => ({ ...p, probation_months: e.target.value }))} /></div>
            <div className="docs-form-group"><label>Salary</label><input type="number" value={agrOnly.salary} onChange={e => setAgrOnly(p => ({ ...p, salary: e.target.value }))} placeholder="0.00" /></div>
            <div className="docs-form-group">
              <label>Currency</label>
              <select value={agrOnly.currency} onChange={e => setAgrOnly(p => ({ ...p, currency: e.target.value }))}>
                <option value="GEL">GEL</option><option value="USD">USD</option><option value="EUR">EUR</option>
              </select>
            </div>
            <div className="docs-form-group"><label>Weekly Work Hours</label><input type="number" min="1" value={agrOnly.work_hours} onChange={e => setAgrOnly(p => ({ ...p, work_hours: e.target.value }))} /></div>
            <div className="docs-form-group full"><label>Additional Notes</label><textarea value={agrOnly.notes} onChange={e => setAgrOnly(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional terms or notes…" /></div>
          </div>
          <div className="docs-form-actions">
            <button className="btn-primary" onClick={() => handleAgrOnlySave(true)} disabled={agrOnlySaving}>{agrOnlySaving ? 'Saving…' : 'Save & Get Sign Link'}</button>
            <button className="btn-secondary-outline" onClick={() => handleAgrOnlySave(false)} disabled={agrOnlySaving}>Save as Draft</button>
            <button className="ut-cancel-btn" onClick={() => { setShowAgrOnly(false); setAgrOnly(EMPTY_AGR); setAgrOnlyError(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {documents.length > 0 && <div style={{ borderTop: '1px solid #e2e8f0', margin: '8px 0 24px' }} />}

      {listError && <div className="msg-error" style={{ marginBottom: 12 }}>{listError}</div>}
      {documents.length > 0 && (
        <div className="docs-list">
          {documents.map((doc) => (
            <div key={doc.id} className="docs-card">
              <div className="docs-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div className="docs-card-info">
                <div className="docs-card-title">{doc.title}</div>
                <div className="docs-card-meta">
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  {doc.signed_at && <span>Signed: {new Date(doc.signed_at).toLocaleDateString()}</span>}
                  {doc.content?.start_date && <span>Start: {doc.content.start_date}</span>}
                </div>
                {doc.sign_token && (
                  <div style={{ marginTop: 6 }}>
                    <div className="docs-link-row">
                      <input className="docs-link-input" readOnly value={signUrl(doc.sign_token)} />
                      <button className="btn-copy" onClick={() => copyLink(signUrl(doc.sign_token), doc.id)}>{copiedId === doc.id ? '✔ Copied' : 'Copy'}</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="docs-card-actions">
                <span className={statusClass(doc.status)}>{doc.status}</span>
                <button className="btn-icon" title="Preview" onClick={() => setPreviewDoc(doc)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
                {doc.status === 'draft' && <button className="btn-primary btn-sm" onClick={() => handleSend(doc)}>Get Link</button>}
                <button className="btn-icon btn-delete" title="Delete" onClick={() => handleDelete(doc.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewDoc && (
        <div className="docs-preview-wrapper">
          <div className="docs-preview-toolbar">
            <h4>Document Preview</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary btn-sm" onClick={handlePrint}>Print / PDF</button>
              <button className="ut-cancel-btn" onClick={() => setPreviewDoc(null)}>Close</button>
            </div>
          </div>
          <div className="docs-preview-doc" ref={printRef}><DocPreview doc={previewDoc} /></div>
        </div>
      )}

      {/* ── Bonus divider ────────────────────────────── */}
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '32px 0 24px' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Bonuses</h3>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>Record and track employee bonuses.</p>
        </div>
      </div>

      {/* ── Bonus success ────────────────────────────── */}
      {bonusSuccess && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#15803d', fontWeight: 500 }}>
          {bonusSuccess}
          <button style={{ marginLeft: 12, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setBonusSuccess('')}>Dismiss</button>
        </div>
      )}

      {/* ── Bonus form ───────────────────────────────── */}
      {showBonus && (
        <div className="docs-form-panel" style={{ maxWidth: 600, marginBottom: 28, borderColor: '#3185FC', borderTopWidth: 3 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, color: '#3185FC' }}>Add Bonus</h3>
          {bonusError && <div className="msg-error" style={{ marginBottom: 12 }}>{bonusError}</div>}
          <form onSubmit={handleBonusSubmit}>
            <div className="docs-form-grid">
              <div className="docs-form-group full">
                <label>Employee *</label>
                <select value={bonus.employee_id} onChange={e => setBonus(p => ({ ...p, employee_id: e.target.value }))} required>
                  <option value="">— Select Employee —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
                </select>
              </div>
              <div className="docs-form-group">
                <label>Bonus Amount *</label>
                <input type="number" step="0.01" min="0" value={bonus.amount} onChange={e => setBonus(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 500.00" required />
              </div>
              <div className="docs-form-group">
                <label>Date</label>
                <input type="date" value={bonus.date} onChange={e => setBonus(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="docs-form-group">
                <label>Reason *</label>
                <input value={bonus.reason} onChange={e => setBonus(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Performance, Project completion…" required />
              </div>
              <div className="docs-form-group full">
                <label>Note</label>
                <textarea value={bonus.note} onChange={e => setBonus(p => ({ ...p, note: e.target.value }))} placeholder="Any additional details…" rows={3} />
              </div>
            </div>
            <div className="docs-form-actions">
              <button type="submit" className="btn-primary" disabled={bonusSaving}>{bonusSaving ? 'Saving…' : 'Save Bonus'}</button>
              <button type="button" className="ut-cancel-btn" onClick={() => { setShowBonus(false); setBonus(EMPTY_BONUS); setBonusError(''); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Bonus list ───────────────────────────────── */}
      {bonuses.length > 0 && (
        <div className="docs-list">
          {bonuses.map(b => (
            <div key={b.id} className="docs-card">
              <div className="docs-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </div>
              <div className="docs-card-info">
                <div className="docs-card-title">{b.employee_name}</div>
                <div className="docs-card-meta">
                  <span style={{ fontWeight: 700, color: '#15803d', fontSize: 15 }}>{Number(b.amount).toLocaleString()} ₾</span>
                  <span style={{ background: '#f1f5f9', borderRadius: 6, padding: '2px 8px', fontSize: 12, color: '#475569' }}>{b.reason}</span>
                  {b.date && <span style={{ color: '#64748b', fontSize: 12 }}>{b.date}</span>}
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(b.created_at).toLocaleDateString()}</span>
                </div>
                {b.note && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{b.note}</div>}
              </div>
              <div className="docs-card-actions">
                <button className="btn-icon btn-delete" title="Delete" onClick={() => handleBonusDelete(b.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DocPreview({ doc }) {
  const c = doc.content || {};
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <>
      <h1>EMPLOYMENT AGREEMENT</h1>
      <p className="doc-subtitle">This agreement is entered into on {today}</p>
      <div className="doc-section">
        <div className="doc-section-title">Parties</div>
        <div className="doc-row"><strong>Employer:</strong> <span>The Company</span></div>
        <div className="doc-row"><strong>Employee:</strong> <span>{doc.employee_name}</span></div>
      </div>
      <div className="doc-section">
        <div className="doc-section-title">Position & Terms</div>
        <div className="doc-row"><strong>Job Title:</strong> <span>{c.job_title}</span></div>
        {c.department && <div className="doc-row"><strong>Department:</strong> <span>{c.department}</span></div>}
        <div className="doc-row"><strong>Start Date:</strong> <span>{c.start_date}</span></div>
        <div className="doc-row"><strong>Weekly Hours:</strong> <span>{c.work_hours} hours</span></div>
        {c.probation_months > 0 && <div className="doc-row"><strong>Probation Period:</strong> <span>{c.probation_months} months</span></div>}
      </div>
      {c.salary && (
        <div className="doc-section">
          <div className="doc-section-title">Compensation</div>
          <div className="doc-row"><strong>Monthly Salary:</strong> <span>{Number(c.salary).toLocaleString()} {c.currency}</span></div>
        </div>
      )}
      <div className="doc-section">
        <div className="doc-section-title">General Terms</div>
        <p style={{ fontSize: 13, margin: 0 }}>The Employee agrees to perform their duties diligently and in accordance with the Company's policies. Either party may terminate this agreement with a notice period as required by applicable law. This agreement is governed by the laws of the applicable jurisdiction.</p>
        {c.notes && <p style={{ fontSize: 13, marginTop: 8 }}>{c.notes}</p>}
      </div>
      {doc.status === 'signed' && doc.signer_name && (
        <div className="doc-section">
          <div className="doc-section-title">Signature</div>
          <div className="doc-row"><strong>Signed by:</strong> <span>{doc.signer_name}</span></div>
          <div className="doc-row"><strong>Date:</strong> <span>{new Date(doc.signed_at).toLocaleDateString()}</span></div>
        </div>
      )}
      <div className="doc-signatures">
        <div className="doc-sig-block"><div className="doc-sig-line" /><div className="doc-sig-label">Employer Signature & Date</div></div>
        <div className="doc-sig-block"><div className="doc-sig-line" /><div className="doc-sig-label">Employee Signature & Date</div></div>
      </div>
    </>
  );
}

export default HiringDocuments;
