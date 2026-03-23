const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const {
  getAccounts,
  getAccountStatements,
  initiateTransfer,
  getTransferStatus,
  initiateBulkTransfer,
} = require('../config/tbcpay');

// ── TBC BANK SETTINGS ─────────────────────────────────
// Get saved bank settings for this user
router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tbc_bank_settings')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ settings: data || null });
  } catch (err) {
    console.error('TBC settings fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bank settings' });
  }
});

// Save/update bank settings
router.put('/settings', async (req, res) => {
  try {
    const { company_iban, company_name, default_currency } = req.body;

    if (!company_iban) {
      return res.status(400).json({ error: 'Company IBAN is required' });
    }

    const { data: existing } = await supabase
      .from('tbc_bank_settings')
      .select('id')
      .eq('user_id', req.userId)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('tbc_bank_settings')
        .update({
          company_iban,
          company_name: company_name || null,
          default_currency: default_currency || 'GEL',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', req.userId)
        .select()
        .single();
    } else {
      result = await supabase
        .from('tbc_bank_settings')
        .insert([{
          user_id: req.userId,
          company_iban,
          company_name: company_name || null,
          default_currency: default_currency || 'GEL',
        }])
        .select()
        .single();
    }

    if (result.error) throw result.error;
    res.json({ settings: result.data });
  } catch (err) {
    console.error('TBC settings save error:', err.message);
    res.status(500).json({ error: 'Failed to save bank settings' });
  }
});

// ── ACCOUNTS ──────────────────────────────────────────
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await getAccounts();
    res.json({ accounts });
  } catch (err) {
    console.error('TBC accounts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bank accounts: ' + err.message });
  }
});

// ── BANK STATEMENTS ──────────────────────────────────
router.get('/statements', async (req, res) => {
  try {
    const { accountId, dateFrom, dateTo } = req.query;

    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const statements = await getAccountStatements({ accountId, dateFrom, dateTo });
    res.json({ statements });
  } catch (err) {
    console.error('TBC statements error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bank statements: ' + err.message });
  }
});

// Import bank statements into accounting_transactions
router.post('/statements/import', async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions provided' });
    }

    const rows = transactions.map(tx => ({
      user_id: req.userId,
      date: tx.date,
      client: tx.creditorName || tx.debtorName || 'Unknown',
      item_type: tx.amount > 0 ? 'Income' : 'Expense',
      amount: Math.abs(tx.amount),
      note: tx.description || tx.remittanceInformation || '',
    }));

    const { data, error } = await supabase
      .from('accounting_transactions')
      .insert(rows)
      .select();

    if (error) throw error;
    res.status(201).json({ imported: data.length });
  } catch (err) {
    console.error('Statement import error:', err.message);
    res.status(500).json({ error: 'Failed to import statements: ' + err.message });
  }
});

// ── SALARY PAYMENTS (Bulk Transfer) ──────────────────
router.post('/salary-payment', async (req, res) => {
  try {
    const { month, employeePayments } = req.body;

    if (!month || !Array.isArray(employeePayments) || employeePayments.length === 0) {
      return res.status(400).json({ error: 'Month and employee payments are required' });
    }

    // Get company IBAN from settings
    const { data: settings } = await supabase
      .from('tbc_bank_settings')
      .select('company_iban, company_name')
      .eq('user_id', req.userId)
      .single();

    if (!settings || !settings.company_iban) {
      return res.status(400).json({ error: 'Company IBAN not configured. Please set up TBC Bank settings first.' });
    }

    // Build payment list
    const payments = employeePayments
      .filter(ep => ep.amount > 0 && ep.iban)
      .map(ep => ({
        creditorIban: ep.iban,
        creditorName: ep.employeeName,
        amount: ep.amount,
        currency: ep.currency || 'GEL',
        description: `Salary ${month} - ${ep.employeeName}`,
      }));

    if (payments.length === 0) {
      return res.status(400).json({ error: 'No valid payments to process. Check employee IBANs and amounts.' });
    }

    // Initiate bulk transfer via TBC
    const result = await initiateBulkTransfer({
      debtorIban: settings.company_iban,
      payments,
    });

    // Save salary payment record
    const { data: record, error: saveError } = await supabase
      .from('salary_payments')
      .insert([{
        user_id: req.userId,
        month,
        total_amount: payments.reduce((sum, p) => sum + p.amount, 0),
        employee_count: payments.length,
        tbc_payment_id: result.paymentId || result.bulkPaymentId || null,
        status: 'initiated',
        payment_details: payments,
      }])
      .select()
      .single();

    if (saveError) throw saveError;

    res.json({
      payment: record,
      tbcResult: result,
      message: `Salary payment initiated for ${payments.length} employees`,
    });
  } catch (err) {
    console.error('Salary payment error:', err.message);
    res.status(500).json({ error: 'Failed to process salary payment: ' + err.message });
  }
});

