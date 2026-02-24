import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

function TaxSettings() {
  const { t } = useLanguage();
  const [taxCodes, setTaxCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCode, setEditCode] = useState('');

  useEffect(() => {
    loadTaxCodes();
  }, []);

  const loadTaxCodes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tax-codes');
      setTaxCodes(res.data.tax_codes);
    } catch (err) {
      setError(t('tax.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/tax-codes', { code: code.trim() });
      setCode('');
      loadTaxCodes();
    } catch (err) {
      setError(err.response?.data?.error || t('tax.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('tax.deleteConfirm'))) return;
    setError('');
    try {
      await api.delete(`/tax-codes/${id}`);
      loadTaxCodes();
    } catch (err) {
      setError(t('tax.deleteFailed'));
    }
  };

  const startEdit = (tc) => {
    setEditId(tc.id);
    setEditCode(tc.code);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditCode('');
  };

  const handleUpdate = async (id) => {
    if (!editCode.trim()) return;
    setError('');
    try {
      await api.put(`/tax-codes/${id}`, { code: editCode.trim() });
      setEditId(null);
      loadTaxCodes();
    } catch (err) {
      setError(err.response?.data?.error || t('tax.updateFailed'));
    }
  };

  return (
    <div className="unit-types-settings">
      <h3>{t('tax.title')}</h3>
      <p className="pagination-desc">
        {t('tax.desc')}
      </p>

      {error && <div className="msg-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form className="ut-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder={t('tax.placeholder')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="ut-input"
          style={{ minWidth: 260 }}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={saving || !code.trim()}>
          {saving ? t('tax.adding') : t('tax.add')}
        </button>
      </form>

      {loading ? (
        <div style={{ padding: '20px 0', color: '#888' }}>{t('tax.loading')}</div>
      ) : taxCodes.length === 0 ? (
        <div className="ut-empty">{t('tax.empty')}</div>
      ) : (
        <div className="ut-list">
          {taxCodes.map((tc) => (
            <div key={tc.id} className="ut-item">
              {editId === tc.id ? (
                <div className="ut-edit-row">
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="ut-input"
                  />
                  <button className="btn-primary btn-sm" onClick={() => handleUpdate(tc.id)}>{t('tax.save')}</button>
                  <button className="ut-cancel-btn" onClick={cancelEdit}>{t('tax.cancel')}</button>
                </div>
              ) : (
                <>
                  <div className="ut-item-info">
                    <span className="ut-item-name">{tc.code}</span>
                  </div>
                  <div className="ut-item-actions">
                    <button className="ut-edit-btn" onClick={() => startEdit(tc)} title={t('tax.edit')}>&#9998;</button>
                    <button className="ut-delete-btn" onClick={() => handleDelete(tc.id)} title={t('tax.delete')}>&times;</button>
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

export default TaxSettings;
