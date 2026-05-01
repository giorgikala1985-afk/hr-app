import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
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
    salary_currency: 'GEL',
    mobile_number: '',
    start_date: '',
    end_date: '',
    account_number: '',
    tax_code: '',
    pit_rate: 20,
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
        salary_currency: emp.salary_currency || 'GEL',
        mobile_number: emp.mobile_number || '',
        start_date: emp.start_date || '',
        end_date: emp.end_date || '',
        account_number: emp.account_number || '',
        tax_code: emp.tax_code || '',
        pension: emp.pension || false,
        personal_email: emp.personal_email || '',
        pit_rate: emp.pit_rate ?? 20
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
    const { name, type, checked, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

    if (formData.account_number && formData.account_number.length !== 22) {
      setError('Account number must be exactly 22 characters');
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
        const bk = res.data.bookkeeping;
        if (bk && !bk.success) {
          setError(`თანამშრომელი დაემატა, მაგრამ გატარებები ვერ შეიქმნა: ${bk.error}`);
          setLoading(false);
          return;
        }
        if (newId) {
          navigate(`/employees/${newId}/edit?bookkeeping=created`);
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
      {searchParams.get('bookkeeping') === 'created' && (
        <div className="msg-success" style={{ marginBottom: 12 }}>
          Employee Has Been Added
        </div>
      )}

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
                <div className="form-grid-4">
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
                    <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                      <input
                        id="salary" name="salary" type="number" step="0.01" min="0"
                        value={formData.salary} onChange={handleChange}
                        placeholder="e.g. 5000.00" required
                        style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' }}
                      />
                      {['GEL', 'USD', 'EUR'].map((cur, i, arr) => (
                        <button
                          key={cur}
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, salary_currency: cur }))}
                          style={{
                            padding: '0 11px',
                            fontSize: 12, fontWeight: 700,
                            border: '1px solid var(--border, #d1d5db)',
                            borderLeft: i === 0 ? '1px solid var(--border, #d1d5db)' : 'none',
                            borderTopRightRadius: i === arr.length - 1 ? 'var(--radius, 8px)' : 0,
                            borderBottomRightRadius: i === arr.length - 1 ? 'var(--radius, 8px)' : 0,
                            borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
                            cursor: 'pointer',
                            background: formData.salary_currency === cur ? '#2563eb' : 'var(--surface, #fff)',
                            color: formData.salary_currency === cur ? '#fff' : 'var(--text-2, #6b7280)',
                            transition: 'background 0.13s, color 0.13s',
                            height: '100%',
                          }}
                        >
                          {cur}
                        </button>
                      ))}
                    </div>
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
                  {(() => {
                    const acctUp = (formData.account_number || '').toUpperCase();
                    const isTB = acctUp.includes('TB');
                    const isBG = acctUp.includes('BG');
                    return (
                  <div className={`form-group ${isTB ? 'acct-field-tb' : isBG ? 'acct-field-bg' : ''}`}>
                    <label htmlFor="account_number">{t('empForm.accountNumber')}</label>
                    <input id="account_number" name="account_number" type="text" value={formData.account_number} onChange={handleChange} placeholder="e.g. GE29TB7894545082100008" maxLength={22} minLength={22} style={isTB ? { borderColor: '#60a5fa', background: 'rgba(59,130,246,0.08)' } : isBG ? { borderColor: '#d9673a', background: 'rgba(217,103,58,0.08)' } : {}} />
                    {formData.account_number && formData.account_number.length !== 22 && (
                      <span className="field-error">{formData.account_number.length}/22 characters</span>
                    )}
                  </div>
                    );
                  })()}
                  <div className="form-group">
                    <label htmlFor="pit_rate">PIT Rate</label>
                    <select id="pit_rate" name="pit_rate" value={formData.pit_rate} onChange={handleChange}>
                      <option value={5}>5%</option>
                      <option value={20}>20%</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="personal_email">Personal Email</label>
                    <input id="personal_email" name="personal_email" type="email" value={formData.personal_email} onChange={handleChange} placeholder="e.g. john@example.com" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="mobile_number">Mobile Number</label>
                    <input id="mobile_number" name="mobile_number" type="tel" value={formData.mobile_number} onChange={handleChange} placeholder="e.g. +995 555 123456" />
                  </div>
                  <div className="form-group">
                    <label className="pension-toggle-row" onClick={() => setFormData(p => ({ ...p, pension: !p.pension }))}>
                      <label className="toggle-switch" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" name="pension" checked={formData.pension} onChange={handleChange} />
                        <span className="toggle-track" />
                      </label>
                      <span className="pension-label">
                        {t('empForm.pension')}
                        <span className="pension-label-sub">Employee participates in pension scheme</span>
                      </span>
                    </label>
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
  const [sendingId, setSendingId] = useState(null);
  const [signUrls, setSignUrls] = useState({});
  const [emailOverride, setEmailOverride] = useState('');
  const [emailPromptId, setEmailPromptId] = useState(null);

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

  const downloadPDF = (ag) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 20;
    const pageW = 210;
    const contentW = pageW - margin * 2;
    let y = 25;

    // Header bar
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('EMPLOYMENT AGREEMENT', margin, 9.5);
    doc.text(new Date().toLocaleDateString('en-GB'), pageW - margin, 9.5, { align: 'right' });

    // Title
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(20);
    doc.text(ag.title || 'Employment Agreement', pageW / 2, y + 10, { align: 'center' });
    y += 22;

    // Status badge area
    const statusColors = { active: [220, 252, 231], inactive: [241, 245, 249], terminated: [254, 242, 242] };
    const statusText = { active: [21, 128, 61], inactive: [71, 85, 105], terminated: [220, 38, 38] };
    const [sbg, stxt] = [statusColors[ag.status] || statusColors.inactive, statusText[ag.status] || statusText.inactive];
    doc.setFillColor(...sbg);
    doc.roundedRect(pageW / 2 - 20, y, 40, 7, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...stxt);
    doc.text((ag.status || 'active').toUpperCase(), pageW / 2, y + 4.8, { align: 'center' });
    y += 16;

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    const sectionTitle = (title) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(37, 99, 235);
      doc.text(title, margin, y);
      y += 1;
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 1, margin + doc.getTextWidth(title), y + 1);
      y += 7;
    };

    const row = (label, value) => {
      if (!value) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(label + ':', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), margin + 45, y);
      y += 7;
    };

    sectionTitle('PARTIES');
    row('Party Name', ag.party_name || '—');
    row('Agreement Type', ag.type || '—');
    y += 3;

    sectionTitle('TERMS & CONDITIONS');
    row('Start Date', ag.start_date ? new Date(ag.start_date).toLocaleDateString('en-GB') : '—');
    row('End Date', ag.end_date ? new Date(ag.end_date).toLocaleDateString('en-GB') : 'Open-ended');
    row('Amount', ag.amount ? `${Number(ag.amount).toLocaleString()} ${ag.currency}` : '—');
    y += 3;

    if (ag.notes) {
      sectionTitle('ADDITIONAL NOTES');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(ag.notes, contentW);
      doc.text(lines, margin, y);
      y += lines.length * 5.5 + 8;
    }

    // Signatures section
    y = Math.max(y + 10, 210);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235);
    doc.text('SIGNATURES', margin, y);
    y += 12;

    // Employer signature box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, 75, 28, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, 75, 28, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('EMPLOYER', margin + 4, y + 6);
    doc.setLineWidth(0.3);
    doc.setDrawColor(148, 163, 184);
    doc.line(margin + 4, y + 20, margin + 70, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Authorized Signature & Date', margin + 4, y + 25);

    // Employee signature box
    const ex = pageW - margin - 75;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(ex, y, 75, 28, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(ex, y, 75, 28, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('EMPLOYEE', ex + 4, y + 6);
    doc.setLineWidth(0.3);
    doc.setDrawColor(148, 163, 184);
    doc.line(ex + 4, y + 20, ex + 70, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${ag.party_name || 'Employee'} & Date`, ex + 4, y + 25);

    // Footer
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 282, pageW, 15, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')}  |  Agreement ID: ${ag.id}`, pageW / 2, 290, { align: 'center' });

    doc.save(`${(ag.title || 'agreement').replace(/\s+/g, '-')}.pdf`);
  };

  const doSendSignLink = async (ag, email) => {
    setSendingId(ag.id);
    setError('');
    setSuccess('');
    setEmailPromptId(null);
    try {
      const createRes = await api.post('/documents', {
        employee_id: employeeId,
        employee_name: ag.party_name,
        type: 'hiring',
        title: ag.title,
        content: {
          job_title: ag.type,
          start_date: ag.start_date ? new Date(ag.start_date).toLocaleDateString('en-GB') : '',
          end_date: ag.end_date ? new Date(ag.end_date).toLocaleDateString('en-GB') : '',
          salary: ag.amount,
          currency: ag.currency,
          notes: ag.notes,
        },
      });
      const docId = createRes.data.document.id;
      const sendRes = await api.post(`/documents/${docId}/send`, {
        email: email || null,
        employee_name: ag.party_name,
      });
      setSignUrls(prev => ({ ...prev, [ag.id]: sendRes.data.sign_url }));
      setSuccess(email ? `Sign link sent to ${email}` : 'Sign link created (no email — copy the link below)');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send sign link.');
    } finally { setSendingId(null); }
  };

  const handleSendSignLink = (ag) => {
    const email = employee?.personal_email;
    if (!email) {
      setEmailPromptId(ag.id);
      setEmailOverride('');
    } else {
      doSendSignLink(ag, email);
    }
  };

  const statusBadge = (s) => {
    const map = { active: ['#dcfce7','#15803d'], inactive: ['#f1f5f9','#475569'], terminated: ['#fef2f2','#dc2626'] };
    const [bg, color] = map[s] || map.inactive;
    return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{s}</span>;
  };

  return (
    <div style={{ padding: '24px 0', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Agreements</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>Employment agreements for this employee</p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setError(''); setSuccess(''); }}
          style={{ padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ Create Agreement'}
        </button>
      </div>

      {error && <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.15)', color: '#f87171', borderRadius: 8, fontSize: 13, marginBottom: 14, border: '1px solid rgba(220,38,38,0.3)' }}>{error}</div>}
      {success && <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,0.15)', color: '#4ade80', borderRadius: 8, fontSize: 13, marginBottom: 14, border: '1px solid rgba(22,163,74,0.3)' }}>{success}</div>}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
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
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Create Agreement'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-4)', fontSize: 14 }}>Loading…</p>
      ) : agreements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-4)', fontSize: 14, border: '1px dashed var(--border-2)', borderRadius: 10 }}>
          No agreements yet. Click "+ Create Agreement" to add one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agreements.map(ag => (
            <div key={ag.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{ag.title}</span>
                    {statusBadge(ag.status)}
                    <span style={{ fontSize: 12, color: 'var(--text-4)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 12 }}>{ag.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {ag.party_name && <span>Party: {ag.party_name}</span>}
                    {ag.amount && <span>Amount: {ag.amount} {ag.currency}</span>}
                    {ag.start_date && <span>From: {new Date(ag.start_date).toLocaleDateString('en-GB')}</span>}
                    {ag.end_date && <span>To: {new Date(ag.end_date).toLocaleDateString('en-GB')}</span>}
                  </div>
                  {ag.notes && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-4)' }}>{ag.notes}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {/* Download PDF */}
                  <button
                    onClick={() => downloadPDF(ag)}
                    title="Download PDF"
                    style={{ background: 'none', border: '1px solid var(--border-2)', color: 'var(--text-3)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    PDF
                  </button>
                  {/* Send Sign Link */}
                  <button
                    onClick={() => handleSendSignLink(ag)}
                    disabled={sendingId === ag.id}
                    title="Send sign link by email"
                    style={{ background: 'none', border: '1px solid var(--border-2)', color: 'var(--accent)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    {sendingId === ag.id ? 'Sending…' : 'Send Sign Link'}
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(ag.id)}
                    style={{ background: 'none', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Email prompt when no personal_email on employee */}
              {emailPromptId === ag.id && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--surface-3)', borderRadius: 8, border: '1px solid var(--border-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input
                    type="email"
                    placeholder="Enter employee email…"
                    value={emailOverride}
                    onChange={e => setEmailOverride(e.target.value)}
                    style={{ ...ls.input, flex: 1, padding: '6px 10px', fontSize: 12 }}
                  />
                  <button
                    onClick={() => doSendSignLink(ag, emailOverride || null)}
                    disabled={!emailOverride}
                    style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Send
                  </button>
                  <button
                    onClick={() => setEmailPromptId(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  >×</button>
                </div>
              )}

              {/* Sign URL display after sending */}
              {signUrls[ag.id] && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(22,163,74,0.08)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', flex: 1, wordBreak: 'break-all' }}>{signUrls[ag.id]}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(signUrls[ag.id]); }}
                    style={{ background: 'none', border: '1px solid var(--border-2)', borderRadius: 5, padding: '3px 8px', fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >Copy</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ls = {
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid var(--border-2)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' },
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
