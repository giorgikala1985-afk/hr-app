import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import './Salaries.css';

function SalaryList() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(currentMonth);
  const [salaries, setSalaries] = useState([]);
  const [holidaysCount, setHolidaysCount] = useState(0);
  const [weekendDays, setWeekendDays] = useState(0);
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ name: '', position: '', salary: '', days: '', accrued: '' });
  const [gelRate, setGelRate] = useState(null);

  useEffect(() => {
    loadSalaries(month);
  }, [month]);

  useEffect(() => {
    loadGelRate();
  }, []);

  const loadGelRate = async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      if (data.rates && data.rates.GEL) {
        setGelRate(data.rates.GEL);
      }
    } catch (err) {
      console.error('Failed to fetch GEL rate:', err);
    }
  };

  const loadSalaries = async (selectedMonth) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/salaries', { params: { month: selectedMonth } });
      setSalaries(response.data.salaries);
      setHolidaysCount(response.data.holidays_count || 0);
      setWeekendDays(response.data.weekend_days || 0);
      setWorkingDays(response.data.working_days || 0);
    } catch (err) {
      setError('Failed to load salaries: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatGEL = (amount) => {
    return new Intl.NumberFormat('ka-GE', {
      style: 'currency',
      currency: 'GEL'
    }).format(amount);
  };

  const getMonthLabel = (monthStr) => {
    const [year, m] = monthStr.split('-').map(Number);
    return new Date(year, m - 1).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  const getMonthName = (monthStr) => {
    const [year, m] = monthStr.split('-').map(Number);
    return new Date(year, m - 1).toLocaleDateString('en-US', { month: 'long' });
  };

  const downloadExcel = () => {
    const monthName = getMonthName(month);
    const description = `${monthName} Salary`;

    const rows = filteredEmployees.map((item) => ({
      'Name': item.employee.first_name,
      'Last Name': item.employee.last_name,
      'Account Number': item.employee.account_number || '',
      'Amount': item.accrued_salary,
      'Amount (GEL)': gelRate ? Math.round(item.accrued_salary * gelRate * 100) / 100 : '',
      'Description': description
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Name
      { wch: 18 }, // Last Name
      { wch: 28 }, // Account Number
      { wch: 12 }, // Amount
      { wch: 14 }, // Amount (GEL)
      { wch: 20 }  // Description
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salaries');
    XLSX.writeFile(wb, `Salaries_${month}.xlsx`);
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ name: '', position: '', salary: '', days: '', accrued: '' });
  };

  const hasFilters = Object.values(filters).some((v) => v !== '');

  const activeEmployees = salaries.filter((s) => s.days_worked > 0);

  const filteredEmployees = activeEmployees.filter((item) => {
    const fullName = `${item.employee.first_name} ${item.employee.last_name}`.toLowerCase();
    if (filters.name && !fullName.includes(filters.name.toLowerCase())) return false;
    if (filters.position && !item.employee.position.toLowerCase().includes(filters.position.toLowerCase())) return false;
    if (filters.salary && !String(item.employee.salary).includes(filters.salary)) return false;
    if (filters.days && !String(item.days_worked).includes(filters.days)) return false;
    if (filters.accrued && !String(item.accrued_salary).includes(filters.accrued)) return false;
    return true;
  });

  const totalAccrued = filteredEmployees.reduce((sum, s) => sum + s.accrued_salary, 0);

  return (
    <div className="sal-container">
      <div className="sal-header">
        <div>
          <h1>Salaries</h1>
          <p>Calculate employee salaries by month</p>
        </div>
      </div>

      <div className="sal-month-picker">
        <label htmlFor="month">Select Month:</label>
        <input
          id="month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <span className="sal-month-label">{getMonthLabel(month)}</span>
        {filteredEmployees.length > 0 && (
          <button className="btn-excel" onClick={downloadExcel} title="Download Excel">
            <span className="excel-icon">&#x1F4E5;</span> Export Excel
          </button>
        )}
      </div>

      {error && <div className="msg-error">{error}</div>}

      {loading ? (
        <div className="emp-loading">Calculating salaries...</div>
      ) : activeEmployees.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h3>No salaries for {getMonthLabel(month)}</h3>
          <p>No employees were active during this period</p>
        </div>
      ) : (
        <>
          <div className="sal-summary">
            <div className="sal-summary-card">
              <span className="sal-summary-label">Active Employees</span>
              <span className="sal-summary-value">{filteredEmployees.length}</span>
            </div>
            <div className="sal-summary-card">
              <span className="sal-summary-label">Working Days</span>
              <span className="sal-summary-value">{workingDays}</span>
              <span className="sal-summary-note">
                {weekendDays} weekend{weekendDays !== 1 ? 's' : ''}
                {holidaysCount > 0 && ` + ${holidaysCount} holiday${holidaysCount !== 1 ? 's' : ''}`}
                {' '}excluded
              </span>
            </div>
            <div className="sal-summary-card">
              <span className="sal-summary-label">Total Accrued</span>
              <span className="sal-summary-value sal-total">{formatCurrency(totalAccrued)}</span>
              {gelRate && <span className="sal-summary-note sal-gel">{formatGEL(totalAccrued * gelRate)}</span>}
            </div>
            {gelRate && (
              <div className="sal-summary-card">
                <span className="sal-summary-label">USD/GEL Rate</span>
                <span className="sal-summary-value">{gelRate.toFixed(4)}</span>
              </div>
            )}
          </div>

          <div className="emp-table-wrapper">
            <table className="emp-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Employee</th>
                  <th>Position</th>
                  <th>Monthly Salary</th>
                  <th>Days Worked</th>
                  <th>Accrued Salary</th>
                </tr>
                <tr className="filter-row">
                  <th></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.name} onChange={(e) => updateFilter('name', e.target.value)} /></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.position} onChange={(e) => updateFilter('position', e.target.value)} /></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.salary} onChange={(e) => updateFilter('salary', e.target.value)} /></th>
                  <th><input type="text" className="col-filter" placeholder="Filter..." value={filters.days} onChange={(e) => updateFilter('days', e.target.value)} /></th>
                  <th>{hasFilters && <button className="btn-clear-filters" onClick={clearFilters} title="Clear filters">&times;</button>}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((item) => (
                  <tr key={item.employee.id}>
                    <td>
                      <div className="emp-photo-thumb">
                        {item.employee.photo_url ? (
                          <img src={item.employee.photo_url} alt={`${item.employee.first_name} ${item.employee.last_name}`} />
                        ) : (
                          <span className="no-photo">👤</span>
                        )}
                      </div>
                    </td>
                    <td className="emp-name">
                      {item.employee.first_name} {item.employee.last_name}
                    </td>
                    <td><span className="position-badge">{item.employee.position}</span></td>
                    <td className="salary">
                      {formatCurrency(item.employee.salary)}
                      {item.salary_note && <div className="sal-change-note">*changed</div>}
                    </td>
                    <td>
                      <span className={item.days_worked < item.total_days ? 'days-partial' : 'days-full'}>
                        {item.days_worked} / {item.total_days}
                      </span>
                    </td>
                    <td className="salary sal-accrued">
                      {formatCurrency(item.accrued_salary)}
                      {gelRate && <div className="sal-gel-inline">{formatGEL(item.accrued_salary * gelRate)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="5" className="sal-footer-label">Total</td>
                  <td className="salary sal-accrued sal-footer-total">
                    {formatCurrency(totalAccrued)}
                    {gelRate && <div className="sal-gel-inline">{formatGEL(totalAccrued * gelRate)}</div>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default SalaryList;
