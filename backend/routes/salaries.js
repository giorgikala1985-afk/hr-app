const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
// Check if a day is a weekend (Saturday=6, Sunday=0)
function isWeekend(year, month, day) {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

// Count working days in a range within a month (excluding weekends and holidays)
function countWorkingDays(year, monthNum, startDay, endDay, holidayDaySet) {
  let count = 0;
  for (let d = startDay; d <= endDay; d++) {
    if (!isWeekend(year, monthNum, d) && !holidayDaySet.has(d)) {
      count++;
    }
  }
  return count;
}

// GET /api/salaries?month=2025-01
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month is required in YYYY-MM format' });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum - 1, daysInMonth);

    const monthStartStr = `${month}-01`;
    const monthEndStr = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    // Compute previous month string
    const prevMonthDate = new Date(year, monthNum - 2, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // Fetch employees, holidays, salary changes, employee units, unit types, insurance list, and deferrals in parallel
    const [empResult, holResult, salChangesResult, unitsResult, unitTypesResult, insuranceResult, deferralsResult] = await Promise.all([
      supabase
        .from('employees')
        .select('*')
        .eq('user_id', req.userId)
        .order('last_name', { ascending: true }),
      supabase
        .from('holidays')
        .select('*')
        .eq('user_id', req.userId)
        .gte('date', monthStartStr)
        .lte('date', monthEndStr),
      supabase
        .from('salary_changes')
        .select('*')
        .order('effective_date', { ascending: true }),
      supabase
        .from('employee_units')
        .select('*')
        .eq('user_id', req.userId)
        .gte('date', monthStartStr)
        .lte('date', monthEndStr),
      supabase
        .from('unit_types')
        .select('*')
        .eq('user_id', req.userId),
      supabase
        .from('insurance_list')
        .select('*')
        .eq('user_id', req.userId)
        .gte('date', monthStartStr)
        .lte('date', monthEndStr),
      supabase
        .from('salary_deferrals')
        .select('*')
        .eq('user_id', req.userId)
        .in('month', [month, prevMonth])
    ]);

    if (empResult.error) {
      console.error('Error fetching employees:', empResult.error);
      return res.status(500).json({ error: 'Failed to fetch employees' });
    }

    const employees = empResult.data || [];
    const holidays = holResult.data || [];
    const allSalaryChanges = salChangesResult.data || [];
    const allUnits = unitsResult.data || [];
    const unitTypeDefs = unitTypesResult.data || [];
    const insuranceRecords = insuranceResult.data || [];

    const allDeferrals = deferralsResult.data || [];
    // Map: employee_id -> deferral record for current month
    const currentDeferralMap = {};
    // Map: employee_id -> deferred_amount for previous month
    const prevDeferralMap = {};
    for (const d of allDeferrals) {
      if (d.month === month) currentDeferralMap[d.employee_id] = d;
      if (d.month === prevMonth) prevDeferralMap[d.employee_id] = parseFloat(d.deferred_amount);
    }

    // Build a map: personal_id -> amount1 for quick lookup
    const insuranceByPersonalId = {};
    for (const rec of insuranceRecords) {
      if (rec.personal_id) {
        insuranceByPersonalId[String(rec.personal_id).trim()] = parseFloat(rec.amount1) || 0;
      }
    }

    // Build a set of addition type names from user-defined unit types
    const additionTypes = new Set(unitTypeDefs.filter((ut) => ut.direction === 'addition').map((ut) => ut.name));
    function isAddition(type) {
      return additionTypes.has(type);
    }

    // Build a set of holiday day-numbers for fast lookup
    const holidayDaySet = new Set(holidays.map((h) => new Date(h.date).getDate()));
    const holidayCount = holidayDaySet.size;

    // Total working days in the entire month
    const totalWorkingDays = countWorkingDays(year, monthNum, 1, daysInMonth, holidayDaySet);

    // Count weekends in the month
    let weekendCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (isWeekend(year, monthNum, d)) weekendCount++;
    }

    const salaries = employees.map((emp) => {
      const startDate = new Date(emp.start_date);
      const endDate = emp.end_date ? new Date(emp.end_date) : null;

      // Get units active for this employee in this month (date <= month end)
      const empUnits = allUnits.filter((u) => u.employee_id === emp.id);
      const totalDeductions = empUnits.filter((u) => !isAddition(u.type)).reduce((sum, u) => sum + parseFloat(u.amount), 0);
      const totalAdditions = empUnits.filter((u) => isAddition(u.type)).reduce((sum, u) => sum + parseFloat(u.amount), 0);

      // Insurance deduction: match by personal_id
      const insuranceDeduction = emp.personal_id
        ? (insuranceByPersonalId[String(emp.personal_id).trim()] || 0)
        : 0;

      // Deferral flags
      const deferral = currentDeferralMap[emp.id] || null;
      const isDeferred = !!deferral;
      const carryOver = prevDeferralMap[emp.id] || 0;
      const isMidMonthStarter = emp.start_date > monthStartStr && emp.start_date <= monthEndStr;

      // Employee hasn't started yet or ended before this month
      if (startDate > monthEnd) {
        return { employee: emp, days_worked: 0, total_days: totalWorkingDays, accrued_salary: 0, deductions: empUnits, total_deductions: 0, total_additions: 0, insurance_deduction: 0, net_salary: 0, is_deferred: false, carry_over: carryOver, is_mid_month_starter: false };
      }
      if (endDate && endDate < monthStart) {
        return { employee: emp, days_worked: 0, total_days: totalWorkingDays, accrued_salary: 0, deductions: empUnits, total_deductions: 0, total_additions: 0, insurance_deduction: 0, net_salary: 0, is_deferred: false, carry_over: carryOver, is_mid_month_starter: false };
      }

      // Effective range within the month
      let effectiveStart = 1;
      if (startDate >= monthStart && startDate <= monthEnd) {
        effectiveStart = startDate.getDate();
      }

      let effectiveEnd = daysInMonth;
      if (endDate && endDate >= monthStart && endDate <= monthEnd) {
        effectiveEnd = endDate.getDate();
      }

      const daysWorked = countWorkingDays(year, monthNum, effectiveStart, effectiveEnd, holidayDaySet);

      // Get ALL salary changes for this employee (sorted by effective_date asc)
      const empAllChanges = allSalaryChanges.filter((sc) => sc.employee_id === emp.id);

      // Split using string comparison (YYYY-MM-DD) to avoid timezone issues
      const changesBefore = empAllChanges.filter((sc) => sc.effective_date <= monthStartStr);
      const changesInMonth = empAllChanges.filter((sc) => sc.effective_date > monthStartStr && sc.effective_date <= monthEndStr);
      const changesAfter = empAllChanges.filter((sc) => sc.effective_date > monthEndStr);

      // Determine the salary that was active at the start of this month
      let baseSalary;
      if (changesBefore.length > 0) {
        // Most recent change before/at month start
        baseSalary = parseFloat(changesBefore[changesBefore.length - 1].new_salary);
      } else if (changesInMonth.length > 0) {
        // No changes before this month, but changes within it - use old_salary of earliest
        baseSalary = parseFloat(changesInMonth[0].old_salary);
      } else if (changesAfter.length > 0) {
        // No changes before or during this month - use old_salary of earliest future change
        baseSalary = parseFloat(changesAfter[0].old_salary);
      } else {
        // No salary changes at all - use current salary from employee record
        baseSalary = parseFloat(emp.salary);
      }

      // If there are mid-month changes, calculate prorated salary
      if (changesInMonth.length > 0) {
        let accruedSalary = 0;
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

        // Remaining period after last change
        const remainingDays = countWorkingDays(year, monthNum, periodStart, effectiveEnd, holidayDaySet);
        const dailyRate = totalWorkingDays > 0 ? currentSalary / totalWorkingDays : 0;
        accruedSalary += dailyRate * remainingDays;

        const roundedAccrued = Math.round(accruedSalary * 100) / 100;
        const effectiveAccrued = isDeferred ? 0 : roundedAccrued;
        const netSalary = Math.round((effectiveAccrued + totalAdditions + carryOver - totalDeductions - insuranceDeduction) * 100) / 100;

        return {
          employee: emp,
          days_worked: daysWorked,
          total_days: totalWorkingDays,
          accrued_salary: effectiveAccrued,
          original_accrued: roundedAccrued,
          deductions: empUnits,
          total_deductions: totalDeductions,
          total_additions: totalAdditions,
          insurance_deduction: insuranceDeduction,
          carry_over: carryOver,
          is_deferred: isDeferred,
          deferral_id: deferral?.id || null,
          is_mid_month_starter: isMidMonthStarter,
          net_salary: netSalary,
          salary_note: 'Salary changed during this month'
        };
      }

      // No mid-month changes - use baseSalary for the whole period
      const dailyRate = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;
      const accruedSalary = Math.round(dailyRate * daysWorked * 100) / 100;
      const effectiveAccrued = isDeferred ? 0 : accruedSalary;
      const netSalary = Math.round((effectiveAccrued + totalAdditions + carryOver - totalDeductions - insuranceDeduction) * 100) / 100;

      return {
        employee: { ...emp, salary: baseSalary },
        days_worked: daysWorked,
        total_days: totalWorkingDays,
        accrued_salary: effectiveAccrued,
        original_accrued: accruedSalary,
        deductions: empUnits,
        total_deductions: totalDeductions,
        total_additions: totalAdditions,
        insurance_deduction: insuranceDeduction,
        carry_over: carryOver,
        is_deferred: isDeferred,
        deferral_id: deferral?.id || null,
        is_mid_month_starter: isMidMonthStarter,
        net_salary: netSalary
      };
    });

    res.json({
      month,
      holidays_count: holidayCount,
      weekend_days: weekendCount,
      working_days: totalWorkingDays,
      salaries
    });
  } catch (error) {
    console.error('Salary calculation error:', error);
    res.status(500).json({ error: 'An error occurred while calculating salaries' });
  }
});

module.exports = router;
