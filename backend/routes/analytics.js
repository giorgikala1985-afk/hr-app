const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Helper functions (same as salaries.js)
function isWeekend(year, month, day) {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

function countWorkingDays(year, monthNum, startDay, endDay, holidayDaySet) {
  let count = 0;
  for (let d = startDay; d <= endDay; d++) {
    if (!isWeekend(year, monthNum, d) && !holidayDaySet.has(d)) {
      count++;
    }
  }
  return count;
}

// Get analytics dashboard data
router.get('/', async (req, res) => {
  try {
    const analytics = {};

    // 1. Total Employees
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, salary, position, start_date, end_date')
      .eq('user_id', req.userId);

    if (employeesError) throw employeesError;

    analytics.totalEmployees = employees?.length || 0;
    analytics.activeEmployees = employees?.filter(e => !e.end_date).length || 0;

    // 2. Salary Statistics
    if (employees && employees.length > 0) {
      const salaries = employees
        .map(e => parseFloat(e.salary) || 0)
        .filter(s => s > 0);

      if (salaries.length > 0) {
        analytics.averageSalary =
          salaries.reduce((a, b) => a + b, 0) / salaries.length;
        analytics.totalSalaryExpense = salaries.reduce((a, b) => a + b, 0);
      } else {
        analytics.averageSalary = 0;
        analytics.totalSalaryExpense = 0;
      }
    } else {
      analytics.averageSalary = 0;
      analytics.totalSalaryExpense = 0;
    }

    // 3. Position Breakdown (was department - using position instead)
    if (employees && employees.length > 0) {
      const positions = {};
      employees.forEach(emp => {
        const pos = emp.position || 'Not Assigned';
        positions[pos] = (positions[pos] || 0) + 1;
      });
      analytics.departmentBreakdown = Object.entries(positions).map(
        ([department, count]) => ({
          department,
          count,
        })
      );
    } else {
      analytics.departmentBreakdown = [];
    }

    // 4. Salary Range Distribution
    if (employees && employees.length > 0) {
      const ranges = {
        '$0 - $1k': 0,
        '$1k - $2k': 0,
        '$2k - $5k': 0,
        '$5k - $10k': 0,
        '$10k+': 0,
      };

      employees.forEach(emp => {
        const salary = parseFloat(emp.salary) || 0;
        if (salary < 1000) ranges['$0 - $1k']++;
        else if (salary < 2000) ranges['$1k - $2k']++;
        else if (salary < 5000) ranges['$2k - $5k']++;
        else if (salary < 10000) ranges['$5k - $10k']++;
        else ranges['$10k+']++;
      });

      analytics.salaryRanges = Object.entries(ranges).map(([range, count]) => ({
        range,
        count,
      }));
    } else {
      analytics.salaryRanges = [];
    }

    // 5. Upcoming Holidays
    const today = new Date().toISOString().split('T')[0];
    const { data: holidays, error: holidaysError } = await supabase
      .from('holidays')
      .select('id, name, date')
      .eq('user_id', req.userId)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(5);

    if (!holidaysError && holidays) {
      analytics.upcomingHolidays = holidays.map(h => ({
        name: h.name,
        date: h.date,
      }));
    } else {
      analytics.upcomingHolidays = [];
    }

    analytics.timestamp = new Date().toISOString();

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analytics/salary-report — monthly salary totals for last N months
router.get('/salary-report', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const now = new Date();

    // Fetch employees, salary changes, holidays, and units
    const [empResult, salChangesResult, holResult, unitsResult] = await Promise.all([
      supabase.from('employees').select('*').eq('user_id', req.userId),
      supabase.from('salary_changes').select('*').order('effective_date', { ascending: true }),
      supabase.from('holidays').select('*').eq('user_id', req.userId),
      supabase.from('employee_units').select('*').eq('user_id', req.userId),
    ]);

    const employees = empResult.data || [];
    const allSalaryChanges = salChangesResult.data || [];
    const allHolidays = holResult.data || [];
    const allUnits = unitsResult.data || [];

    const report = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum - 1, daysInMonth);
      const monthStartStr = `${monthStr}-01`;
      const monthEndStr = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

      // Holidays for this month
      const monthHolidays = allHolidays.filter(h => h.date >= monthStartStr && h.date <= monthEndStr);
      const holidayDaySet = new Set(monthHolidays.map(h => new Date(h.date).getDate()));
      const totalWorkingDays = countWorkingDays(year, monthNum, 1, daysInMonth, holidayDaySet);

      // Units active by this month
      const monthUnits = allUnits.filter(u => u.date <= monthEndStr);

      let totalAccrued = 0;
      let totalDeductions = 0;
      let activeCount = 0;

      for (const emp of employees) {
        const startDate = new Date(emp.start_date);
        const endDate = emp.end_date ? new Date(emp.end_date) : null;

        if (startDate > monthEnd) continue;
        if (endDate && endDate < monthStart) continue;

        activeCount++;

        // Effective range
        let effectiveStart = 1;
        if (startDate >= monthStart && startDate <= monthEnd) {
          effectiveStart = startDate.getDate();
        }
        let effectiveEnd = daysInMonth;
        if (endDate && endDate >= monthStart && endDate <= monthEnd) {
          effectiveEnd = endDate.getDate();
        }

        const daysWorked = countWorkingDays(year, monthNum, effectiveStart, effectiveEnd, holidayDaySet);

        // Salary changes logic
        const empChanges = allSalaryChanges.filter(sc => sc.employee_id === emp.id);
        const changesBefore = empChanges.filter(sc => sc.effective_date <= monthStartStr);
        const changesInMonth = empChanges.filter(sc => sc.effective_date > monthStartStr && sc.effective_date <= monthEndStr);
        const changesAfter = empChanges.filter(sc => sc.effective_date > monthEndStr);

        let baseSalary;
        if (changesBefore.length > 0) {
          baseSalary = parseFloat(changesBefore[changesBefore.length - 1].new_salary);
        } else if (changesInMonth.length > 0) {
          baseSalary = parseFloat(changesInMonth[0].old_salary);
        } else if (changesAfter.length > 0) {
          baseSalary = parseFloat(changesAfter[0].old_salary);
        } else {
          baseSalary = parseFloat(emp.salary);
        }

        let accruedSalary;
        if (changesInMonth.length > 0) {
          accruedSalary = 0;
          let currentSalary = baseSalary;
          let periodStart = effectiveStart;
          for (const change of changesInMonth) {
            const changeDay = parseInt(change.effective_date.split('-')[2], 10);
            if (changeDay >= periodStart && changeDay <= effectiveEnd) {
              const periodDays = countWorkingDays(year, monthNum, periodStart, changeDay - 1, holidayDaySet);
              const dailyRate = totalWorkingDays > 0 ? currentSalary / totalWorkingDays : 0;
              accruedSalary += dailyRate * periodDays;
              currentSalary = parseFloat(change.new_salary);
              periodStart = changeDay;
            }
          }
          const remainingDays = countWorkingDays(year, monthNum, periodStart, effectiveEnd, holidayDaySet);
          const dailyRate = totalWorkingDays > 0 ? currentSalary / totalWorkingDays : 0;
          accruedSalary += dailyRate * remainingDays;
        } else {
          const dailyRate = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;
          accruedSalary = dailyRate * daysWorked;
        }

        totalAccrued += accruedSalary;

        // Deductions
        const empUnits = monthUnits.filter(u => u.employee_id === emp.id);
        const empDeductions = empUnits.reduce((sum, u) => sum + parseFloat(u.amount), 0);
        totalDeductions += empDeductions;
      }

      const netSalary = Math.round((totalAccrued - totalDeductions) * 100) / 100;

      report.push({
        month: monthStr,
        label: new Date(year, monthNum - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        active_employees: activeCount,
        total_accrued: Math.round(totalAccrued * 100) / 100,
        total_deductions: Math.round(totalDeductions * 100) / 100,
        net_salary: netSalary,
      });
    }

    res.json({ report });
  } catch (error) {
    console.error('Salary report error:', error);
    res.status(500).json({ error: 'Failed to generate salary report' });
  }
});

module.exports = router;
