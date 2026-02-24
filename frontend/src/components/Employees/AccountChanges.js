import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

function AccountChanges({ employeeId, currentAccount, onAccountUpdated }) {
  const { t } = useLanguage();
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newAccount, setNewAccount] = useState('');
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
      const response = await api.get(`/employees/${employeeId}/account-changes`);
      setChanges(response.data.account_changes);
    } catch (err) {
      setError(t('ac.loadFailed'));
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
      await api.post(`/employees/${employeeId}/account-changes`, {
        account_number: newAccount,
        effective_date: effectiveDate,
        note
      });
      setSuccess(t('ac.success'));
      setNewAccount('');
      setEffectiveDate('');
      setNote('');
      loadChanges();
      if (onAccountUpdated) onAccountUpdated();
    } catch (err) {
      setError(err.response?.data?.error || t('ac.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (changeId) => {
    if (!window.confirm(t('ac.deleteConfirm'))) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${employeeId}/account-changes/${changeId}`);
      setSuccess(t('ac.deleted'));
      loadChanges();
    } catch (err) {
      setError(t('ac.deleteFailed'));
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>{t('ac.title')}</h3>
        <p>{t('ac.currentAccount')} <strong className={currentAccount ? (currentAccount.toLowerCase().includes('gb') ? 'acct-gb' : currentAccount.toLowerCase().includes('tb') ? 'acct-tb' : '') : ''}>{currentAccount || t('ac.notSet')}</strong></p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* New Account Change Form */}
      <div className="sc-form-card">
        <h4>{t('ac.recordNew')}</h4>
        <form onSubmit={handleSubmit}>
          <div className="sc-form-grid">
            <div className="form-group">
              <label>{t('ac.newAccount')}</label>
              <input type="text" value={newAccount} onChange={(e) => setNewAccount(e.target.value)} placeholder={t('ac.accountPlaceholder')} required />
            </div>
            <div className="form-group">
              <label>{t('ac.effectiveDate')}</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('ac.note')}</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('ac.notePlaceholder')} />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? t('ac.saving') : t('ac.recordChange')}
          </button>
        </form>
      </div>

      {/* History */}
      {loading ? (
        <div className="emp-loading">{t('ac.loadingHistory')}</div>
      ) : changes.length === 0 ? (
        <div className="sc-empty">{t('ac.noChanges')}</div>
      ) : (
        <div className="sc-timeline">
          {changes.map((change) => (
            <div key={change.id} className="sc-item">
              <div className="sc-item-date">{formatDate(change.effective_date)}</div>
              <div className="sc-item-detail">
                <div className="sc-item-salary">
                  <span className={`sc-old${change.old_account ? (change.old_account.toLowerCase().includes('gb') ? ' acct-gb' : change.old_account.toLowerCase().includes('tb') ? ' acct-tb' : '') : ''}`}>{change.old_account || t('ac.none')}</span>
                  <span className="sc-arrow">&rarr;</span>
                  <span className={`sc-new${change.new_account.toLowerCase().includes('gb') ? ' acct-gb' : change.new_account.toLowerCase().includes('tb') ? ' acct-tb' : ''}`}>{change.new_account}</span>
                </div>
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

export default AccountChanges;
