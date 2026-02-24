import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

function PositionsSettings() {
  const { t } = useLanguage();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadPositions();
  }, []);

  const loadPositions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/positions');
      setPositions(res.data.positions);
    } catch (err) {
      setError(t('pos.loadFailed'));
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
      await api.post('/positions', { name: name.trim() });
      setName('');
      loadPositions();
    } catch (err) {
      setError(err.response?.data?.error || t('pos.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('pos.deleteConfirm'))) return;
    setError('');
    try {
      await api.delete(`/positions/${id}`);
      loadPositions();
    } catch (err) {
      setError(t('pos.deleteFailed'));
    }
  };

  const startEdit = (pos) => {
    setEditId(pos.id);
    setEditName(pos.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setError('');
    try {
      await api.put(`/positions/${id}`, { name: editName.trim() });
      setEditId(null);
      loadPositions();
    } catch (err) {
      setError(err.response?.data?.error || t('pos.updateFailed'));
    }
  };

  return (
    <div className="unit-types-settings">
      <h3>{t('pos.title')}</h3>
      <p className="pagination-desc">
        {t('pos.desc')}
      </p>

      {error && <div className="msg-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form className="ut-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder={t('pos.placeholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ut-input"
          style={{ minWidth: 260 }}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={saving || !name.trim()}>
          {saving ? t('pos.adding') : t('pos.add')}
        </button>
      </form>

      {loading ? (
        <div style={{ padding: '20px 0', color: '#888' }}>{t('pos.loading')}</div>
      ) : positions.length === 0 ? (
        <div className="ut-empty">{t('pos.empty')}</div>
      ) : (
        <div className="ut-list">
          {positions.map((pos) => (
            <div key={pos.id} className="ut-item">
              {editId === pos.id ? (
                <div className="ut-edit-row">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="ut-input"
                  />
                  <button className="btn-primary btn-sm" onClick={() => handleUpdate(pos.id)}>{t('pos.save')}</button>
                  <button className="ut-cancel-btn" onClick={cancelEdit}>{t('pos.cancel')}</button>
                </div>
              ) : (
                <>
                  <div className="ut-item-info">
                    <span className="ut-item-name">{pos.name}</span>
                  </div>
                  <div className="ut-item-actions">
                    <button className="ut-edit-btn" onClick={() => startEdit(pos)} title={t('pos.edit')}>&#9998;</button>
                    <button className="ut-delete-btn" onClick={() => handleDelete(pos.id)} title={t('pos.delete')}>&times;</button>
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

export default PositionsSettings;
