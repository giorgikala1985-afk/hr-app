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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
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
                  <td>
                    <div className="action-btns">
                      <button
                        onClick={() => navigate(`/employees/${emp.id}/edit`)}
                        className="btn-icon"
                        title="Edit"
                      >
                        ✏️
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
