import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import './Employees.css';
import '../Options/Options.css';

const DEFAULT_COLUMN_KEYS = ['photo', 'name', 'personalId', 'birthdate', 'position', 'salary', 'otRate', 'account', 'startDate', 'endDate'];
const DEFAULT_VISIBLE = new Set(DEFAULT_COLUMN_KEYS);

function EmployeeList() {
  const { t } = useLanguage();

  const ALL_COLUMNS = [
    { key: 'photo', label: t('col.photo'), hideable: true },
    { key: 'name', label: t('col.name'), hideable: false },
    { key: 'personalId', label: t('col.personalId'), hideable: true },
    { key: 'birthdate', label: t('col.birthdate'), hideable: true },
    { key: 'position', label: t('col.position'), hideable: true },
    { key: 'salary', label: t('col.salary'), hideable: false },
    { key: 'otRate', label: t('col.otRate'), hideable: true },
    { key: 'account', label: t('col.account'), hideable: true },
    { key: 'startDate', label: t('col.startDate'), hideable: true },
    { key: 'endDate', label: t('col.endDate'), hideable: true },
  ];

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('emp_visible_cols');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(DEFAULT_VISIBLE);
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const [filters, setFilters] = useState({
    name: '', personalId: '', birthdate: '', position: '',
    salary: '', otRate: '', startDate: '', endDate: '', status: '', account: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationSettings, setPaginationSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('pagination_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: false, pageSize: 50 };
  });
  const navigate = useNavigate();

  const onPaginationChange = useCallback(() => {
    try {
      const saved = localStorage.getItem('pagination_settings');
      if (saved) setPaginationSettings(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener('pagination-changed', onPaginationChange);
    return () => window.removeEventListener('pagination-changed', onPaginationChange);
  }, [onPaginationChange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, search, paginationSettings]);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    localStorage.setItem('emp_visible_cols', JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const toggleColumn = (key) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isCol = (key) => visibleCols.has(key);

  const loadEmployees = async (searchTerm = '') => {
    setLoading(true);
    setError('');
    try {
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await api.get('/employees', { params });
      setEmployees(response.data.employees);
    } catch (err) {
      setError(t('emp.loadFailed') + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadEmployees(search);
  };

  const handleDelete = async (employee) => {
    if (!window.confirm(t('emp.deleteConfirm', { name: `${employee.first_name} ${employee.last_name}` }))) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await api.delete(`/employees/${employee.id}`);
      setSuccess(t('emp.deletedSuccess'));
      loadEmployees(search);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete employee');
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredEmployees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    const count = selected.size;
    if (!window.confirm(t('emp.bulkDeleteConfirm', { count }))) return;
    setBulkDeleting(true);
    setError('');
    setSuccess('');
    try {
      for (const id of selected) {
        await api.delete(`/employees/${id}`);
      }
      setSuccess(t('emp.bulkDeletedSuccess', { count }));
      setSelected(new Set());
      loadEmployees(search);
    } catch (err) {
      setError(t('emp.bulkDeleteFailed'));
      loadEmployees(search);
    } finally {
      setBulkDeleting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ name: '', personalId: '', birthdate: '', position: '', salary: '', otRate: '', startDate: '', endDate: '', status: '', account: '' });
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    if (filters.name && !fullName.includes(filters.name.toLowerCase())) return false;
    if (filters.personalId && !emp.personal_id.toLowerCase().includes(filters.personalId.toLowerCase())) return false;
    if (filters.birthdate && !emp.birthdate.includes(filters.birthdate)) return false;
    if (filters.position && !emp.position.toLowerCase().includes(filters.position.toLowerCase())) return false;
    if (filters.salary && !String(emp.salary).includes(filters.salary)) return false;
    if (filters.otRate && !String(emp.overtime_rate).includes(filters.otRate)) return false;
    if (filters.startDate && !emp.start_date.includes(filters.startDate)) return false;
    if (filters.endDate) {
      if (!emp.end_date || !emp.end_date.includes(filters.endDate)) return false;
    }
    if (filters.status === 'active' && emp.end_date) return false;
    if (filters.status === 'inactive' && !emp.end_date) return false;
    if (filters.account && !(emp.account_number || '').toLowerCase().includes(filters.account.toLowerCase())) return false;
    return true;
  });

  const usePagination = paginationSettings.enabled && paginationSettings.pageSize !== 'all';
  const pageSize = usePagination ? paginationSettings.pageSize : filteredEmployees.length;
  const totalPages = usePagination ? Math.max(1, Math.ceil(filteredEmployees.length / pageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEmployees = usePagination
    ? filteredEmployees.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filteredEmployees;

  if (loading && employees.length === 0) {
    return <div className="emp-loading">{t('emp.loading')}</div>;
  }

  return (
    <div className="emp-container">
      <div className="emp-header">
        <div>
          <h1>{t('emp.title')}</h1>
          <p>{t('emp.subtitle')}</p>
        </div>
        <div className="emp-header-actions">
          {selected.size > 0 && (
            <button onClick={handleBulkDelete} className="btn-bulk-delete" disabled={bulkDeleting}>
              {bulkDeleting ? t('emp.deleting') : t('emp.deleteSelected', { count: selected.size })}
            </button>
          )}
          <div className="col-toggle-wrapper">
            <button
              className="btn-col-toggle"
              onClick={() => setShowColMenu((v) => !v)}
              title={t('action.showHideColumns')}
            >
              {t('emp.columns')}
            </button>
            {showColMenu && (
              <div className="col-toggle-menu">
                {ALL_COLUMNS.map((col) => (
                  <label key={col.key} className={`col-toggle-item${!col.hideable ? ' col-locked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      disabled={!col.hideable}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => navigate('/employees/new')} className="btn-primary">
            {t('emp.addNew')}
          </button>
        </div>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder={t('emp.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-search">{t('emp.search')}</button>
        {search && (
          <button
            type="button"
            className="btn-clear"
            onClick={() => { setSearch(''); loadEmployees(); }}
          >
            {t('emp.clear')}
          </button>
        )}
      </form>

      {employees.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>{t('emp.noEmployees')}</h3>
          <p>{t('emp.noEmployeesDesc')}</p>
          <button onClick={() => navigate('/employees/new')} className="btn-primary">
            {t('emp.addEmployee')}
          </button>
        </div>
      ) : (
        <div className="emp-table-wrapper">
          <table className="emp-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={filteredEmployees.length > 0 && selected.size === filteredEmployees.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {isCol('photo') && <th>{t('col.photo')}</th>}
                {isCol('name') && <th>{t('col.name')}</th>}
                {isCol('personalId') && <th>{t('col.personalId')}</th>}
                {isCol('birthdate') && <th>{t('col.birthdate')}</th>}
                {isCol('position') && <th>{t('col.position')}</th>}
                {isCol('salary') && <th>{t('col.salary')}</th>}
                {isCol('otRate') && <th>{t('col.otRate')}</th>}
                {isCol('account') && <th>{t('col.account')}</th>}
                {isCol('startDate') && <th>{t('col.startDate')}</th>}
                {isCol('endDate') && <th>{t('col.endDate')}</th>}
                <th>{t('col.actions')}</th>
              </tr>
              <tr className="filter-row">
                <th></th>
                {isCol('photo') && <th></th>}
                {isCol('name') && <th><input type="text" className="col-filter" placeholder={t('emp.filter')} value={filters.name} onChange={(e) => updateFilter('name', e.target.value)} /></th>}
                {isCol('personalId') && <th><input type="text" className="col-filter" placeholder={t('emp.filter')} value={filters.personalId} onChange={(e) => updateFilter('personalId', e.target.value)} /></th>}
                {isCol('birthdate') && <th><input type="text" className="col-filter" placeholder={t('emp.filter')} value={filters.birthdate} onChange={(e) => updateFilter('birthdate', e.target.value)} /></th>}
                {isCol('position') && <th><input type="text" className="col-filter" placeholder={t('emp.filter')} value={filters.position} onChange={(e) => updateFilter('position', e.target.value)} /></th>}
                {isCol('salary') && <th><input type="text" className="col-filter" placeholder={t('emp.filter')} value={filters.salary} onChange={(e) => updateFilter('salary', e.target.value)} /></th>}
                {isCol('otRate') && <th><input type="text" className="col-filter" placeholder={t('emp.filter')} value={filters.otRate} onChange={(e) => updateFilter('otRate', e.target.value)} /></th>}
                {isCol('account') && <th><input type="text" className="col-filter" placeholder={t('emp.filter')} value={filters.account} onChange={(e) => updateFilter('account', e.target.value)} /></th>}
                {isCol('startDate') && <th><input type="text" className="col-filter" placeholder={t('emp.filter')} value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} /></th>}
                {isCol('endDate') && <th>
                  <select className="col-filter" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
                    <option value="">{t('emp.all')}</option>
                    <option value="active">{t('emp.active')}</option>
                    <option value="inactive">{t('emp.ended')}</option>
                  </select>
                </th>}
                <th>{hasFilters && <button className="btn-clear-filters" onClick={clearFilters} title={t('action.clearFilters')}>&times;</button>}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((emp) => (
                <tr key={emp.id} className={selected.has(emp.id) ? 'row-selected' : ''}>
                  <td className="td-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                    />
                  </td>
                  {isCol('photo') && (
                    <td>
                      <div className="emp-photo-thumb">
                        {emp.photo_url ? (
                          <img src={emp.photo_url} alt={`${emp.first_name} ${emp.last_name}`} />
                        ) : (
                          <span className="no-photo">👤</span>
                        )}
                      </div>
                    </td>
                  )}
                  {isCol('name') && (
                    <td className="emp-name">
                      {emp.first_name} {emp.last_name}
                    </td>
                  )}
                  {isCol('personalId') && <td>{emp.personal_id}</td>}
                  {isCol('birthdate') && <td>{formatDate(emp.birthdate)}</td>}
                  {isCol('position') && <td><span className="position-badge">{emp.position}</span></td>}
                  {isCol('salary') && <td className="salary">{formatCurrency(emp.salary)}</td>}
                  {isCol('otRate') && <td className="salary">{formatCurrency(emp.overtime_rate)}</td>}
                  {isCol('account') && <td className={`account-num${emp.account_number ? (emp.account_number.toLowerCase().includes('gb') ? ' acct-gb' : emp.account_number.toLowerCase().includes('tb') ? ' acct-tb' : '') : ''}`}>{emp.account_number || '—'}</td>}
                  {isCol('startDate') && <td>{formatDate(emp.start_date)}</td>}
                  {isCol('endDate') && <td>{emp.end_date ? formatDate(emp.end_date) : <span className="position-badge">{t('emp.active')}</span>}</td>}
                  <td>
                    <div className="action-btns">
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit`)}
                        className="btn-icon"
                        title={t('action.edit')}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit?tab=salary`)}
                        className="btn-icon"
                        title={t('action.salaryChanges')}
                      >
                        💲
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit?tab=account`)}
                        className="btn-icon"
                        title={t('action.accountChanges')}
                      >
                        🏦
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit?tab=documents`)}
                        className="btn-icon"
                        title={t('action.documents')}
                      >
                        📄
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit?tab=members`)}
                        className="btn-icon"
                        title={t('action.members')}
                      >
                        🏋️
                      </button>
                      <button
                        onClick={() => handleDelete(emp)}
                        className="btn-icon btn-delete"
                        title={t('action.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usePagination && totalPages > 1 && (
            <div className="pagination-controls">
              <button className="pagination-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>&laquo;</button>
              <button className="pagination-btn" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>&lsaquo;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`dot-${i}`} className="pagination-info">...</span>
                  ) : (
                    <button key={p} className={`pagination-btn ${p === safePage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                  )
                )}
              <button className="pagination-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>&rsaquo;</button>
              <button className="pagination-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>&raquo;</button>
              <span className="pagination-info">{t('emp.total', { count: filteredEmployees.length })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmployeeList;
