const supabase = require('../config/supabase');
const { sendNotificationEmail } = require('../utils/mailer');
const { sendMessage: sendWhatsAppMessage } = require('../utils/whatsapp');

// Single place that creates in-app notifications (app_notifications) and,
// best-effort, emails + WhatsApps each recipient about the same event.
// Email/WhatsApp failures (missing config, bad address, not linked, etc.)
// are logged and swallowed — they must never block the in-app notification,
// which is the source of truth.
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

  let nameByEmail = {};
  let companyName = 'Datum';
  try {
    const [{ data: users }, ownerResult] = await Promise.all([
      supabase.from('app_users').select('id, name, email, rights').eq('user_id', user_id).in('email', unique),
      supabase.auth.admin.getUserById(user_id),
    ]);
    (users || []).forEach(u => { if (u.email) nameByEmail[u.email] = u.name; });
    companyName = ownerResult?.data?.user?.user_metadata?.company_name || 'Datum';
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

    // WhatsApp: only for recipients who are (a) a known team member with a
    // role that opted into this event type in the Notification Matrix, and
    // (b) have personally linked their own WhatsApp number (Options →
    // WhatsApp). The tenant owner isn't covered here — their WhatsApp
    // number, if any, is the shared bot number, a different concept.
    const appUsers = users || [];
    if (appUsers.length > 0) {
      const [{ data: matrixRows }, { data: links }] = await Promise.all([
        supabase.from('notification_matrix').select('role, ' + type).eq('user_id', user_id),
        supabase.from('whatsapp_links').select('app_user_id, wa_id')
          .eq('user_id', user_id).eq('status', 'linked')
          .in('app_user_id', appUsers.map(u => u.id)),
      ]);
      const waIdByAppUserId = {};
      (links || []).forEach(l => { if (l.app_user_id && l.wa_id) waIdByAppUserId[l.app_user_id] = l.wa_id; });
      const matrixByRole = {};
      (matrixRows || []).forEach(r => { matrixByRole[r.role] = r; });

      await Promise.all(appUsers.map(u => {
        const wantsWhatsApp = matrixByRole[u.rights]?.[type] === 'Yes';
        const waId = waIdByAppUserId[u.id];
        if (!wantsWhatsApp || !waId) return null;
        const text = `*${title}*\n${body || ''}`;
        return sendWhatsAppMessage(waId, text).catch(err => console.error(`notification WhatsApp to ${u.email} failed:`, err.message));
      }));
    }
  } catch (err) {
    console.error('createNotifications channel step error:', err.message);
  }
}

module.exports = { createNotifications };
