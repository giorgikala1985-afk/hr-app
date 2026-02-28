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

  useEffect(() => {
    loadPositions();
    loadDepartments();
    loadTaxCodes();
    if (isEdit) {
      loadEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      } else {
        await api.post('/employees', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      navigate('/');
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
  ];

  return (
    <div className="emp-container">
      <div className="emp-header">
        <div>
          <h1>{isEdit ? empName : t('empForm.addTitle')}</h1>
          <p>{isEdit ? t('empForm.editSubtitle') : t('empForm.addSubtitle')}</p>
        </div>
        <button onClick={() => navigate('/')} className="btn-secondary">
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
                  <button type="button" className="btn-secondary" onClick={() => navigate('/')}>{t('empForm.cancel')}</button>
                  <button type="submit" className="btn-primary" disabled={loading}>
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

        </div>
      </div>
    </div>
  );
}

export default EmployeeForm;
