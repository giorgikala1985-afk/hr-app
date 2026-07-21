const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendSigningInvite({ toEmail, toName, signUrl, companyName }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: `"${companyName || 'Finpilot'}" <${from}>`,
    to: toEmail,
    subject: 'Please sign your Employment Agreement',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #1e293b;">Employment Agreement – Action Required</h2>
        <p>Hi ${toName || 'there'},</p>
        <p>
          Your employer has sent you an employment agreement to review and sign.
          Please click the button below to read and sign your agreement online.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${signUrl}"
             style="background:#3185FC;color:white;padding:14px 28px;border-radius:8px;
                    text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
            Review &amp; Sign Agreement
          </a>
        </div>
        <p style="font-size:13px;color:#64748b;">
          Or copy this link into your browser:<br/>
          <a href="${signUrl}" style="color:#3185FC;">${signUrl}</a>
        </p>
        <p style="font-size:13px;color:#94a3b8;">
          This link is unique to you. Do not share it with others.
        </p>
      </div>
    `,
  });
}

// Send an invoice with a PDF attachment (and an optional extra file) to the client.
async function sendInvoiceEmail({ toEmail, toName, invoice, pdfBuffer, companyName, extraAttachment }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const cur = invoice.currency || '';
  const total = Number(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const attachments = [{
    filename: `${invoice.invoice_number || 'invoice'}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf',
  }];
  if (extraAttachment) attachments.push(extraAttachment);
  await transporter.sendMail({
    from: `"${companyName || 'Finpilot'}" <${from}>`,
    to: toEmail,
    subject: `Invoice ${invoice.invoice_number || ''} from ${companyName || 'Finpilot'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <h2 style="color:#1e293b;">Invoice ${invoice.invoice_number || ''}</h2>
        <p>Hi ${toName || 'there'},</p>
        <p>Please find attached invoice <strong>${invoice.invoice_number || ''}</strong>
           for <strong>${total} ${cur}</strong>${invoice.due_date ? `, due <strong>${new Date(invoice.due_date).toLocaleDateString('en-GB')}</strong>` : ''}.</p>
        ${invoice.notes ? `<p style="font-size:13px;color:#475569;">${invoice.notes}</p>` : ''}
        <p style="font-size:13px;color:#94a3b8;">Thank you for your business.<br/>${companyName || 'Finpilot'}</p>
      </div>
    `,
    attachments,
  });
}

module.exports = { sendSigningInvite, sendInvoiceEmail };
