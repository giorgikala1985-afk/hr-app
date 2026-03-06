const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const supabase = require('../config/supabase');
const { authenticatePortalEmployee } = require('../middleware/portalAuth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Unsupported file type'));
  }
});

// ── Helpers (copied from salaries.js) ────────────────────────────────────────

function isWeekend(year, month, day) {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

function countWorkingDays(year, monthNum, startDay, endDay, holidayDaySet) {
  let count = 0;
  for (let d = startDay; d <= endDay; d++) {
    if (!isWeekend(year, monthNum, d) && !holidayDaySet.has(d)) count++;
  }
  return count;
}

// ── PUBLIC ────────────────────────────────────────────────────────────────────

// POST /api/portal/login
router.post('/login', async (req, res) => {
  try {
    const { personal_id, pin } = req.body;
    if (!personal_id || !pin) {
      return res.status(400).json({ error: 'personal_id and pin are required' });
    }

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, personal_id, first_name, last_name')
      .eq('personal_id', String(personal_id).trim())
      .maybeSingle();

    if (empError || !employee) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { data: pinRecord } = await supabase
      .from('employee_pins')
      .select('pin_hash')
      .eq('employee_id', employee.id)
      .maybeSingle();

    if (!pinRecord) {
      return res.status(401).json({ error: 'Portal access not enabled for this account' });
    }

    const match = await bcrypt.compare(String(pin), pinRecord.pin_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { employeeId: employee.id, personalId: employee.personal_id },
      process.env.PORTAL_JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      employee: { id: employee.id, first_name: employee.first_name, last_name: employee.last_name }
    });
  } catch (err) {
    console.error('Portal login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── PROTECTED ─────────────────────────────────────────────────────────────────

// GET /api/portal/me
router.get('/me', authenticatePortalEmployee, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name, position, department, photo_url, personal_email, start_date')
      .eq('id', req.employeeId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET /api/portal/payroll?month=YYYY-MM
router.get('/payroll', authenticatePortalEmployee, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month required as YYYY-MM' });
    }

    const { data: emp } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.employeeId)
      .single();

    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const monthStartStr = `${month}-01`;
    const monthEndStr = `${month}-${String(daysInMonth).padStart(2, '0')}`;
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum - 1, daysInMonth);

    const prevMonthDate = new Date(year, monthNum - 2, 1);
    const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const [salChangesRes, unitsRes, holidaysRes, unitTypesRes, insuranceRes, deferralsRes] = await Promise.all([
      supabase.from('salary_changes').select('*').eq('employee_id', emp.id).order('effective_date', { ascending: true }),
      supabase.from('employee_units').select('*').eq('employee_id', emp.id).eq('user_id', emp.user_id).gte('date', monthStartStr).lte('date', monthEndStr),
      supabase.from('holidays').select('*').eq('user_id', emp.user_id).gte('date', monthStartStr).lte('date', monthEndStr),
      supabase.from('unit_types').select('*').eq('user_id', emp.user_id),
      supabase.from('insurance_list').select('*').eq('user_id', emp.user_id).gte('date', monthStartStr).lte('date', monthEndStr),
      supabase.from('salary_deferrals').select('*').eq('employee_id', emp.id).in('month', [month, prevMonth])
    ]);

    const allSalaryChanges = salChangesRes.data || [];
    const empUnits = unitsRes.data || [];
    const holidays = holidaysRes.data || [];
    const unitTypeDefs = unitTypesRes.data || [];
    const insuranceRecords = insuranceRes.data || [];
    const allDeferrals = deferralsRes.data || [];

    // Build helpers
    const additionTypes = new Set(unitTypeDefs.filter(ut => ut.direction === 'addition').map(ut => ut.name));
    const isAddition = (type) => additionTypes.has(type);
    const holidayDaySet = new Set(holidays.map(h => new Date(h.date).getDate()));
    const totalWorkingDays = countWorkingDays(year, monthNum, 1, daysInMonth, holidayDaySet);

    const insuranceByPersonalId = {};
    for (const rec of insuranceRecords) {
      if (rec.personal_id) insuranceByPersonalId[String(rec.personal_id).trim()] = parseFloat(rec.amount1) || 0;
    }

    let weekendCount = 0;
    for (let d = 1; d <= daysInMonth; d++) { if (isWeekend(year, monthNum, d)) weekendCount++; }

    const currentDeferral = allDeferrals.find(d => d.month === month) || null;
    const prevDeferral = allDeferrals.find(d => d.month === prevMonth);
    const isDeferred = !!currentDeferral;
    const carryOver = prevDeferral ? parseFloat(prevDeferral.deferred_amount) : 0;

    const totalDeductions = empUnits.filter(u => !isAddition(u.type)).reduce((s, u) => s + parseFloat(u.amount), 0);
    const totalAdditions = empUnits.filter(u => isAddition(u.type)).reduce((s, u) => s + parseFloat(u.amount), 0);
    const insuranceDeduction = emp.personal_id ? (insuranceByPersonalId[String(emp.personal_id).trim()] || 0) : 0;

    const startDate = new Date(emp.start_date);
    const endDate = emp.end_date ? new Date(emp.end_date) : null;

    // Employee not active this month
    if (startDate > monthEnd || (endDate && endDate < monthStart)) {
      return res.json({ month, working_days: totalWorkingDays, weekend_days: weekendCount, days_worked: 0, accrued_salary: 0, total_additions: totalAdditions, total_deductions: totalDeductions, insurance_deduction: insuranceDeduction, carry_over: carryOver, is_deferred: isDeferred, net_salary: 0, units: empUnits });
    }

    let effectiveStart = 1;
    if (startDate >= monthStart && startDate <= monthEnd) effectiveStart = startDate.getDate();
    let effectiveEnd = daysInMonth;
    if (endDate && endDate >= monthStart && endDate <= monthEnd) effectiveEnd = endDate.getDate();

    const daysWorked = countWorkingDays(year, monthNum, effectiveStart, effectiveEnd, holidayDaySet);

    // Salary calculation (same logic as salaries.js)
    const changesBefore = allSalaryChanges.filter(sc => sc.effective_date <= monthStartStr);
    const changesInMonth = allSalaryChanges.filter(sc => sc.effective_date > monthStartStr && sc.effective_date <= monthEndStr);
    const changesAfter = allSalaryChanges.filter(sc => sc.effective_date > monthEndStr);

    let baseSalary;
    if (changesBefore.length > 0) baseSalary = parseFloat(changesBefore[changesBefore.length - 1].new_salary);
    else if (changesInMonth.length > 0) baseSalary = parseFloat(changesInMonth[0].old_salary);
    else if (changesAfter.length > 0) baseSalary = parseFloat(changesAfter[0].old_salary);
    else baseSalary = parseFloat(emp.salary);

    let accruedSalary;
    if (changesInMonth.length > 0) {
      accruedSalary = 0;
      let currentSalary = baseSalary;
      let periodStart = effectiveStart;
      for (const change of changesInMonth) {
        const changeDay = parseInt(change.effective_date.split('-')[2], 10);
        if (changeDay >= periodStart && changeDay <= effectiveEnd) {
          const periodDays = countWorkingDays(year, monthNum, periodStart, changeDay - 1, holidayDaySet);
          accruedSalary += (totalWorkingDays > 0 ? currentSalary / totalWorkingDays : 0) * periodDays;
          currentSalary = parseFloat(change.new_salary);
          periodStart = changeDay;
        }
      }
      const remainingDays = countWorkingDays(year, monthNum, periodStart, effectiveEnd, holidayDaySet);
      accruedSalary += (totalWorkingDays > 0 ? currentSalary / totalWorkingDays : 0) * remainingDays;
    } else {
      accruedSalary = (totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0) * daysWorked;
    }

    const roundedAccrued = Math.round(accruedSalary * 100) / 100;
    const effectiveAccrued = isDeferred ? 0 : roundedAccrued;
    const netSalary = Math.round((effectiveAccrued + totalAdditions + carryOver - totalDeductions - insuranceDeduction) * 100) / 100;

    res.json({
      month,
      working_days: totalWorkingDays,
      weekend_days: weekendCount,
      holiday_days: holidayDaySet.size,
      days_worked: daysWorked,
      base_salary: baseSalary,
      accrued_salary: effectiveAccrued,
      original_accrued: roundedAccrued,
      total_additions: totalAdditions,
      total_deductions: totalDeductions,
      insurance_deduction: insuranceDeduction,
      carry_over: carryOver,
      is_deferred: isDeferred,
      net_salary: netSalary,
      units: empUnits.map(u => ({ ...u, is_addition: isAddition(u.type) }))
    });
  } catch (err) {
    console.error('Portal payroll error:', err);
    res.status(500).json({ error: 'Failed to calculate payroll' });
  }
});

// GET /api/portal/documents
router.get('/documents', authenticatePortalEmployee, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('id, name, file_url, file_type, file_size, created_at')
      .eq('employee_id', req.employeeId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch documents' });
    res.json({ documents: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/portal/documents
router.post('/documents', authenticatePortalEmployee, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { name } = req.body;
    const ext = req.file.originalname.split('.').pop();
    const fileName = `portal/${req.employeeId}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (uploadError) return res.status(500).json({ error: 'Storage upload failed' });

    const { data: urlData } = supabase.storage.from('employee-documents').getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: req.employeeId,
        name: (name || req.file.originalname).trim(),
        file_url: urlData.publicUrl,
        file_type: req.file.mimetype,
        file_size: req.file.size
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to save document record' });
    res.status(201).json({ document: data });
  } catch (err) {
    console.error('Portal document upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
