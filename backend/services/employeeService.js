const supabase = require('../config/supabase');
const crypto = require('crypto');

// Reserved unit type names the app itself creates via hardcoded flows
// (Advance Payment order, OT/overtime entries). If a tenant has never
// explicitly registered these in Unit Types, payroll silently drops them
// from totals (not addition, not deduction) -- so auto-register them with
// their known correct direction the first time they're used.
const RESERVED_UNIT_DIRECTIONS = {
  'advance': 'deduction',
  'ot': 'addition',
  'overtime': 'addition',
};
async function ensureUnitTypeRegistered(userId, type) {
  const direction = RESERVED_UNIT_DIRECTIONS[String(type || '').toLowerCase().trim()];
  if (!direction) return;
  const { data: existing } = await supabase
    .from('unit_types')
    .select('id')
    .eq('user_id', userId)
    .eq('name', type)
    .maybeSingle();
  if (!existing) {
    await supabase.from('unit_types').insert({ user_id: userId, name: type, direction }).catch(() => {});
  }
}

// Shared by the POST /api/employees route (browser, with photo upload) and
// the Telegram bot's "hire" action (no photo) — keeps the DB insert +
// auto-bookkeeping-entry logic in one place.
async function createEmployeeRecord(userId, fields, photo_url = null) {
  const {
    first_name, last_name, personal_id, birthdate, position, salary, salary_currency,
    overtime_rate, start_date, end_date, account_number, tax_code, pension,
    personal_email, mobile_number, department, pit_rate,
  } = fields;

  if (!first_name || !last_name || !personal_id || !birthdate || !position || !salary || !start_date) {
    throw new Error('All fields are required (end date is optional)');
  }

  const { data, error } = await supabase
    .from('employees')
    .insert({
      user_id: userId,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      personal_id: personal_id.trim(),
      birthdate,
      position: position.trim(),
      salary: parseFloat(salary),
      salary_currency: ['GEL', 'USD', 'EUR'].includes(salary_currency) ? salary_currency : 'GEL',
      overtime_rate: overtime_rate ? parseFloat(overtime_rate) : 0,
      start_date,
      end_date: end_date || null,
      account_number: account_number ? String(account_number).trim() : null,
      tax_code: tax_code ? String(tax_code).trim() : null,
      pension: pension === 'true' || pension === true,
      personal_email: personal_email ? personal_email.trim() : null,
      mobile_number: mobile_number ? mobile_number.trim() : null,
      department: department ? department.trim() : null,
      pit_rate: pit_rate ? parseInt(pit_rate) : 20,
      photo_url,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating employee:', error);
    throw new Error('Failed to create employee');
  }

  // Look up bookkeeping accounts by code
  const { data: accs } = await supabase
    .from('bookkeeping_accounts')
    .select('code, name')
    .eq('user_id', userId)
    .in('code', ['3130', '1210']);

  const accMap = {};
  (accs || []).forEach(a => { accMap[a.code] = `${a.code} - ${a.name}`; });

  const debitAccount = accMap['3130'] || '3130';
  const creditAccount = accMap['1210'] || '1210';
  const description = `თანამშრომელი: ${first_name.trim()} ${last_name.trim()}`;

  const bookkeepingEntries = [
    { user_id: userId, transaction_id: data.id, date: start_date, description, account: debitAccount, debit: parseFloat(salary), credit: 0 },
    { user_id: userId, transaction_id: data.id, date: start_date, description, account: creditAccount, debit: 0, credit: parseFloat(salary) },
  ];

  const { data: bookkeepingData, error: bookkeepingError } = await supabase
    .from('bookkeeping_entries')
    .insert(bookkeepingEntries)
    .select();

  if (bookkeepingError) console.error('Error creating bookkeeping entries:', bookkeepingError);

  return {
    employee: data,
    bookkeeping: bookkeepingError ? { success: false, error: bookkeepingError.message } : { success: true, entries: bookkeepingData },
  };
}

async function setEmployeeEndDate(userId, employeeId, endDate) {
  const { data, error } = await supabase
    .from('employees')
    .update({ end_date: endDate || null, updated_at: new Date().toISOString() })
    .eq('id', employeeId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Employee not found');
  return data;
}

// Shared by POST /api/employees/:id/units and the Telegram bot's
// "adjusting"/"advance" actions — inserts the unit row and auto-posts to
// bookkeeping if a matching posting rule exists.
async function createEmployeeUnit(userId, employeeId, fields) {
  const { type, amount, date, currency, include_in_salary, note, created_by_name } = fields;
  if (!type || amount === undefined || !date) {
    throw new Error('Type, amount, and date are required');
  }

  await ensureUnitTypeRegistered(userId, type);

  const { data, error } = await supabase
    .from('employee_units')
    .insert({
      user_id: userId,
      employee_id: employeeId,
      type,
      amount: parseFloat(amount),
      date,
      currency: currency || 'GEL',
      include_in_salary: include_in_salary !== false,
      note: note || null,
      created_by_name: created_by_name || null,
    })
    .select()
    .single();

  if (error) throw error;

  try {
    const { data: rule } = await supabase
      .from('posting_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('document_type', type)
      .eq('is_active', true)
      .maybeSingle();

    if (rule) {
      const { data: emp } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('id', employeeId)
        .single();
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : '';
      const rawTemplate = rule.description_template || `${type} - {{employee}}`;
      const description = rawTemplate.replace(/\{\{employee\}\}/g, empName);
      const txId = crypto.randomUUID();
      const amt = parseFloat(amount);
      await supabase.from('bookkeeping_entries').insert([
        { user_id: userId, transaction_id: txId, date, description, account: rule.debit_account, debit: amt, credit: 0 },
        { user_id: userId, transaction_id: txId, date, description, account: rule.credit_account, debit: 0, credit: amt },
      ]);
    }
  } catch (autoPostErr) {
    console.error('Auto-post error:', autoPostErr.message);
  }

  return data;
}

// Shared by POST /api/employees/:id/salary-changes and the Telegram bot's
// "promotion" action — logs the change and updates the employee's live salary.
async function recordSalaryChange(userId, employeeId, fields) {
  const { salary, overtime_rate, effective_date, note } = fields;
  if (!salary || !effective_date) {
    throw new Error('Salary and effective date are required');
  }

  const { data: emp } = await supabase
    .from('employees')
    .select('id, salary, overtime_rate')
    .eq('id', employeeId)
    .eq('user_id', userId)
    .single();
  if (!emp) throw new Error('Employee not found');

  const { data, error } = await supabase
    .from('salary_changes')
    .insert({
      employee_id: employeeId,
      old_salary: emp.salary,
      new_salary: parseFloat(salary),
      old_overtime_rate: emp.overtime_rate,
      new_overtime_rate: overtime_rate ? parseFloat(overtime_rate) : emp.overtime_rate,
      effective_date,
      note: note ? note.trim() : null,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('employees')
    .update({
      salary: parseFloat(salary),
      overtime_rate: overtime_rate ? parseFloat(overtime_rate) : emp.overtime_rate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId)
    .eq('user_id', userId);

  return data;
}

// Telegram bot's "promotion" action also updates the employee's position —
// there's no dedicated HTTP route for this alone (the browser's Edit Employee
// form does a full PUT), so this is Telegram-only for now.
async function updateEmployeePosition(userId, employeeId, position) {
  if (!position) return;
  const { error } = await supabase
    .from('employees')
    .update({ position: String(position).trim(), updated_at: new Date().toISOString() })
    .eq('id', employeeId)
    .eq('user_id', userId);
  if (error) throw error;
}

module.exports = {
  createEmployeeRecord, setEmployeeEndDate, createEmployeeUnit,
  recordSalaryChange, updateEmployeePosition,
};
