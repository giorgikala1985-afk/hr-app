import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const UNIT_TYPES = ['Fitpass', 'Insurance', 'Custom'];

function EmployeeUnits({ employeeId }) {
  const { t } = useLanguage();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form
  const [unitType, setUnitType] = useState('Fitpass');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/employees/${employeeId}/units`);
      setUnits(response.data.units);
    } catch (err) {
      setError(t('eu.loadFailed'));
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
      await api.post(`/employees/${employeeId}/units`, {
        type: unitType,
        amount: parseFloat(amount),
        date,
      });
      setSuccess(t('eu.success'));
      setAmount('');
      setDate('');
      setUnitType('Fitpass');
      loadUnits();
    } catch (err) {
      setError(err.response?.data?.error || t('eu.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (unitId) => {
    if (!window.confirm(t('eu.deleteConfirm'))) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${employeeId}/units/${unitId}`);
      setSuccess(t('eu.deleted'));
      loadUnits();
    } catch (err) {
      setError(t('eu.deleteFailed'));
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Fitpass': return '🏋️';
      case 'Insurance': return '🛡️';
      default: return '📌';
    }
  };

  const totalAmount = units.reduce((sum, u) => sum + parseFloat(u.amount), 0);

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>{t('eu.title')}</h3>
        <p>{t('eu.subtitle')}</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* Add Unit Form */}
      <div className="sc-form-card">
        <h4>{t('eu.addUnit')}</h4>
        <form onSubmit={handleSubmit}>
          <div className="sc-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group">
              <label>{t('eu.unit')}</label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="form-select"
                required
              >
                {UNIT_TYPES.map((ut) => (
                  <option key={ut} value={ut}>{ut}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('eu.amount')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50.00"
                required
              />
            </div>
            <div className="form-group">
              <label>{t('eu.date')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? t('eu.saving') : t('eu.addBtn')}
          </button>
        </form>
      </div>

      {/* Units List */}
      {loading ? (
        <div className="emp-loading">{t('eu.loading')}</div>
      ) : units.length === 0 ? (
        <div className="sc-empty">{t('eu.noUnits')}</div>
      ) : (
        <>
          <div className="members-list">
            {units.map((unit) => (
              <div key={unit.id} className="member-card">
                <div className="member-icon">{getTypeIcon(unit.type)}</div>
                <div className="member-info">
                  <span className="member-name">{unit.type}</span>
                  {unit.date && <span className="member-date">{formatDate(unit.date)}</span>}
                </div>
                <div className="member-amount">{formatCurrency(unit.amount)}</div>
                <button
                  onClick={() => handleDelete(unit.id)}
                  className="btn-icon btn-delete"
                  title={t('action.delete')}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <div className="members-total">
            <span>{t('eu.total')}</span>
            <span className="members-total-amount">{formatCurrency(totalAmount)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default EmployeeUnits;
