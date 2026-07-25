const supabase = require('../config/supabase');

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

module.exports = { createEmployeeRecord, setEmployeeEndDate };