// Get salary payment history
router.get('/salary-payments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('salary_payments')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ records: data || [] });
  } catch (err) {
    console.error('Salary payments fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch salary payments' });
  }
});

// Check salary payment status
router.get('/salary-payments/:id/status', async (req, res) => {
  try {
    const { data: record, error } = await supabase
      .from('salary_payments')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error) throw error;

    if (record.tbc_payment_id) {
      const statusResult = await getTransferStatus(record.tbc_payment_id);
      const newStatus = statusResult.status === 'Completed' ? 'completed'
        : statusResult.status === 'Failed' ? 'failed'
        : 'initiated';

      if (newStatus !== record.status) {
        await supabase
          .from('salary_payments')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', record.id);
        record.status = newStatus;
      }

      res.json({ payment: record, tbcStatus: statusResult });
    } else {
      res.json({ payment: record });
    }
  } catch (err) {
    console.error('Payment status error:', err.message);
    res.status(500).json({ error: 'Failed to check payment status: ' + err.message });
  }
});

// ── INVOICE PAYMENT (Single Transfer) ────────────────
router.post('/pay-invoice', async (req, res) => {
  try {
    const { invoiceId, creditorIban, creditorName, amount, currency, description } = req.body;

    if (!creditorIban || !amount) {
      return res.status(400).json({ error: 'Creditor IBAN and amount are required' });
    }

    // Get company IBAN
    const { data: settings } = await supabase
      .from('tbc_bank_settings')
      .select('company_iban')
      .eq('user_id', req.userId)
      .single();

    if (!settings || !settings.company_iban) {
      return res.status(400).json({ error: 'Company IBAN not configured. Please set up TBC Bank settings first.' });
    }

    // Initiate transfer
    const result = await initiateTransfer({
      debtorIban: settings.company_iban,
      creditorIban,
      creditorName: creditorName || 'Unknown',
      amount: parseFloat(amount),
      currency: currency || 'GEL',
      description: description || 'Invoice Payment',
    });

    // Update invoice status if invoiceId provided
    if (invoiceId) {
      await supabase
        .from('accounting_invoices')
        .update({
          status: 'paid',
          tbc_payment_id: result.paymentId || null,
        })
        .eq('id', invoiceId)
        .eq('user_id', req.userId);
    }

    res.json({
      result,
      message: `Payment of ${amount} ${currency || 'GEL'} initiated to ${creditorName || creditorIban}`,
    });
  } catch (err) {
    console.error('Invoice payment error:', err.message);
    res.status(500).json({ error: 'Failed to pay invoice: ' + err.message });
  }
});

// ── TRANSFER STATUS ──────────────────────────────────
router.get('/transfer-status/:paymentId', async (req, res) => {
  try {
    const status = await getTransferStatus(req.params.paymentId);
    res.json({ status });
  } catch (err) {
    console.error('Transfer status error:', err.message);
    res.status(500).json({ error: 'Failed to get transfer status: ' + err.message });
  }
});

module.exports = router;
