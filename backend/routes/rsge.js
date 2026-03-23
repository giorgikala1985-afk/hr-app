const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const rsge = require('../config/rsge');
let rsgePortal;
try { rsgePortal = require('../config/rsge_portal'); } catch (e) { console.warn('rsge_portal not available:', e.message); }

// ══════════════════════════════════════════════════════
// RS.GE PORTAL AUTOMATION (Browser-based declaration submission)
// ══════════════════════════════════════════════════════

// Login to RS.ge portal
router.post('/portal/login', async (req, res) => {
  try {
    if (!rsgePortal) return res.status(500).json({ error: 'Portal automation not available' });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Portal username and password required' });
    const result = await rsgePortal.startLogin(req.userId, { username, password });
    res.json(result);
  } catch (err) {
    console.error('Portal login error:', err.message);
    res.status(500).json({ error: 'Portal login failed: ' + err.message });
  }
});

// Submit 2FA code
router.post('/portal/verify-2fa', async (req, res) => {
  try {
    if (!rsgePortal) return res.status(500).json({ error: 'Portal automation not available' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Verification code required' });
    const result = await rsgePortal.submit2FACode(req.userId, code);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

// Check portal session status
router.get('/portal/status', async (req, res) => {
  if (!rsgePortal) return res.json({ status: 'not_available' });
  const result = await rsgePortal.getSessionStatus(req.userId);
  res.json(result);
});

// Submit declaration via portal
router.post('/portal/submit-declaration', async (req, res) => {
  try {
    if (!rsgePortal) return res.status(500).json({ error: 'Portal automation not available' });
    const { month } = req.body;
    if (!month) return res.status(400).json({ error: 'Month required' });

    // Fetch employees and calculate tax
    const { data: employees, error } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', req.userId);

    if (error) throw error;
    const eligible = (employees || []).filter(e => e.personal_id && e.salary);
    if (eligible.length === 0) return res.status(400).json({ error: 'No employees with personal IDs and salaries' });

    const empData = eligible.map(emp => {
      const gross = parseFloat(emp.salary) || 0;
      return {
        tin: emp.personal_id,
        name: `${emp.first_name} ${emp.last_name}`,
        grossSalary: gross,
        incomeTax: Math.round(gross * 0.20 * 100) / 100,
        pensionContrib: Math.round(gross * 0.02 * 100) / 100,
      };
    });

    const result = await rsgePortal.submitDeclaration(req.userId, { month, employees: empData });
    console.log('=== DECLARATION PAGE INFO ===');
    console.log(JSON.stringify(result.pageInfo, null, 2));
    console.log('=== END PAGE INFO ===');
    res.json(result);
  } catch (err) {
    console.error('Portal declaration error:', err.message);
    res.status(500).json({ error: 'Failed to submit declaration: ' + err.message });
  }
});

// Take screenshot of current portal page (for debugging)
router.get('/portal/screenshot', async (req, res) => {
  try {
    if (!rsgePortal) return res.status(500).json({ error: 'Portal automation not available' });
    const screenshot = await rsgePortal.takeScreenshot(req.userId);
    res.json({ screenshot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disconnect from portal
router.post('/portal/disconnect', async (req, res) => {
  if (!rsgePortal) return res.json({ message: 'Not connected' });
  await rsgePortal.closeSession(req.userId);
  res.json({ message: 'Portal session closed' });
});

// ══════════════════════════════════════════════════════
// RS.GE STATUS — check if credentials are configured
// ══════════════════════════════════════════════════════

router.get('/status', (req, res) => {
  res.json({ configured: rsge.isConfigured() });
});

router.get('/test-connection', async (req, res) => {
  try {
    const result = await rsge.testConnection();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════
// EMPLOYEE REGISTRATION
// ══════════════════════════════════════════════════════

// Check taxpayer info by TIN (personal ID)
router.get('/check-taxpayer/:tin', async (req, res) => {
  try {
    const result = await rsge.checkTaxpayer(req.params.tin);
    res.json({ result });
  } catch (err) {
    console.error('RS.ge check taxpayer error:', err.message);
    res.status(500).json({ error: 'Failed to check taxpayer: ' + err.message });
  }
});

// Register employee with RS.ge
router.post('/employees/register', async (req, res) => {
  try {
    const { employeeId } = req.body;

    // Fetch employee from DB
    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .eq('user_id', req.userId)
      .single();

    if (empError || !emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!emp.personal_id) {
      return res.status(400).json({ error: 'Employee has no personal ID (TIN)' });
    }

    const result = await rsge.registerEmployee({
      employeeTin: emp.personal_id,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      startDate: emp.start_date,
      position: emp.position || '',
      salary: parseFloat(emp.salary) || 0,
    });

    // Save registration record
    await supabase
      .from('rs_employee_registrations')
      .upsert({
        user_id: req.userId,
        employee_id: employeeId,
        personal_id: emp.personal_id,
        action: 'register',
        rs_response: result,
        status: 'registered',
        action_date: emp.start_date,
      }, { onConflict: 'employee_id,action' });

    res.json({ result, message: `${emp.first_name} ${emp.last_name} registered with RS.ge` });
  } catch (err) {
    console.error('RS.ge register error:', err.message);
    res.status(500).json({ error: 'Failed to register employee: ' + err.message });
  }
});

// Bulk register multiple employees
router.post('/employees/register-bulk', async (req, res) => {
  try {
    const { employeeIds } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'No employees selected' });
    }

    const { data: employees, error } = await supabase
      .from('employees')
      .select('*')
      .in('id', employeeIds)
      .eq('user_id', req.userId);

    if (error) throw error;

    const results = [];
    const errors = [];

    for (const emp of employees) {
      if (!emp.personal_id) {
        errors.push({ employee: `${emp.first_name} ${emp.last_name}`, error: 'No personal ID' });
        continue;
      }
      try {
        const result = await rsge.registerEmployee({
          employeeTin: emp.personal_id,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          startDate: emp.start_date,
          position: emp.position || '',
          salary: parseFloat(emp.salary) || 0,
        });

        await supabase
          .from('rs_employee_registrations')
          .upsert({
            user_id: req.userId,
            employee_id: emp.id,
            personal_id: emp.personal_id,
            action: 'register',
            rs_response: result,
            status: 'registered',
            action_date: emp.start_date,
          }, { onConflict: 'employee_id,action' });

        results.push({ employee: `${emp.first_name} ${emp.last_name}`, success: true });
      } catch (err) {
        errors.push({ employee: `${emp.first_name} ${emp.last_name}`, error: err.message });
      }
    }

    res.json({ registered: results.length, failed: errors.length, results, errors });
  } catch (err) {
    console.error('RS.ge bulk register error:', err.message);
    res.status(500).json({ error: 'Failed to bulk register: ' + err.message });
  }
});

// Deregister employee from RS.ge
router.post('/employees/deregister', async (req, res) => {
  try {
    const { employeeId, endDate, reason } = req.body;

    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .eq('user_id', req.userId)
      .single();

    if (empError || !emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (!emp.personal_id) {
      return res.status(400).json({ error: 'Employee has no personal ID (TIN)' });
    }

    const result = await rsge.deregisterEmployee({
      employeeTin: emp.personal_id,
      endDate: endDate || emp.end_date || new Date().toISOString().split('T')[0],
      reason: reason || 'Contract ended',
    });

    await supabase
      .from('rs_employee_registrations')
      .upsert({
        user_id: req.userId,
        employee_id: employeeId,
        personal_id: emp.personal_id,
        action: 'deregister',
        rs_response: result,
        status: 'deregistered',
        action_date: endDate || emp.end_date || new Date().toISOString().split('T')[0],
      }, { onConflict: 'employee_id,action' });

    res.json({ result, message: `${emp.first_name} ${emp.last_name} deregistered from RS.ge` });
  } catch (err) {
    console.error('RS.ge deregister error:', err.message);
    res.status(500).json({ error: 'Failed to deregister employee: ' + err.message });
  }
});

// Get RS.ge registered employees
router.get('/employees', async (req, res) => {
  try {
    const result = await rsge.getRegisteredEmployees();
    res.json({ employees: result });
  } catch (err) {
    console.error('RS.ge get employees error:', err.message);
    res.status(500).json({ error: 'Failed to fetch registered employees: ' + err.message });
  }
});

// Get local registration history
router.get('/employees/history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rs_employee_registrations')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ records: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registration history' });
  }
});

// ══════════════════════════════════════════════════════
// SALARY TAX DECLARATIONS
// ══════════════════════════════════════════════════════

// Submit salary tax declaration for a month
router.post('/declarations/salary', async (req, res) => {
  try {
    const { month } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month required in YYYY-MM format' });
    }

    // Fetch salary data for the month
    const salRes = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', req.userId);

    if (salRes.error) throw salRes.error;

    const employees = (salRes.data || []).filter(e => e.personal_id && e.salary);

    if (employees.length === 0) {
      return res.status(400).json({ error: 'No employees with personal IDs and salaries found' });
    }

    // Calculate tax for each employee (Georgian tax rates)
    const empDeclarations = employees.map(emp => {
      const grossSalary = parseFloat(emp.salary) || 0;
      const incomeTax = Math.round(grossSalary * 0.20 * 100) / 100;    // 20% income tax
      const pensionContrib = Math.round(grossSalary * 0.02 * 100) / 100; // 2% pension
      return {
        tin: emp.personal_id,
        name: `${emp.first_name} ${emp.last_name}`,
        grossSalary,
        incomeTax,
        pensionContrib,
        withheldTax: incomeTax,
      };
    });

    const result = await rsge.submitSalaryDeclaration({ month, employees: empDeclarations });

    // Save declaration record
    const { data: record, error: saveError } = await supabase
      .from('rs_declarations')
      .insert([{
        user_id: req.userId,
        type: 'salary',
        period: month,
        employee_count: empDeclarations.length,
        total_gross: empDeclarations.reduce((s, e) => s + e.grossSalary, 0),
        total_tax: empDeclarations.reduce((s, e) => s + e.incomeTax, 0),
        total_pension: empDeclarations.reduce((s, e) => s + e.pensionContrib, 0),
        rs_declaration_id: result?.DECLARATION_ID || null,
        status: 'submitted',
        details: empDeclarations,
      }])
      .select()
      .single();

    if (saveError) throw saveError;

    res.json({
      declaration: record,
      rsResult: result,
      message: `Tax declaration submitted for ${month} (${empDeclarations.length} employees)`,
    });
  } catch (err) {
    console.error('RS.ge declaration error:', err.message);
    res.status(500).json({ error: 'Failed to submit declaration: ' + err.message });
  }
});

// Get declaration history
router.get('/declarations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rs_declarations')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ records: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch declarations' });
  }
});

// Check declaration status
router.get('/declarations/:id/status', async (req, res) => {
  try {
    const { data: record, error } = await supabase
      .from('rs_declarations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error) throw error;

    if (record.rs_declaration_id) {
      const status = await rsge.getDeclarationStatus(record.rs_declaration_id);
      res.json({ declaration: record, rsStatus: status });
    } else {
      res.json({ declaration: record });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status: ' + err.message });
  }
});

// ══════════════════════════════════════════════════════
// WAYBILLS (ზედნადები)
// ══════════════════════════════════════════════════════

// Create waybill
router.post('/waybills', async (req, res) => {
  try {
    const { buyerTin, buyerName, startAddress, endAddress, driverTin, driverName, vehiclePlate, items, transportType, comment } = req.body;

    if (!buyerTin || !buyerName || !startAddress || !endAddress) {
      return res.status(400).json({ error: 'Buyer TIN, buyer name, start and end addresses are required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const result = await rsge.createWaybill({
      buyerTin, buyerName, startAddress, endAddress,
      driverTin: driverTin || '', driverName: driverName || '',
      vehiclePlate: vehiclePlate || '', items, transportType, comment,
    });

    // Save locally
    const { data: record, error: saveError } = await supabase
      .from('rs_waybills')
      .insert([{
        user_id: req.userId,
        rs_waybill_id: result?.WAYBILL_ID || result?.ID || null,
        buyer_tin: buyerTin,
        buyer_name: buyerName,
        start_address: startAddress,
        end_address: endAddress,
        driver_name: driverName || null,
        vehicle_plate: vehiclePlate || null,
        total_amount: items.reduce((s, it) => s + (it.quantity * it.price), 0),
        item_count: items.length,
        status: 'saved',
        details: { items, transportType, comment },
      }])
      .select()
      .single();

    if (saveError) throw saveError;

    res.json({ waybill: record, rsResult: result });
  } catch (err) {
    console.error('RS.ge create waybill error:', err.message);
    res.status(500).json({ error: 'Failed to create waybill: ' + err.message });
  }
});

// Activate waybill
router.post('/waybills/:id/activate', async (req, res) => {
  try {
    const { data: record, error } = await supabase
      .from('rs_waybills')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !record) return res.status(404).json({ error: 'Waybill not found' });
    if (!record.rs_waybill_id) return res.status(400).json({ error: 'Waybill has no RS.ge ID — it may not have been saved successfully on RS.ge. Delete and recreate it.' });

    const result = await rsge.activateWaybill(record.rs_waybill_id);

    await supabase.from('rs_waybills')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.json({ result, message: 'Waybill activated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate waybill: ' + err.message });
  }
});

// Close waybill
router.post('/waybills/:id/close', async (req, res) => {
  try {
    const { data: record, error } = await supabase
      .from('rs_waybills')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !record) return res.status(404).json({ error: 'Waybill not found' });

    const result = await rsge.closeWaybill(record.rs_waybill_id);

    await supabase.from('rs_waybills')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.json({ result, message: 'Waybill closed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to close waybill: ' + err.message });
  }
});

// Delete waybill
router.delete('/waybills/:id', async (req, res) => {
  try {
    const { data: record, error } = await supabase
      .from('rs_waybills')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !record) return res.status(404).json({ error: 'Waybill not found' });

    if (record.rs_waybill_id) {
      await rsge.deleteWaybill(record.rs_waybill_id);
    }

    await supabase.from('rs_waybills').delete().eq('id', req.params.id);

    res.json({ message: 'Waybill deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete waybill: ' + err.message });
  }
});

// Get waybill list (from RS.ge)
router.get('/waybills/rs', async (req, res) => {
  try {
    const { startDate, endDate, buyerTin, status } = req.query;
    const result = await rsge.getWaybillList({
      startDate: startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
      buyerTin, status,
    });
    res.json({ waybills: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch waybills from RS.ge: ' + err.message });
  }
});

// Get local waybill history (reads from local DB)
router.get('/waybills', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rs_waybills')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ records: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch waybills' });
  }
});

// ══════════════════════════════════════════════════════
// E-INVOICES (ელექტრონული ანგარიშ-ფაქტურა / VAT)
// ══════════════════════════════════════════════════════

// Create e-invoice
router.post('/einvoices', async (req, res) => {
  try {
    const { buyerTin, buyerName, invoiceDate, items, comment, localInvoiceId } = req.body;

    if (!buyerTin || !buyerName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Buyer TIN, buyer name, and items are required' });
    }

    const result = await rsge.createEInvoice({
      buyerTin, buyerName,
      invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
      items, comment,
    });

    // Save locally
    const totalAmount = items.reduce((s, it) => s + (it.quantity * it.price), 0);
    const totalVat = items.reduce((s, it) => s + (it.vatType === 2 ? 0 : it.quantity * it.price * 0.18), 0);

    const { data: record, error: saveError } = await supabase
      .from('rs_einvoices')
      .insert([{
        user_id: req.userId,
        rs_invoice_id: result?.INVOICE_ID || null,
        local_invoice_id: localInvoiceId || null,
        buyer_tin: buyerTin,
        buyer_name: buyerName,
        invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
        total_amount: totalAmount,
        total_vat: Math.round(totalVat * 100) / 100,
        item_count: items.length,
        status: 'created',
        details: { items, comment },
      }])
      .select()
      .single();

    if (saveError) throw saveError;

    // Link to local accounting invoice if provided
    if (localInvoiceId) {
      await supabase.from('accounting_invoices')
        .update({ rs_invoice_id: result?.INVOICE_ID || null })
        .eq('id', localInvoiceId)
        .eq('user_id', req.userId);
    }

    res.json({ einvoice: record, rsResult: result });
  } catch (err) {
    console.error('RS.ge create e-invoice error:', err.message);
    res.status(500).json({ error: 'Failed to create e-invoice: ' + err.message });
  }
});

// Get e-invoice list from RS.ge
router.get('/einvoices/rs', async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const result = await rsge.getEInvoiceList({
      startDate: startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
      status,
    });
    res.json({ einvoices: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch e-invoices from RS.ge: ' + err.message });
  }
});

// Get local e-invoice history
router.get('/einvoices', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rs_einvoices')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ records: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch e-invoices' });
  }
});

// Delete e-invoice
router.delete('/einvoices/:id', async (req, res) => {
  try {
    const { data: record, error } = await supabase
      .from('rs_einvoices')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !record) return res.status(404).json({ error: 'E-invoice not found' });

    if (record.rs_invoice_id) {
      await rsge.deleteEInvoice(record.rs_invoice_id);
    }

    await supabase.from('rs_einvoices').delete().eq('id', req.params.id);

    res.json({ message: 'E-invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete e-invoice: ' + err.message });
  }
});

module.exports = router;
