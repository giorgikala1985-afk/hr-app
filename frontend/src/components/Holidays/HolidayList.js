import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import './Holidays.css';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const HOL_DEFAULT_WIDTHS = [140, 260, 80];

const HOLIDAY_NAMES = [
  'New Year',
  'Christmas',
  'Easter',
  'Heavy Monday',
  'Didgori Battle',
  "Developer's Birthday / Stalin's Death",
  'Custom',
];

const HOLIDAY_DATES = {
  'New Year': '01-01',
  'Christmas': '01-07',
  'Didgori Battle': '08-12',
  "Developer's Birthday / Stalin's Death": '03-05',
};

function HolidayList() {
  const { t } = useLanguage();
  const { colWidths, onResizeMouseDown } = useColumnResize(HOL_DEFAULT_WIDTHS);
  const currentYear = new Date().getFullYear();

  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [formCustomName, setFormCustomName] = useState('');
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
      setError(t('hol.loadFailed') + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const finalName = formName === 'Custom' ? formCustomName : formName;
    try {
      if (editId) {
        await api.put(`/holidays/${editId}`, { date: formDate, name: finalName });
        setSuccess(t('hol.updatedSuccess'));
      } else {
        await api.post('/holidays', { date: formDate, name: finalName });
        setSuccess(t('hol.addedSuccess'));
      }
      resetForm();
      loadHolidays(year);
    } catch (err) {
      setError(err.response?.data?.error || t('hol.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (holiday) => {
    setEditId(holiday.id);
    setFormDate(holiday.date);
    const isPreset = HOLIDAY_NAMES.filter(n => n !== 'Custom').includes(holiday.name);
    setFormName(isPreset ? holiday.name : 'Custom');
    setFormCustomName(isPreset ? '' : holiday.name);
  };

  const handleDelete = async (holiday) => {
    if (!window.confirm(`Delete "${holiday.name}" on ${formatDate(holiday.date)}?`)) return;

    setError('');
    setSuccess('');
    try {
      await api.delete(`/holidays/${holiday.id}`);
      setSuccess(t('hol.deletedSuccess'));
      loadHolidays(year);
    } catch (err) {
      setError(err.response?.data?.error || t('hol.deleteFailed'));
    }
  };

  const resetForm = () => {
    setEditId(null);
    setFormDate('');
    setFormName('');
    setFormCustomName('');
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
          <h1>{t('hol.title')}</h1>
          <p>{t('hol.subtitle')}</p>
        </div>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      <div className="hol-layout">
        {/* Add/Edit Form */}
        <div className="hol-form-card">
          <h3>{editId ? t('hol.editTitle') : t('hol.addTitle')}</h3>
          <form onSubmit={handleSubmit}>
            <div className="hol-form-group">
              <label htmlFor="holDate">{t('hol.date')}</label>
              <input
                id="holDate"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className="hol-form-group">
              <label htmlFor="holName">{t('hol.name')}</label>
              <select
                id="holName"
                value={formName}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormName(val);
                  setFormCustomName('');
                  if (HOLIDAY_DATES[val]) {
                    setFormDate(`${year}-${HOLIDAY_DATES[val]}`);
                  }
                }}
                required
              >
                <option value="">— Select reason —</option>
                {HOLIDAY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {formName === 'Custom' && (
              <div className="hol-form-group">
                <label htmlFor="holCustomName">Custom Name *</label>
                <input
                  id="holCustomName"
                  type="text"
                  value={formCustomName}
                  onChange={(e) => setFormCustomName(e.target.value)}
                  placeholder="e.g. Company Anniversary"
                  required
                />
              </div>
            )}
            <div className="hol-form-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                {saving ? t('hol.saving') : editId ? t('hol.update') : t('hol.addBtn')}
              </button>
              {editId && (
                <button type="button" className="btn-secondary btn-sm" onClick={resetForm}>
                  {t('hol.cancel')}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Holiday List */}
        <div className="hol-list-card">
          <div className="hol-list-header">
            <h3>{t('hol.holidaysIn').replace('{year}', year)}</h3>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="emp-loading">{t('hol.loading')}</div>
          ) : holidays.length === 0 ? (
            <div className="hol-empty">
              <p>{t('hol.noHolidays').replace('{year}', year)}</p>
            </div>
          ) : (
            <div className="hol-table-wrapper">
              <table className="emp-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ position: 'relative', width: colWidths[0], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('hol.date')}<div onMouseDown={e => onResizeMouseDown(e, 0)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                    <th style={{ position: 'relative', width: colWidths[1], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('hol.nameColumn')}<div onMouseDown={e => onResizeMouseDown(e, 1)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
                    <th style={{ position: 'relative', width: colWidths[2], overflow: 'hidden', whiteSpace: 'nowrap' }}>{t('col.actions')}<div onMouseDown={e => onResizeMouseDown(e, 2)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background='transparent'} /></th>
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
                      <td className="hol-date" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{formatDate(hol.date)}</td>
                      <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{hol.name}</td>
                      <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        <div className="action-btns">
                          <button
                            onClick={() => handleEdit(hol)}
                            className="btn-icon"
                            title="Edit"
                            style={{ color: '#3b82f6' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button
                            onClick={() => handleDelete(hol)}
                            className="btn-icon btn-delete"
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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
            {t('hol.totalDays').replace('{count}', filteredHolidays.length).replace('{s}', filteredHolidays.length !== 1 ? 's' : '')}{hasFilters && ` ${t('hol.filteredFrom').replace('{total}', holidays.length)}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HolidayList;
