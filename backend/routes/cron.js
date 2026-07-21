const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { generateInvoicePdf } = require('../utils/invoicePdf');
const { sendInvoiceEmail } = require('../utils/mailer');

function addPeriod(dateStr, recurrence) {
  if (!dateStr || !recurrence || recurrence === 'none') return null;
  const d = new Date(dateStr);
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString().slice(0, 10);
}

// Generate + send due recurring invoices. Triggered by an external scheduler (e.g. cron-job.org).
// Auth: ?key=CRON_SECRET  or  header x-cron-key: CRON_SECRET
router.all('/run-invoices', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const key = req.headers['x-cron-key'] || req.query.key;
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET not configured.' });
  if (key !== secret) return res.status(401).json({ error: 'Unauthorized.' });

  const today = new Date().toISOString().slice(0, 10);
  const results = { processed: 0, sent: 0, errors: [] };

  try {
    // One-time scheduled invoices (e.g. "send on the last working day of the
    // month" set from a project's Invoices tab) -- generate no new instance,
    // just send the existing draft and mark it sent.
    const { data: scheduled, error: schedErr } = await supabase.from('accounting_invoices')
      .select('*')
      .neq('status', 'sent')
      .eq('auto_send', true)
      .not('scheduled_send_date', 'is', null)
      .lte('scheduled_send_date', today);
    if (schedErr) throw schedErr;

    for (const inv of (scheduled || [])) {
      results.processed++;
      try {
        let companyName = 'Finpilot';
        try {
          const { data } = await supabase.auth.admin.getUserById(inv.user_id);
          companyName = data?.user?.user_metadata?.company_name || companyName;
        } catch {}
        const pdfBuffer = await generateInvoicePdf(inv, { name: companyName });
        const extraAttachment = inv.attachment_data
          ? { filename: inv.attachment_name || 'attachment', content: Buffer.from(inv.attachment_data.split(',').pop(), 'base64') }
          : null;
        await sendInvoiceEmail({ toEmail: inv.client_email, toName: inv.client, invoice: inv, pdfBuffer, companyName, extraAttachment });
        await supabase.from('accounting_invoices')
          .update({ status: 'sent', last_sent_at: new Date().toISOString() })
          .eq('id', inv.id);
        results.sent++;
      } catch (e) {
        results.errors.push({ id: inv.id, error: e.message });
      }
    }

    const { data: due, error } = await supabase.from('accounting_invoices')
      .select('*')
      .neq('recurrence', 'none')
      .eq('recurring_active', true)
      .eq('auto_send', true)
      .lte('next_run', today);
    if (error) throw error;

    for (const src of (due || [])) {
      results.processed++;
      try {
        let companyName = 'Finpilot';
        try {
          const { data } = await supabase.auth.admin.getUserById(src.user_id);
          companyName = data?.user?.user_metadata?.company_name || companyName;
        } catch {}

        // New invoice instance for this period.
        const offsetDays = (src.due_date && src.date)
          ? Math.round((new Date(src.due_date) - new Date(src.date)) / 86400000) : null;
        const newDue = offsetDays != null
          ? new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10) : null;

        const newInvoice = {
          user_id: src.user_id,
          client: src.client,
          client_email: src.client_email,
          invoice_number: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
          date: today,
          due_date: newDue,
          currency: src.currency,
          status: 'sent',
          notes: src.notes,
          account_number: src.account_number,
          items: src.items,
          total: src.total,
          recurrence: 'none',
          auto_send: false,
          recurring_active: false,
          recurring_source_id: src.id,
          last_sent_at: new Date().toISOString(),
        };

        const { data: created, error: insErr } = await supabase
          .from('accounting_invoices').insert([newInvoice]).select().single();
        if (insErr) throw insErr;

        const pdfBuffer = await generateInvoicePdf(created, { name: companyName });
        await sendInvoiceEmail({ toEmail: created.client_email, toName: created.client, invoice: created, pdfBuffer, companyName });
        results.sent++;
      } catch (e) {
        results.errors.push({ id: src.id, error: e.message });
      } finally {
        // Always advance the schedule so a failure can't cause a retry storm.
        const nextRun = addPeriod(src.next_run || today, src.recurrence);
        await supabase.from('accounting_invoices')
          .update({ next_run: nextRun, last_sent_at: new Date().toISOString() })
          .eq('id', src.id);
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Cron run-invoices error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
