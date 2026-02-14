import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Employees.css';

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    name: '', personalId: '', birthdate: '', position: '',
    salary: '', otRate: '', startDate: '', endDate: '', status: '', account: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async (searchTerm = '') => {
    setLoading(true);
    setError('');
    try {
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await api.get('/employees', { params });
      setEmployees(response.data.employees);
    } catch (err) {
      setError('Failed to load employees: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadEmployees(search);
  };

  const handleDelete = async (employee) => {
    if (!window.confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await api.delete(`/employees/${employee.id}`);
      setSuccess('Employee deleted successfully');
      loadEmployees(search);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete employee');
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

  if (loading && employees.length === 0) {
    return <div className="emp-loading">Loading employees...</div>;
  }

  return (
    <div className="emp-container">
      <div className="emp-header">
        <div>
          <h1>Employees</h1>
          <p>Manage your employee records</p>
        </div>
        <button onClick={() => navigate('/employees/new')} className="btn-primary">
          + Add Employee
        </button>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search by name, position, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-search">Search</button>
        {search && (
          <button
            type="button"
            className="btn-clear"
            onClick={() => { setSearch(''); loadEmployees(); }}
          >
            Clear
          </button>
        )}
      </form>

      {employees.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>No employees yet</h3>
          <p>Add your first employee to get started</p>
          <button onClick={() => navigate('/employees/new')} className="btn-primary">
            Add Employee
          </button>
        </div>
      ) : (
        <div className="emp-table-wrapper">
          <table className="emp-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Personal ID</th>
                <th>Birthdate</th>
                <th>Position</th>
                <th>Salary</th>
                <th>OT Rate</th>
                <th>Account Number</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Actions</th>
              </tr>
              <tr className="filter-row">
                <th></th>
                <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.name} onChange={(e) => updateFilter('name', e.target.value)} /></th>
                <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.personalId} onChange={(e) => updateFilter('personalId', e.target.value)} /></th>
                <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.birthdate} onChange={(e) => updateFilter('birthdate', e.target.value)} /></th>
                <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.position} onChange={(e) => updateFilter('position', e.target.value)} /></th>
                <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.salary} onChange={(e) => updateFilter('salary', e.target.value)} /></th>
                <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.otRate} onChange={(e) => updateFilter('otRate', e.target.value)} /></th>
                <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.account} onChange={(e) => updateFilter('account', e.target.value)} /></th>
                <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} /></th>
                <th>
                  <select className="col-filter" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Ended</option>
                  </select>
                </th>
                <th>{hasFilters && <button className="btn-clear-filters" onClick={clearFilters} title="Clear filters">&times;</button>}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div className="emp-photo-thumb">
                      {emp.photo_url ? (
                        <img src={emp.photo_url} alt={`${emp.first_name} ${emp.last_name}`} />
                      ) : (
                        <span className="no-photo">👤</span>
                      )}
                    </div>
                  </td>
                  <td className="emp-name">
                    {emp.first_name} {emp.last_name}
                  </td>
                  <td>{emp.personal_id}</td>
                  <td>{formatDate(emp.birthdate)}</td>
                  <td><span className="position-badge">{emp.position}</span></td>
                  <td className="salary">{formatCurrency(emp.salary)}</td>
                  <td className="salary">{formatCurrency(emp.overtime_rate)}</td>
                  <td className={`account-num${emp.account_number ? (emp.account_number.toLowerCase().includes('gb') ? ' acct-gb' : emp.account_number.toLowerCase().includes('tb') ? ' acct-tb' : '') : ''}`}>{emp.account_number || '—'}</td>
                  <td>{formatDate(emp.start_date)}</td>
                  <td>{emp.end_date ? formatDate(emp.end_date) : <span className="position-badge">Active</span>}</td>
                  <td>
                    <div className="action-btns">
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit`)}
                        className="btn-icon"
                        title="Edit Info"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit?tab=salary`)}
                        className="btn-icon"
                        title="Salary Changes"
                      >
                        💲
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit?tab=account`)}
                        className="btn-icon"
                        title="Account Changes"
                      >
                        🏦
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit?tab=documents`)}
                        className="btn-icon"
                        title="Documents"
                      >
                        📄
                      </button>
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit?tab=members`)}
                        className="btn-icon"
                        title="Members"
                      >
                        🏋️
                      </button>
                      <button
                        onClick={() => handleDelete(emp)}
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
    </div>
  );
}

export default EmployeeList;
