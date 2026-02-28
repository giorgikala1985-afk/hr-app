import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function DepartmentsSettings() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/departments');
      setDepartments(res.data.departments);
    } catch {
      setError('Failed to load departments.');
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
      await api.post('/departments', { name: name.trim() });
      setName('');
      loadDepartments();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department?')) return;
    setError('');
    try {
      await api.delete(`/departments/${id}`);
      loadDepartments();
    } catch {
      setError('Failed to delete department.');
    }
  };

  const startEdit = (dept) => {
    setEditId(dept.id);
    setEditName(dept.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName('');
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setError('');
    try {
      await api.put(`/departments/${id}`, { name: editName.trim() });
      setEditId(null);
      loadDepartments();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update department.');
    }
  };

  return (
    <div className="unit-types-settings">
      <h3>Departments</h3>
      <p className="pagination-desc">
        Manage departments to organize employees by team or division.
      </p>

      {error && <div className="msg-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form className="ut-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Department name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ut-input"
          style={{ minWidth: 260 }}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add Department'}
        </button>
      </form>

      {loading ? (
        <div style={{ padding: '20px 0', color: '#888' }}>Loading…</div>
      ) : departments.length === 0 ? (
        <div className="ut-empty">No departments yet. Add one above.</div>
      ) : (
        <div className="ut-list">
          {departments.map((dept) => (
            <div key={dept.id} className="ut-item">
              {editId === dept.id ? (
                <div className="ut-edit-row">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="ut-input"
                  />
                  <button className="btn-primary btn-sm" onClick={() => handleUpdate(dept.id)}>Save</button>
                  <button className="ut-cancel-btn" onClick={cancelEdit}>Cancel</button>
                </div>
              ) : (
                <>
                  <div className="ut-item-info">
                    <span className="ut-item-name">{dept.name}</span>
                  </div>
                  <div className="ut-item-actions">
                    <button className="ut-edit-btn" onClick={() => startEdit(dept)} title="Edit">&#9998;</button>
                    <button className="ut-delete-btn" onClick={() => handleDelete(dept.id)} title="Delete">&times;</button>
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

export default DepartmentsSettings;
