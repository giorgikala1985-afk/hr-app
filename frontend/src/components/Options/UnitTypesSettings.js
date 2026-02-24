import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

function UnitTypesSettings() {
  const { t } = useLanguage();
  const [unitTypes, setUnitTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [direction, setDirection] = useState('deduction');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDirection, setEditDirection] = useState('deduction');

  useEffect(() => {
    loadUnitTypes();
  }, []);

  const loadUnitTypes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/units');
      setUnitTypes(res.data.unit_types);
    } catch (err) {
      setError(t('ut.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/units', { name: name.trim(), direction });
      setName('');
      setDirection('deduction');
      loadUnitTypes();
    } catch (err) {
      setError(err.response?.data?.error || t('ut.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('ut.deleteConfirm'))) return;
    setError('');
    try {
      await api.delete(`/units/${id}`);
      loadUnitTypes();
    } catch (err) {
      setError(t('ut.deleteFailed'));
    }
  };

  const startEdit = (ut) => {
    setEditId(ut.id);
    setEditName(ut.name);
    setEditDirection(ut.direction);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
    setEditDirection('deduction');
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setError('');
    try {
      await api.put(`/units/${id}`, { name: editName.trim(), direction: editDirection });
      setEditId(null);
      loadUnitTypes();
    } catch (err) {
      setError(err.response?.data?.error || t('ut.updateFailed'));
    }
  };

  return (
    <div className="unit-types-settings">
      <h3>{t('ut.title')}</h3>
      <p className="pagination-desc">
        {t('ut.desc')}
      </p>

      {error && <div className="msg-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form className="ut-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder={t('ut.placeholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ut-input"
        />
        <div className="ut-direction-toggle">
          <button
            type="button"
            className={`ut-dir-btn ${direction === 'deduction' ? 'ut-dir-active-minus' : ''}`}
            onClick={() => setDirection('deduction')}
          >
            {t('ut.deduction')}
          </button>
          <button
            type="button"
            className={`ut-dir-btn ${direction === 'addition' ? 'ut-dir-active-plus' : ''}`}
            onClick={() => setDirection('addition')}
          >
            {t('ut.addition')}
          </button>
        </div>
        <button type="submit" className="btn-primary btn-sm" disabled={saving || !name.trim()}>
          {saving ? t('ut.adding') : t('ut.add')}
        </button>
      </form>

      {loading ? (
        <div style={{ padding: '20px 0', color: '#888' }}>{t('ut.loading')}</div>
      ) : unitTypes.length === 0 ? (
        <div className="ut-empty">{t('ut.empty')}</div>
      ) : (
        <div className="ut-list">
          {unitTypes.map((ut) => (
            <div key={ut.id} className="ut-item">
              {editId === ut.id ? (
                <div className="ut-edit-row">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="ut-input"
                  />
                  <div className="ut-direction-toggle">
                    <button
                      type="button"
                      className={`ut-dir-btn ${editDirection === 'deduction' ? 'ut-dir-active-minus' : ''}`}
                      onClick={() => setEditDirection('deduction')}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className={`ut-dir-btn ${editDirection === 'addition' ? 'ut-dir-active-plus' : ''}`}
                      onClick={() => setEditDirection('addition')}
                    >
                      +
                    </button>
                  </div>
                  <button className="btn-primary btn-sm" onClick={() => handleUpdate(ut.id)}>{t('ut.save')}</button>
                  <button className="ut-cancel-btn" onClick={cancelEdit}>{t('ut.cancel')}</button>
                </div>
              ) : (
                <>
                  <div className="ut-item-info">
                    <span className="ut-item-name">{ut.name}</span>
                    <span className={`ut-item-badge ${ut.direction === 'addition' ? 'ut-badge-plus' : 'ut-badge-minus'}`}>
                      {ut.direction === 'addition' ? '+' : '-'}
                    </span>
                  </div>
                  <div className="ut-item-actions">
                    <button className="ut-edit-btn" onClick={() => startEdit(ut)} title={t('ut.edit')}>&#9998;</button>
                    <button className="ut-delete-btn" onClick={() => handleDelete(ut.id)} title={t('ut.delete')}>&times;</button>
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

export default UnitTypesSettings;
