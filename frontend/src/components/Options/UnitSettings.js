import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const UNIT_TYPES = ['Fitpass', 'Insurance', 'Custom'];

function UnitSettings() {
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
  }, []);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const response = await api.get('/units');
      setUnits(response.data.units);
    } catch (err) {
      setError(t('us.loadFailed'));
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
      await api.post('/units', {
        type: unitType,
        amount: parseFloat(amount),
        date,
      });
      setSuccess(t('us.success'));
      setAmount('');
      setDate('');
      setUnitType('Fitpass');
      loadUnits();
    } catch (err) {
      setError(err.response?.data?.error || t('us.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (unitId) => {
    if (!window.confirm(t('us.deleteConfirm'))) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/units/${unitId}`);
      setSuccess(t('us.deleted'));
      loadUnits();
    } catch (err) {
      setError(t('us.deleteFailed'));
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  if (loading) return <div className="emp-loading">{t('common.loading')}</div>;

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>{t('us.title')}</h3>
        <p>{t('us.subtitle')}</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* Add Unit Form */}
      <div className="sc-form-card">
        <h4>{t('us.addUnit')}</h4>
        <form onSubmit={handleSubmit}>
          <div className="sc-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group">
              <label>{t('us.unit')}</label>
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
              <label>{t('us.amount')}</label>
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
              <label>{t('us.date')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? t('us.saving') : t('us.save')}
          </button>
        </form>
      </div>

      {/* Units List */}
      {units.length === 0 ? (
        <div className="sc-empty">{t('us.noUnits')}</div>
      ) : (
        <div style={{ marginTop: '24px' }}>
          <div className="emp-table-wrapper">
            <table className="emp-table">
              <thead>
                <tr>
                  <th>{t('us.unit')}</th>
                  <th>{t('us.amount')}</th>
                  <th>{t('us.date')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td className="emp-name">{unit.type}</td>
                    <td className="salary">{formatCurrency(unit.amount)}</td>
                    <td>{formatDate(unit.date)}</td>
                    <td>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(unit.id)}
                        title={t('action.delete')}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default UnitSettings;
