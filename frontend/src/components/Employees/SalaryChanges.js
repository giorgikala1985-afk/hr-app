import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

function SalaryChanges({ employeeId, currentSalary, currentOvertimeRate, onSalaryUpdated }) {
  const { t } = useLanguage();
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newSalary, setNewSalary] = useState('');
  const [newOvertimeRate, setNewOvertimeRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const loadChanges = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/employees/${employeeId}/salary-changes`);
      setChanges(response.data.salary_changes);
    } catch (err) {
      setError(t('sc.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.post(`/employees/${employeeId}/salary-changes`, {
        salary: newSalary,
        overtime_rate: newOvertimeRate || undefined,
        effective_date: effectiveDate,
        note
      });
      setSuccess(t('sc.success'));
      setNewSalary('');
      setNewOvertimeRate('');
      setEffectiveDate('');
      setNote('');
      loadChanges();
      if (onSalaryUpdated) onSalaryUpdated();
    } catch (err) {
      setError(err.response?.data?.error || t('sc.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (changeId) => {
    if (!window.confirm(t('sc.deleteConfirm'))) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${employeeId}/salary-changes/${changeId}`);
      setSuccess(t('sc.deleted'));
      loadChanges();
    } catch (err) {
      setError(t('sc.deleteFailed'));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>{t('sc.title')}</h3>
        <p>{t('sc.currentSalary')} <strong>{formatCurrency(currentSalary || 0)}</strong> | {t('sc.otRate')} <strong>{formatCurrency(currentOvertimeRate || 0)}</strong></p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* New Salary Change Form */}
      <div className="sc-form-card">
        <h4>{t('sc.recordNew')}</h4>
        <form onSubmit={handleSubmit}>
          <div className="sc-form-grid">
            <div className="form-group">
              <label>{t('sc.newSalary')}</label>
              <input type="number" step="0.01" min="0" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder="e.g. 500.00" required />
            </div>
            <div className="form-group">
              <label>{t('sc.newOtRate')}</label>
              <input type="number" step="0.01" min="0" value={newOvertimeRate} onChange={(e) => setNewOvertimeRate(e.target.value)} placeholder={t('sc.otPlaceholder')} />
            </div>
            <div className="form-group">
              <label>{t('sc.effectiveDate')}</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('sc.note')}</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('sc.notePlaceholder')} />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? t('sc.saving') : t('sc.recordChange')}
          </button>
        </form>
      </div>

      {/* History */}
      {loading ? (
        <div className="emp-loading">{t('sc.loadingHistory')}</div>
      ) : changes.length === 0 ? (
        <div className="sc-empty">{t('sc.noChanges')}</div>
      ) : (
        <div className="sc-timeline">
          {changes.map((change) => (
            <div key={change.id} className="sc-item">
              <div className="sc-item-date">{formatDate(change.effective_date)}</div>
              <div className="sc-item-detail">
                <div className="sc-item-salary">
                  <span className="sc-old">{formatCurrency(change.old_salary)}</span>
                  <span className="sc-arrow">&rarr;</span>
                  <span className="sc-new">{formatCurrency(change.new_salary)}</span>
                </div>
                {change.old_overtime_rate !== change.new_overtime_rate && (
                  <div className="sc-item-ot">
                    OT: {formatCurrency(change.old_overtime_rate)} &rarr; {formatCurrency(change.new_overtime_rate)}
                  </div>
                )}
                {change.note && <div className="sc-item-note">{change.note}</div>}
              </div>
              <button onClick={() => handleDelete(change.id)} className="btn-icon btn-delete" title="Delete">🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SalaryChanges;
