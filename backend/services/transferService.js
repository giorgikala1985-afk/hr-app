const supabase = require('../config/supabase');

async function getApproverEmails(user_id) {
  try {
    const { data: matrixRows } = await supabase.from('user_matrix')
      .select('role').eq('user_id', user_id).neq('approve_transfer', 'No');
    const roles = [...new Set((matrixRows || []).map(r => r.role).filter(Boolean))];
    if (roles.length === 0) return [];
    const { data: users } = await supabase.from('app_users')
      .select('email').eq('user_id', user_id).in('rights', roles);
    return (users || []).map(u => u.email).filter(Boolean);
  } catch { return []; }
}

async function getMainUserEmail(user_id) {
  try {
    const result = await supabase.auth.admin.getUserById(user_id);
    return result?.data?.user?.email || null;
  } catch { return null; }
}

async function createNotifications(user_id, recipient_emails, type, title, body, reference_id) {
  try {
    const unique = [...new Set((recipient_emails || []).filter(Boolean))];
    if (unique.length === 0) return;
    await supabase.from('app_notifications').insert(
      unique.map(email => ({ user_id, recipient_email: email, type, title, body: body || null, reference_id: reference_id || null }))
    );
  } catch (err) { console.error('createNotifications error:', err.message); }
}

// Shared by POST /api/accounting/transfers (browser) and the Telegram bot's
// "transfer" action — keeps the insert + approver-notification logic in one place.
async function createTransferRecord(userId, requesterName, requesterEmail, fields) {
  const { client_name, agent_id, amount, due_date, description, status, invoice_raw, iban, invoice_number, auto_approved } = fields;

  const { data, error } = await supabase.from('accounting_transfers').insert([{
    user_id: userId, client_name, agent_id: agent_id || null,
    amount: parseFloat(amount), due_date, description,
    iban: iban || null, invoice_number: invoice_number || null,
    status: status || 'normal',
    requester_name: requesterName,
    requester_email: requesterEmail,
    approval_status: auto_approved ? 'approved' : 'pending',
    invoice_raw: invoice_raw || null,
  }]).select().single();
  if (error) throw error;

  const [approverEmails, mainEmail] = await Promise.all([
    getApproverEmails(userId),
    getMainUserEmail(userId),
  ]);
  const recipients = [...new Set([...approverEmails, mainEmail])].filter(e => e && e !== requesterEmail);
  await createNotifications(
    userId, recipients, 'transfer_submitted',
    '📤 New Transfer Request',
    `${requesterName} submitted a transfer for ${client_name} — ${parseFloat(amount).toLocaleString()}`,
    data.id
  );

  return data;
}

module.exports = { createTransferRecord };
