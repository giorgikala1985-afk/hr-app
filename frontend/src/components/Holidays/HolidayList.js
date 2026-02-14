import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './Holidays.css';

function HolidayList() {
  const currentYear = new Date().getFullYear();

  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ date: '', name: '' });

  useEffect(() => {
    loadHolidays(year);
  }, [year]);

  const loadHolidays = async (selectedYear) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/holidays', { params: { year: selectedYear } });
      setHolidays(response.data.holidays);
    } catch (err) {
      setError('Failed to load holidays: ' + (err.response?.data?.error || err.message));
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
      if (editId) {
        await api.put(`/holidays/${editId}`, { date: formDate, name: formName });
        setSuccess('Holiday updated successfully');
      } else {
        await api.post('/holidays', { date: formDate, name: formName });
        setSuccess('Holiday added successfully');
      }
      resetForm();
      loadHolidays(year);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (holiday) => {
    setEditId(holiday.id);
    setFormDate(holiday.date);
    setFormName(holiday.name);
  };

  const handleDelete = async (holiday) => {
    if (!window.confirm(`Delete "${holiday.name}" on ${formatDate(holiday.date)}?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.delete(`/holidays/${holiday.id}`);
      setSuccess('Holiday deleted successfully');
      loadHolidays(year);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete holiday');
    }
  };

  const resetForm = () => {
    setEditId(null);
    setFormDate('');
    setFormName('');
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ date: '', name: '' });
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  const filteredHolidays = holidays.filter((hol) => {
    if (filters.date && !formatDate(hol.date).toLowerCase().includes(filters.date.toLowerCase())) return false;
    if (filters.name && !hol.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    return true;
  });

  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    years.push(y);
  }

  return (
    <div className="hol-container">
      <div className="hol-header">
        <div>
          <h1>Holidays & Days Off</h1>
          <p>Manage non-working days that affect salary calculations</p>
        </div>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      <div className="hol-layout">
        {/* Add/Edit Form */}
        <div className="hol-form-card">
          <h3>{editId ? 'Edit Holiday' : 'Add Holiday / Day Off'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="hol-form-group">
              <label htmlFor="holDate">Date *</label>
              <input
                id="holDate"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className="hol-form-group">
              <label htmlFor="holName">Name / Reason *</label>
              <input
                id="holName"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. New Year's Day"
                required
              />
            </div>
            <div className="hol-form-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Update' : 'Add Holiday'}
              </button>
              {editId && (
                <button type="button" className="btn-secondary btn-sm" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Holiday List */}
        <div className="hol-list-card">
          <div className="hol-list-header">
            <h3>Holidays in {year}</h3>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="emp-loading">Loading...</div>
          ) : holidays.length === 0 ? (
            <div className="hol-empty">
              <p>No holidays added for {year}</p>
            </div>
          ) : (
            <div className="hol-table-wrapper">
              <table className="emp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name / Reason</th>
                    <th>Actions</th>
                  </tr>
                  <tr className="filter-row">
                    <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.date} onChange={(e) => updateFilter('date', e.target.value)} /></th>
                    <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.name} onChange={(e) => updateFilter('name', e.target.value)} /></th>
                    <th>{hasFilters && <button className="btn-clear-filters" onClick={clearFilters} title="Clear filters">&times;</button>}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHolidays.map((hol) => (
                    <tr key={hol.id}>
                      <td className="hol-date">{formatDate(hol.date)}</td>
                      <td>{hol.name}</td>
                      <td>
                        <div className="action-btns">
                          <button
                            onClick={() => handleEdit(hol)}
                            className="btn-icon"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(hol)}
                            className="btn-icon btn-delete"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="hol-count">
            Total: {filteredHolidays.length} day{filteredHolidays.length !== 1 ? 's' : ''} off{hasFilters && ` (filtered from ${holidays.length})`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HolidayList;
