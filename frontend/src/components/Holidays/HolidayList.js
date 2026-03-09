import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColumnResize, RESIZE_HANDLE_STYLE } from '../../hooks/useColumnResize';

const DEFAULT_WIDTHS = [180, 260, 80];

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

const EMPTY_FILTERS = { date: '', name: '' };

const filterInput = {
  width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '3px 6px',
  border: '1px solid #d1d5db', borderRadius: 5, background: '#f9fafb',
  color: '#374151', outline: 'none', marginTop: 4, fontFamily: 'inherit',
};

function HolidayList() {
  const { t } = useLanguage();
  const { colWidths, onResizeMouseDown } = useColumnResize(DEFAULT_WIDTHS);
  const currentYear = new Date().getFullYear();

  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [formCustomName, setFormCustomName] = useState('');
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) years.push(y);

  useEffect(() => { loadHolidays(year); }, [year]);

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

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  const filtered = useMemo(() => holidays.filter(hol => {
    if (filters.date && !formatDate(hol.date).toLowerCase().includes(filters.date.toLowerCase())) return false;
    if (filters.name && !hol.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    return true;
  }), [holidays, filters]);

  const hasFilters = Object.values(filters).some(Boolean);

  const openNew = () => {
    setEditId(null);
    setFormDate('');
    setFormName('');
    setFormCustomName('');
    setError('');
    setShowForm(true);
  };

  const openEdit = (hol) => {
    setEditId(hol.id);
    setFormDate(hol.date);
    const isPreset = HOLIDAY_NAMES.filter(n => n !== 'Custom').includes(hol.name);
    setFormName(isPreset ? hol.name : 'Custom');
    setFormCustomName(isPreset ? '' : hol.name);
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formDate) { setError('Date is required.'); return; }
    if (!formName) { setError('Name is required.'); return; }
    if (formName === 'Custom' && !formCustomName.trim()) { setError('Custom name is required.'); return; }

    const finalName = formName === 'Custom' ? formCustomName : formName;
    setSaving(true);
    setError('');
    try {
      if (editId) {
        await api.put(`/holidays/${editId}`, { date: formDate, name: finalName });
        setSuccess(t('hol.updatedSuccess'));
      } else {
        await api.post('/holidays', { date: formDate, name: finalName });
        setSuccess(t('hol.addedSuccess'));
      }
      setShowForm(false);
      loadHolidays(year);
    } catch (err) {
      setError(err.response?.data?.error || t('hol.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hol) => {
    if (!window.confirm(`Delete "${hol.name}" on ${formatDate(hol.date)}?`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/holidays/${hol.id}`);
      setSuccess(t('hol.deletedSuccess'));
      loadHolidays(year);
    } catch (err) {
      setError(err.response?.data?.error || t('hol.deleteFailed'));
    }
  };

  const COLS = [
    { label: t('hol.date'),       key: 'date' },
    { label: t('hol.nameColumn'), key: 'name' },
    { label: '',                  key: null },
  ];

  return (
    <div>
      <h2>{t('hol.title')}</h2>
      <p className="acc-subtitle">{t('hol.subtitle')}</p>

      <div className="acc-summary">
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total</span>
          <span className="acc-summary-value">
            {filtered.length}{hasFilters && filtered.length !== holidays.length ? ` / ${holidays.length}` : ''}
          </span>
        </div>
      </div>

      <div className="acc-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Year:</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '6px 12px', border: '1.5px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: 'white', color: '#1e293b', cursor: 'pointer' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 7, fontSize: 12, fontWeight: 500, color: '#92400e', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Clear filters
            </button>
          )}
        </div>
        <button className="btn-add" onClick={openNew}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('hol.addBtn')}
        </button>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="msg-success" style={{ marginBottom: 12 }}>{success}</div>}

      <div className="acc-table-wrapper">
        {loading ? <div className="acc-empty"><p>{t('hol.loading')}</p></div>
          : holidays.length === 0 ? <div className="acc-empty"><p>{t('hol.noHolidays').replace('{year}', year)}</p></div>
          : filtered.length === 0 ? <div className="acc-empty"><p>No results match your filters.</p></div>
          : (
            <table className="acc-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
              <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <thead>
                <tr>
                  {COLS.map((col, i) => (
                    <th key={i} style={{ position: 'relative', width: colWidths[i], overflow: 'hidden', verticalAlign: 'top', paddingBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        {col.label}
                        {col.key && filters[col.key] && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg>}
                      </div>
                      {col.key && (
                        <input
                          type="text"
                          value={filters[col.key]}
                          onChange={e => setFilters(p => ({ ...p, [col.key]: e.target.value }))}
                          placeholder="Filter…"
                          style={filterInput}
                        />
                      )}
                      <div onMouseDown={e => onResizeMouseDown(e, i)} style={RESIZE_HANDLE_STYLE} onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(hol => (
                  <tr key={hol.id}>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 500, color: '#0f3460' }}>{formatDate(hol.date)}</td>
                    <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{hol.name}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-icon" onClick={() => openEdit(hol)} title="Edit" style={{ color: '#3b82f6' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="btn-icon btn-delete" onClick={() => handleDelete(hol)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {showForm && (
        <div className="acc-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="acc-modal" onClick={e => e.stopPropagation()}>
            <h3>{editId ? t('hol.editTitle') : t('hol.addTitle')}</h3>
            {error && <div className="msg-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="acc-form-grid">
              <div className="acc-form-group">
                <label>{t('hol.name')} *</label>
                <select
                  value={formName}
                  onChange={e => {
                    const val = e.target.value;
                    setFormName(val);
                    setFormCustomName('');
                    if (HOLIDAY_DATES[val]) setFormDate(`${year}-${HOLIDAY_DATES[val]}`);
                  }}
                >
                  <option value="">— Select reason —</option>
                  {HOLIDAY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="acc-form-group">
                <label>{t('hol.date')} *</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              {formName === 'Custom' && (
                <div className="acc-form-group full">
                  <label>Custom Name *</label>
                  <input
                    type="text"
                    value={formCustomName}
                    onChange={e => setFormCustomName(e.target.value)}
                    placeholder="e.g. Company Anniversary"
                  />
                </div>
              )}
            </div>
            <div className="acc-modal-actions">
              <button className="ut-cancel-btn" onClick={() => setShowForm(false)}>{t('hol.cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('hol.saving') : editId ? t('hol.update') : t('hol.addBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HolidayList;
