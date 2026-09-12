const supabase = require('../config/supabase');
const { sendNotificationEmail } = require('../utils/mailer');

// Single place that creates in-app notifications (app_notifications) and,
// best-effort, emails each recipient about the same event. Email failures
// (missing SMTP config, bad address, etc.) are logged and swallowed — they
// must never block the in-app notification, which is the source of truth.
async function createNotifications(user_id, recipient_emails, type, title, body, reference_id) {
  const unique = [...new Set((recipient_emails || []).filter(Boolean))];
  if (unique.length === 0) return;

  try {
    await supabase.from('app_notifications').insert(
      unique.map(email => ({ user_id, recipient_email: email, type, title, body: body || null, reference_id: reference_id || null }))
    );
  } catch (err) {
    console.error('createNotifications insert error:', err.message);
  }

  try {
    const [{ data: users }, ownerResult] = await Promise.all([
      supabase.from('app_users').select('name, email').eq('user_id', user_id).in('email', unique),
      supabase.auth.admin.getUserById(user_id),
    ]);
    const nameByEmail = {};
    (users || []).forEach(u => { if (u.email) nameByEmail[u.email] = u.name; });
    const companyName = ownerResult?.data?.user?.user_metadata?.company_name || 'Datum';
    const actionUrl = process.env.FRONTEND_URL || undefined;

    await Promise.all(unique.map(email =>
      sendNotificationEmail({
        toEmail: email,
        toName: nameByEmail[email] || null,
        title,
        body,
        companyName,
        actionUrl,
      }).catch(err => console.error(`notification email to ${email} failed:`, err.message))
    ));
  } catch (err) {
    console.error('createNotifications email step error:', err.message);
  }
}

module.exports = { createNotifications };
