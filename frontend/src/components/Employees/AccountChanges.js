import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function AccountChanges({ employeeId, currentAccount, onAccountUpdated }) {
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
      setError('Failed to load account history');
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
      setSuccess('Account change recorded successfully');
      setNewAccount('');
      setEffectiveDate('');
      setNote('');
      loadChanges();
      if (onAccountUpdated) onAccountUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save account change');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (changeId) => {
    if (!window.confirm('Delete this account change record?')) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${employeeId}/account-changes/${changeId}`);
      setSuccess('Record deleted');
      loadChanges();
    } catch (err) {
      setError('Failed to delete record');
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
        <h3>Account Changes</h3>
        <p>Current account: <strong className={currentAccount ? (currentAccount.toLowerCase().includes('gb') ? 'acct-gb' : currentAccount.toLowerCase().includes('tb') ? 'acct-tb' : '') : ''}>{currentAccount || 'Not set'}</strong></p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* New Account Change Form */}
      <div className="sc-form-card">
        <h4>Record New Account Change</h4>
        <form onSubmit={handleSubmit}>
          <div className="sc-form-grid">
            <div className="form-group">
              <label>New Account Number *</label>
              <input type="text" value={newAccount} onChange={(e) => setNewAccount(e.target.value)} placeholder="e.g. GE29TB7894545082100008" required />
            </div>
            <div className="form-group">
              <label>Effective Date *</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Note</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. New bank account" />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving...' : 'Record Change'}
          </button>
        </form>
      </div>

      {/* History */}
      {loading ? (
        <div className="emp-loading">Loading history...</div>
      ) : changes.length === 0 ? (
        <div className="sc-empty">No account changes recorded yet.</div>
      ) : (
        <div className="sc-timeline">
          {changes.map((change) => (
            <div key={change.id} className="sc-item">
              <div className="sc-item-date">{formatDate(change.effective_date)}</div>
              <div className="sc-item-detail">
                <div className="sc-item-salary">
                  <span className={`sc-old${change.old_account ? (change.old_account.toLowerCase().includes('gb') ? ' acct-gb' : change.old_account.toLowerCase().includes('tb') ? ' acct-tb' : '') : ''}`}>{change.old_account || '(none)'}</span>
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
