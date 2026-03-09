import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import SalaryChanges from './SalaryChanges';
import AccountChanges from './AccountChanges';
import Documents from './Documents';
import './Employees.css';
import { useLanguage } from '../../contexts/LanguageContext';

function EmployeeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef();

  const initialTab = isEdit ? (searchParams.get('tab') || 'info') : 'info';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [employee, setEmployee] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    personal_id: '',
    birthdate: '',
    position: '',
    department: '',
    salary: '',
    start_date: '',
    end_date: '',
    account_number: '',
    tax_code: '',
    pension: false,
    personal_email: ''
  });
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEdit);
  const [error, setError] = useState('');

  // Portal PIN management
  const [pinStatus, setPinStatus] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinMsg, setPinMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    loadPositions();
    loadDepartments();
    loadTaxCodes();
    if (isEdit) {
      loadEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPinStatus = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/employees/${id}/portal-pin-status`);
      setPinStatus(res.data);
    } catch { /* ignore */ }
  };

  const handleSetPin = async () => {
    if (!/^\d{4}$/.test(pinInput)) { setPinMsg({ type: 'error', text: 'PIN must be exactly 4 digits' }); return; }
    setPinLoading(true);
    setPinMsg({ type: '', text: '' });
    try {
      await api.post(`/employees/${id}/portal-pin`, { pin: pinInput });
      setPinInput('');
      setPinMsg({ type: 'success', text: 'PIN set successfully' });
      loadPinStatus();
    } catch (err) {
      setPinMsg({ type: 'error', text: err.response?.data?.error || 'Failed to set PIN' });
    } finally {
      setPinLoading(false);
    }
  };

  const loadPositions = async () => {
    try {
      const res = await api.get('/positions');
      setPositions(res.data.positions || []);
    } catch (err) {
      console.error('Failed to load positions:', err);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data.departments || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadTaxCodes = async () => {
    try {
      const res = await api.get('/tax-codes');
      setTaxCodes(res.data.tax_codes || []);
    } catch (err) {
      console.error('Failed to load tax codes:', err);
    }
  };

  const loadEmployee = async () => {
    try {
      const response = await api.get(`/employees/${id}`);
      const emp = response.data.employee;
      setEmployee(emp);
      setFormData({
        first_name: emp.first_name,
        last_name: emp.last_name,
        personal_id: emp.personal_id,
        birthdate: emp.birthdate,
        position: emp.position,
        department: emp.department || '',
        salary: emp.salary.toString(),
        start_date: emp.start_date || '',
        end_date: emp.end_date || '',
        account_number: emp.account_number || '',
        tax_code: emp.tax_code || '',
        pension: emp.pension || false,
        personal_email: emp.personal_email || ''
      });
      if (emp.photo_url) {
        setExistingPhotoUrl(emp.photo_url);
      }
    } catch (err) {
      setError(t('empForm.loadFailed') + (err.response?.data?.error || err.message));
    } finally {
      setPageLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError(t('empForm.photoSizeError'));
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.account_number && formData.account_number.length !== 15) {
      setError(t('empForm.accountError'));
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value);
      });
      if (photo) {
        data.append('photo', photo);
      }

      if (isEdit) {
        await api.put(`/employees/${id}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        navigate('/documents?tab=employees&inner=employees');
      } else {
        const res = await api.post('/employees', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const newId = res.data.employee?.id;
        if (newId) {
          navigate(`/employees/${newId}/edit`);
        } else {
          navigate('/documents?tab=employees&inner=employees');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return <div className="emp-loading">{t('empForm.loadingEmployee')}</div>;
  }

  const currentPhoto = photoPreview || existingPhotoUrl;
  const empName = employee ? `${employee.first_name} ${employee.last_name}` : 'New Employee';

  const tabs = [
    { key: 'info', label: isEdit ? t('empForm.tabEdit') : t('empForm.tabInfo'), icon: 'i' },
    { key: 'salary', label: t('empForm.tabSalary'), icon: '$', disabled: !isEdit },
    { key: 'account', label: t('empForm.tabAccount'), icon: '#', disabled: !isEdit },
    { key: 'documents', label: t('empForm.tabDocuments'), icon: 'D', disabled: !isEdit },
    { key: 'agreement', label: 'Agreement', icon: '📄', disabled: !isEdit },
    { key: 'portal', label: 'Portal Access', icon: '🔑', disabled: !isEdit },
  ];

  return (
    <div className="emp-container">
      <div className="emp-header">
        <div>
          <h1>{isEdit ? empName : t('empForm.addTitle')}</h1>
          <p>{isEdit ? t('empForm.editSubtitle') : t('empForm.addSubtitle')}</p>
        </div>
        <button onClick={() => navigate('/documents?tab=employees&inner=employees')} className="btn-secondary">
          {t('empForm.backToList')}
        </button>
      </div>

      {error && <div className="msg-error">{error}</div>}

      <div className="emp-edit-layout">
        {/* Sidebar Tabs */}
        <div className="emp-sidebar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`emp-tab-btn ${activeTab === tab.key ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              disabled={tab.disabled}
              title={tab.disabled ? t('empForm.saveFirst') : ''}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="emp-tab-content">
          {activeTab === 'info' && (
            <div className="form-card">
              <form onSubmit={handleSubmit}>
                {/* Photo Upload */}
                <div className="photo-upload-section">
                  <div className="photo-preview-area">
                    {currentPhoto ? (
                      <img src={currentPhoto} alt="Employee" className="photo-preview-img" />
                    ) : (
                      <div className="photo-placeholder">👤</div>
                    )}
                  </div>
                  <div className="photo-controls">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      id="photoInput"
                      hidden
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => fileInputRef.current.click()}
                    >
                      {currentPhoto ? t('empForm.changePhoto') : t('empForm.uploadPhoto')}
                    </button>
                    {photoPreview && (
                      <button type="button" className="btn-danger btn-sm" onClick={removePhoto}>
                        {t('empForm.removePhoto')}
                      </button>
                    )}
                    <span className="photo-hint">{t('empForm.photoHint')}</span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="first_name">{t('empForm.firstName')}</label>
                    <input id="first_name" name="first_name" type="text" value={formData.first_name} onChange={handleChange} placeholder="John" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="last_name">{t('empForm.lastName')}</label>
                    <input id="last_name" name="last_name" type="text" value={formData.last_name} onChange={handleChange} placeholder="Doe" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="personal_id">{t('empForm.personalId')}</label>
                    <input id="personal_id" name="personal_id" type="text" value={formData.personal_id} onChange={handleChange} placeholder="e.g. 01234567890" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="birthdate">{t('empForm.birthdate')}</label>
                    <input id="birthdate" name="birthdate" type="date" value={formData.birthdate} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="position">{t('empForm.position')}</label>
                    {positions.length > 0 ? (
                      <select id="position" name="position" value={formData.position} onChange={handleChange} required>
                        <option value="">{t('empForm.selectPosition')}</option>
                        {positions.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input id="position" name="position" type="text" value={formData.position} onChange={handleChange} placeholder="e.g. Software Engineer" required />
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="department">Department</label>
                    {departments.length > 0 ? (
                      <select id="department" name="department" value={formData.department} onChange={handleChange}>
                        <option value="">Select department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input id="department" name="department" type="text" value={formData.department} onChange={handleChange} placeholder="e.g. Engineering" />
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="salary">{t('empForm.salary')}</label>
                    <input id="salary" name="salary" type="number" step="0.01" min="0" value={formData.salary} onChange={handleChange} placeholder="e.g. 5000.00" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="start_date">{t('empForm.startDate')}</label>
                    <input id="start_date" name="start_date" type="date" value={formData.start_date} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="end_date">{t('empForm.endDate')}</label>
                    <input id="end_date" name="end_date" type="date" value={formData.end_date} onChange={handleChange} />
                    <span className="photo-hint">{t('empForm.endDateHint')}</span>
                  </div>
                  <div className={`form-group ${formData.account_number && formData.account_number.toUpperCase().includes('TB') ? 'acct-field-tb' : formData.account_number && formData.account_number.toUpperCase().includes('BG') ? 'acct-field-bg' : ''}`}>
                    <label htmlFor="account_number">{t('empForm.accountNumber')}</label>
                    <input id="account_number" name="account_number" type="text" value={formData.account_number} onChange={handleChange} placeholder="e.g. GE29TB7894545082100008" maxLength={15} minLength={15} />
                    {formData.account_number && formData.account_number.length !== 15 && (
                      <span className="field-error">{t('empForm.accountChars', { count: formData.account_number.length })}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="tax_code">{t('empForm.taxCode')}</label>
                    {taxCodes.length > 0 ? (
                      <select id="tax_code" name="tax_code" value={formData.tax_code} onChange={handleChange}>
                        <option value="">{t('empForm.selectTaxCode')}</option>
                        {taxCodes.map((tc) => (
                          <option key={tc.id} value={tc.code}>{tc.code}</option>
                        ))}
                      </select>
                    ) : (
                      <input id="tax_code" name="tax_code" type="text" value={formData.tax_code} onChange={handleChange} placeholder={t('empForm.taxCodePlaceholder')} />
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="personal_email">Personal Email</label>
                    <input id="personal_email" name="personal_email" type="email" value={formData.personal_email} onChange={handleChange} placeholder="e.g. john@example.com" />
                  </div>
                  <div className="form-group">
                    <div className="pension-toggle-row">
                      <label className="toggle-switch">
                        <input type="checkbox" name="pension" checked={formData.pension} onChange={handleChange} />
                        <span className="toggle-track" />
                      </label>
                      <span className="pension-label">{t('empForm.pension')}</span>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => navigate('/documents?tab=employees&inner=employees')}>{t('empForm.cancel')}</button>
                  <button type="submit" className="btn-add" disabled={loading}>
                    {loading ? t('empForm.saving') : isEdit ? t('empForm.update') : t('empForm.create')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'salary' && isEdit && (
            <SalaryChanges employeeId={id} currentSalary={employee?.salary} currentOvertimeRate={employee?.overtime_rate} onSalaryUpdated={loadEmployee} />
          )}

          {activeTab === 'account' && isEdit && (
            <AccountChanges employeeId={id} currentAccount={employee?.account_number} onAccountUpdated={loadEmployee} />
          )}

          {activeTab === 'documents' && isEdit && (
            <Documents employeeId={id} />
          )}

          {activeTab === 'agreement' && isEdit && (
            <AgreementTab employeeId={id} employee={employee} />
          )}

          {activeTab === 'portal' && isEdit && (
            <PortalAccessTab
              id={id}
              pinStatus={pinStatus}
              loadPinStatus={loadPinStatus}
              pinInput={pinInput}
              setPinInput={setPinInput}
              pinLoading={pinLoading}
              pinMsg={pinMsg}
              setPinMsg={setPinMsg}
              handleSetPin={handleSetPin}
            />
          )}

        </div>
      </div>
    </div>
  );
}

function AgreementTab({ employeeId, employee }) {
  const emptyForm = {
    title: 'Employment Agreement',
    type: 'Employment',
    party_name: employee ? `${employee.first_name} ${employee.last_name}` : '',
    start_date: employee?.start_date || '',
    end_date: employee?.end_date || '',
    amount: employee?.salary || '',
    currency: 'GEL',
    status: 'active',
    notes: '',
  };

  const [agreements, setAgreements] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadAgreements(); }, [employeeId]);

  const loadAgreements = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/agreements?employee_id=${employeeId}`);
      setAgreements(res.data.agreements || []);
    } catch { setError('Failed to load agreements.'); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/agreements', { ...form, employee_id: employeeId });
      setSuccess('Agreement created successfully.');
      setShowForm(false);
      setForm({ ...emptyForm, party_name: employee ? `${employee.first_name} ${employee.last_name}` : '' });
      loadAgreements();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create agreement.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (agId) => {
    if (!window.confirm('Delete this agreement?')) return;
    try {
      await api.delete(`/agreements/${agId}`);
      setAgreements(a => a.filter(x => x.id !== agId));
    } catch { setError('Failed to delete.'); }
  };

  const statusBadge = (s) => {
    const map = { active: ['#dcfce7','#15803d'], inactive: ['#f1f5f9','#475569'], terminated: ['#fef2f2','#dc2626'] };
    const [bg, color] = map[s] || map.inactive;
    return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{s}</span>;
  };

  return (
    <div style={{ padding: '24px 0', maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Agreements</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Employment agreements for this employee</p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setError(''); setSuccess(''); }}
          style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ Create Agreement'}
        </button>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, marginBottom: 14, border: '1px solid #fca5a5' }}>{error}</div>}
      {success && <div style={{ padding: '10px 14px', background: '#f0fdf4', color: '#16a34a', borderRadius: 8, fontSize: 13, marginBottom: 14, border: '1px solid #bbf7d0' }}>{success}</div>}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              ['Title', 'title', 'text'],
              ['Party Name', 'party_name', 'text'],
            ].map(([lbl, name, type]) => (
              <div key={name}>
                <label style={ls.label}>{lbl}</label>
                <input name={name} type={type} value={form[name]} onChange={handleChange} required style={ls.input} />
              </div>
            ))}
            <div>
              <label style={ls.label}>Type</label>
              <select name="type" value={form.type} onChange={handleChange} style={ls.input}>
                {['Employment', 'Service', 'Contractor', 'NDA', 'Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={ls.label}>Status</label>
              <select name="status" value={form.status} onChange={handleChange} style={ls.input}>
                {['active', 'inactive', 'terminated'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={ls.label}>Start Date</label>
              <input name="start_date" type="date" value={form.start_date} onChange={handleChange} style={ls.input} />
            </div>
            <div>
              <label style={ls.label}>End Date</label>
              <input name="end_date" type="date" value={form.end_date} onChange={handleChange} style={ls.input} />
            </div>
            <div>
              <label style={ls.label}>Amount</label>
              <input name="amount" type="number" step="0.01" min="0" value={form.amount} onChange={handleChange} style={ls.input} />
            </div>
            <div>
              <label style={ls.label}>Currency</label>
              <select name="currency" value={form.currency} onChange={handleChange} style={ls.input}>
                {['GEL', 'USD', 'EUR'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={ls.label}>Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={{ ...ls.input, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Create Agreement'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</p>
      ) : agreements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14, border: '1px dashed #e2e8f0', borderRadius: 10 }}>
          No agreements yet. Click "+ Create Agreement" to add one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agreements.map(ag => (
            <div key={ag.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{ag.title}</span>
                  {statusBadge(ag.status)}
                  <span style={{ fontSize: 12, color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>{ag.type}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {ag.party_name && <span>Party: {ag.party_name}</span>}
                  {ag.amount && <span>Amount: {ag.amount} {ag.currency}</span>}
                  {ag.start_date && <span>From: {new Date(ag.start_date).toLocaleDateString('en-GB')}</span>}
                  {ag.end_date && <span>To: {new Date(ag.end_date).toLocaleDateString('en-GB')}</span>}
                </div>
                {ag.notes && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>{ag.notes}</p>}
              </div>
              <button
                onClick={() => handleDelete(ag.id)}
                style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ls = {
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' },
};

function PortalAccessTab({ id, pinStatus, loadPinStatus, pinInput, setPinInput, pinLoading, pinMsg, setPinMsg, handleSetPin }) {
  useEffect(() => { loadPinStatus(); }, [id]);

  return (
    <div style={{ padding: '24px 0', maxWidth: 440 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Portal Access</h3>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
        Set a 4-digit PIN so this employee can log in to the Employee Portal at <code>/portal</code> using their Personal ID and this PIN.
      </p>

      {/* Status */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#475569' }}>
          {pinStatus === null
            ? 'Loading...'
            : pinStatus.has_pin
              ? <>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ PIN active</span>
                  {pinStatus.updated_at && <span style={{ color: '#94a3b8', marginLeft: 8 }}>Last updated {new Date(pinStatus.updated_at).toLocaleDateString('en-GB')}</span>}
                </>
              : <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ No PIN set — employee cannot log in</span>
          }
        </div>
      </div>

      {/* Set PIN */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {pinStatus?.has_pin ? 'New PIN' : 'Set PIN'}
          </label>
          <input
            type="password"
            maxLength={4}
            inputMode="numeric"
            pattern="\d{4}"
            placeholder="4-digit PIN"
            value={pinInput}
            onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0,4)); setPinMsg({ type: '', text: '' }); }}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.3em' }}
          />
        </div>
        <button
          onClick={handleSetPin}
          disabled={pinLoading || pinInput.length !== 4}
          style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: (pinLoading || pinInput.length !== 4) ? 0.6 : 1 }}
        >
          {pinLoading ? 'Saving...' : 'Set PIN'}
        </button>
      </div>

      {pinMsg.text && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 13, background: pinMsg.type === 'error' ? '#fef2f2' : '#f0fdf4', color: pinMsg.type === 'error' ? '#dc2626' : '#16a34a', border: `1px solid ${pinMsg.type === 'error' ? '#fca5a5' : '#bbf7d0'}` }}>
          {pinMsg.text}
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 12, color: '#94a3b8' }}>
        Employees access the portal at: <strong style={{ color: '#475569' }}>{window.location.origin}/portal</strong>
      </p>
    </div>
  );
}

export default EmployeeForm;
