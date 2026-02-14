import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const MEMBER_TYPES = ['Gym', 'Insurance', 'Pension', 'Custom'];

function MemberBenefits({ employeeId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [type, setType] = useState('Gym');
  const [customName, setCustomName] = useState('');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/employees/${employeeId}/members`);
      setMembers(response.data.members);
    } catch (err) {
      setError('Failed to load members');
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
      await api.post(`/employees/${employeeId}/members`, {
        type,
        custom_name: type === 'Custom' ? customName : null,
        amount: parseFloat(amount),
        effective_date: effectiveDate
      });
      setSuccess('Member added successfully');
      setCustomName('');
      setAmount('');
      setEffectiveDate('');
      setType('Gym');
      loadMembers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (memberId) => {
    if (!window.confirm('Delete this member?')) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/employees/${employeeId}/members/${memberId}`);
      setSuccess('Member deleted');
      loadMembers();
    } catch (err) {
      setError('Failed to delete member');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val);
  };

  const getDisplayName = (member) => {
    if (member.type === 'Custom' && member.custom_name) {
      return member.custom_name;
    }
    return member.type;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getTypeIcon = (memberType) => {
    switch (memberType) {
      case 'Gym': return '🏋️';
      case 'Insurance': return '🛡️';
      case 'Pension': return '🏦';
      default: return '📌';
    }
  };

  const totalAmount = members.reduce((sum, m) => sum + parseFloat(m.amount), 0);

  return (
    <div className="tab-panel">
      <div className="tab-panel-header">
        <h3>Members</h3>
        <p>Manage employee memberships and deductions</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      {/* Add Member Form */}
      <div className="sc-form-card">
        <h4>Add New Member</h4>
        <form onSubmit={handleSubmit}>
          <div className="sc-form-grid">
            <div className="form-group">
              <label>Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="form-select">
                {MEMBER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {type === 'Custom' && (
              <div className="form-group">
                <label>Custom Name *</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Parking, Lunch"
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>Amount *</label>
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
              <label>Date *</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? 'Adding...' : 'Add Member'}
          </button>
        </form>
      </div>

      {/* Members List */}
      {loading ? (
        <div className="emp-loading">Loading members...</div>
      ) : members.length === 0 ? (
        <div className="sc-empty">No members added yet.</div>
      ) : (
        <>
          <div className="members-list">
            {members.map((member) => (
              <div key={member.id} className="member-card">
                <div className="member-icon">{getTypeIcon(member.type)}</div>
                <div className="member-info">
                  <span className="member-name">{getDisplayName(member)}</span>
                  {member.type === 'Custom' && <span className="member-type-badge">Custom</span>}
                  {member.effective_date && <span className="member-date">{formatDate(member.effective_date)}</span>}
                </div>
                <div className="member-amount">{formatCurrency(member.amount)}</div>
                <button
                  onClick={() => handleDelete(member.id)}
                  className="btn-icon btn-delete"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <div className="members-total">
            <span>Total</span>
            <span className="members-total-amount">{formatCurrency(totalAmount)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default MemberBenefits;
