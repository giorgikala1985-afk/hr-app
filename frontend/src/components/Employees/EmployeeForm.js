import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import SalaryChanges from './SalaryChanges';
import AccountChanges from './AccountChanges';
import Documents from './Documents';
import MemberBenefits from './MemberBenefits';
import './Employees.css';

function EmployeeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
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
    salary: '',
    overtime_rate: '',
    start_date: '',
    end_date: '',
    account_number: ''
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      loadEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        salary: emp.salary.toString(),
        overtime_rate: emp.overtime_rate.toString(),
        start_date: emp.start_date || '',
        end_date: emp.end_date || '',
        account_number: emp.account_number || ''
      });
      if (emp.photo_url) {
        setExistingPhotoUrl(emp.photo_url);
      }
    } catch (err) {
      setError('Failed to load employee: ' + (err.response?.data?.error || err.message));
    } finally {
      setPageLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Photo must be less than 5MB');
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
    return <div className="emp-loading">Loading employee...</div>;
  }

  const currentPhoto = photoPreview || existingPhotoUrl;
  const empName = employee ? `${employee.first_name} ${employee.last_name}` : 'New Employee';

  const tabs = [
    { key: 'info', label: 'Edit Info' },
    ...(isEdit ? [
      { key: 'salary', label: 'Salary Changes' },
      { key: 'account', label: 'Account Changes' },
      { key: 'documents', label: 'Documents' },
      { key: 'members', label: 'Members' }
    ] : [])
  ];

  return (
    <div className="emp-container">
      <div className="emp-header">
        <div>
          <h1>{isEdit ? empName : 'Add New Employee'}</h1>
          <p>{isEdit ? 'Manage employee details' : 'Enter employee details'}</p>
        </div>
        <button onClick={() => navigate('/')} className="btn-secondary">
          Back to List
        </button>
      </div>

      {error && <div className="msg-error">{error}</div>}

      <div className="emp-edit-layout">
        {/* Sidebar Tabs */}
        {isEdit && (
          <div className="emp-sidebar">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`emp-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.key === 'info' && <span className="tab-icon">i</span>}
                {tab.key === 'salary' && <span className="tab-icon">$</span>}
                {tab.key === 'account' && <span className="tab-icon">#</span>}
                {tab.key === 'documents' && <span className="tab-icon">D</span>}
                {tab.key === 'members' && <span className="tab-icon">M</span>}
                {tab.label}
              </button>
            ))}
          </div>
        )}

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
                      {currentPhoto ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {photoPreview && (
                      <button type="button" className="btn-danger btn-sm" onClick={removePhoto}>
                        Remove
                      </button>
                    )}
                    <span className="photo-hint">JPEG, PNG, or WebP. Max 5MB.</span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="first_name">First Name *</label>
                    <input id="first_name" name="first_name" type="text" value={formData.first_name} onChange={handleChange} placeholder="John" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="last_name">Last Name *</label>
                    <input id="last_name" name="last_name" type="text" value={formData.last_name} onChange={handleChange} placeholder="Doe" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="personal_id">Personal ID *</label>
                    <input id="personal_id" name="personal_id" type="text" value={formData.personal_id} onChange={handleChange} placeholder="e.g. 01234567890" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="birthdate">Birthdate *</label>
                    <input id="birthdate" name="birthdate" type="date" value={formData.birthdate} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="position">Position *</label>
                    <input id="position" name="position" type="text" value={formData.position} onChange={handleChange} placeholder="e.g. Software Engineer" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="salary">Salary *</label>
                    <input id="salary" name="salary" type="number" step="0.01" min="0" value={formData.salary} onChange={handleChange} placeholder="e.g. 5000.00" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="overtime_rate">Overtime Rate *</label>
                    <input id="overtime_rate" name="overtime_rate" type="number" step="0.01" min="0" value={formData.overtime_rate} onChange={handleChange} placeholder="e.g. 25.00" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="start_date">Job Start Date *</label>
                    <input id="start_date" name="start_date" type="date" value={formData.start_date} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="end_date">Job End Date</label>
                    <input id="end_date" name="end_date" type="date" value={formData.end_date} onChange={handleChange} />
                    <span className="photo-hint">Leave empty if currently employed</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="account_number">Account Number</label>
                    <input id="account_number" name="account_number" type="text" value={formData.account_number} onChange={handleChange} placeholder="e.g. GE29TB7894545082100008" />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => navigate('/')}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : isEdit ? 'Update Employee' : 'Create Employee'}
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

          {activeTab === 'members' && isEdit && (
            <MemberBenefits employeeId={id} />
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeForm;
