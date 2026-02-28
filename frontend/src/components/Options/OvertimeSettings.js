import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const FONT_MONO = 'ui-monospace, "Cascadia Code", "SF Mono", "Fira Mono", Menlo, Consolas, monospace';

function OvertimeSettings() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editRate, setEditRate] = useState('');

  useEffect(() => { loadRates(); }, []);

  const loadRates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/overtime-rates');
      setRates(res.data.overtime_rates);
    } catch {
      setError('Failed to load overtime rates.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!label.trim() || !rate) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/overtime-rates', { label: label.trim(), rate: parseFloat(rate) });
      setLabel('');
      setRate('');
      loadRates();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create overtime rate.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this overtime rate?')) return;
    setError('');
    try {
      await api.delete(`/overtime-rates/${id}`);
      loadRates();
    } catch {
      setError('Failed to delete overtime rate.');
    }
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setEditLabel(r.label);
    setEditRate(String(r.rate));
  };

  const cancelEdit = () => { setEditId(null); setEditLabel(''); setEditRate(''); };

  const handleUpdate = async (id) => {
    if (!editLabel.trim() || !editRate) return;
    setError('');
    try {
      await api.put(`/overtime-rates/${id}`, { label: editLabel.trim(), rate: parseFloat(editRate) });
      setEditId(null);
      loadRates();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update overtime rate.');
    }
  };

  return (
    <div className="unit-types-settings">
      <h3>Overtime Rates</h3>
      <p className="pagination-desc">
        Configure overtime percentage rates used in salary calculations. The rate percentage is multiplied by the hourly wage — e.g. 110% pays 1.1× the hourly rate per hour.
      </p>

      {error && <div className="msg-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form className="ut-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Label (e.g. Standard OT)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="ut-input"
          style={{ minWidth: 200 }}
        />
        <input
          type="number"
          placeholder="Rate % (e.g. 110)"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="ut-input"
          min="1"
          step="0.1"
          style={{ width: 140 }}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={saving || !label.trim() || !rate}>
          {saving ? 'Adding…' : 'Add Rate'}
        </button>
      </form>

      {loading ? (
        <div style={{ padding: '20px 0', color: '#888' }}>Loading…</div>
      ) : rates.length === 0 ? (
        <div className="ut-empty">No overtime rates yet. Add one above.</div>
      ) : (
        <div className="ut-list">
          {rates.map((r) => (
            <div key={r.id} className="ut-item">
              {editId === r.id ? (
                <div className="ut-edit-row">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="ut-input"
                    style={{ minWidth: 160 }}
                  />
                  <input
                    type="number"
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="ut-input"
                    min="1"
                    step="0.1"
                    style={{ width: 100 }}
                  />
                  <button className="btn-primary btn-sm" onClick={() => handleUpdate(r.id)}>Save</button>
                  <button className="ut-cancel-btn" onClick={cancelEdit}>Cancel</button>
                </div>
              ) : (
                <>
                  <div className="ut-item-info">
                    <span className="ut-item-name">{r.label}</span>
                    <span style={{
                      fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14,
                      color: '#2563eb', background: '#eff6ff',
                      padding: '2px 10px', borderRadius: 6, marginLeft: 10,
                    }}>
                      {r.rate}%
                    </span>
                  </div>
                  <div className="ut-item-actions">
                    <button className="ut-edit-btn" onClick={() => startEdit(r)} title="Edit">&#9998;</button>
                    <button className="ut-delete-btn" onClick={() => handleDelete(r.id)} title="Delete">&times;</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OvertimeSettings;
