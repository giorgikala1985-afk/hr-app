const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const OpenAI = require('openai');

// ── Data fetchers per source ─────────────────────────────────────────────────

async function fetchEmployees(userId) {
  const { data } = await supabase
    .from('employees')
    .select('id, first_name, last_name, personal_id, position, department, salary, salary_currency, overtime_rate, start_date, end_date, pension, pit_rate, tax_code')
    .eq('user_id', userId)
    .order('first_name');
  if (!data?.length) return '';
  const rows = data.map(e =>
    `DB_ID:${e.id} | ${e.first_name} ${e.last_name} | Personal ID: ${e.personal_id || '-'} | Position: ${e.position || '-'} | Dept: ${e.department || '-'} | Salary: ${e.salary ?? 'N/A'} ${e.salary_currency || 'GEL'} | Start: ${e.start_date || '-'} | End: ${e.end_date || 'Active'}`
  );
  return `=== EMPLOYEES (${rows.length}) ===\n${rows.join('\n')}`;
}

async function fetchSalaryChanges(userId) {
  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name, salary_currency')
    .eq('user_id', userId);

  if (!employees?.length) return '';

  const empIds = employees.map(e => e.id);

  const { data: changes } = await supabase
    .from('salary_changes')
    .select('employee_id, old_salary, new_salary, effective_date, note')
    .in('employee_id', empIds)
    .order('effective_date', { ascending: false });

  if (!changes?.length) return '';
  const empMap = {};
  const currMap = {};
  employees.forEach(e => { 
    empMap[e.id] = `${e.first_name} ${e.last_name}`; 
    currMap[e.id] = e.salary_currency || 'GEL';
  });

  // Derive current salary per employee from the most recent change (already ordered desc)
  const currentSalaryMap = {};
  for (const c of changes) {
    if (!currentSalaryMap[c.employee_id]) currentSalaryMap[c.employee_id] = c.new_salary;
  }

  const currentRows = Object.entries(currentSalaryMap)
    .map(([id, sal]) => `${empMap[id] || id}: ${sal} ${currMap[id] || 'GEL'}`)
    .sort();

  const historyRows = changes.map(c =>
    `${empMap[c.employee_id] || c.employee_id} | Date: ${c.effective_date} | ${c.old_salary} ${currMap[c.employee_id] || 'GEL'} → ${c.new_salary} ${currMap[c.employee_id] || 'GEL'}${c.note ? ` | Note: ${c.note}` : ''}`
  );

  return [
    `=== CURRENT SALARIES FROM CHANGES ===\n${currentRows.join('\n')}`,
    `=== SALARY CHANGE HISTORY (${historyRows.length}) ===\n${historyRows.join('\n')}`,
  ].join('\n\n');
}

async function fetchInsurance(userId) {
  const { data } = await supabase
    .from('insurance_list')
    .select('name, last_name, personal_id, amount1, amount2, date, date_end, pension, company')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (!data) return '';
  const rows = data.map(r =>
    `${r.name} ${r.last_name} | ID: ${r.personal_id || '-'} | Amount: ${r.amount1}${r.amount2 ? '+' + r.amount2 : ''} | Period: ${r.date} - ${r.date_end || 'ongoing'} | Company: ${r.company || '-'}`
  );
  return `=== INSURANCE RECORDS (${rows.length}) ===\n${rows.join('\n')}`;
}

async function fetchFitpass(userId) {
  const { data } = await supabase
    .from('fitpass_list')
    .select('name, last_name, personal_id, amount, period, note')
    .eq('user_id', userId)
    .order('period', { ascending: false });
  if (!data) return '';
  const rows = data.map(r =>
    `${r.name} ${r.last_name} | ID: ${r.personal_id || '-'} | Amount: ${r.amount} | Period: ${r.period || '-'}${r.note ? ` | Note: ${r.note}` : ''}`
  );
  return `=== FITPASS RECORDS (${rows.length}) ===\n${rows.join('\n')}`;
}

async function fetchBonuses(userId) {
  const [{ data: bonuses }, { data: units }, { data: employees }] = await Promise.all([
    supabase.from('bonuses').select('employee_name, amount, reason, note, date').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('salary_units').select('employee_id, type, amount, date, include_in_salary').eq('user_id', userId).order('date', { ascending: false }).limit(500),
    supabase.from('employees').select('id, first_name, last_name').eq('user_id', userId),
  ]);

  const empMap = {};
  (employees || []).forEach(e => { empMap[e.id] = `${e.first_name} ${e.last_name}`; });

  const bonusRows = (bonuses || []).map(b =>
    `${b.employee_name} | Amount: ${b.amount} | Reason: ${b.reason || '-'} | Date: ${b.date}${b.note ? ` | Note: ${b.note}` : ''}`
  );
  const unitRows = (units || []).map(u =>
    `${empMap[u.employee_id] || u.employee_id} | Type: ${u.type} | Amount: ${u.amount} | Date: ${u.date}${u.include_in_salary === false ? ' | [Separate payment]' : ''}`
  );

  const all = [...bonusRows, ...unitRows];
  if (!all.length) return '';
  return `=== BONUSES & DEDUCTIONS (${all.length}) ===\n${all.join('\n')}`;
}

async function fetchAccounting(userId) {
  const { data } = await supabase
    .from('accounting_purchases')
    .select('vendor, description, amount, currency, category, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500);
  if (!data) return '';
  const rows = data.map(r =>
    `${r.date} | ${r.vendor || '-'} | ${r.category || '-'} | ${r.amount} ${r.currency}${r.description ? ` | ${r.description}` : ''}`
  );
  return `=== ACCOUNTING / PURCHASES (${rows.length}) ===\n${rows.join('\n')}`;
}

async function fetchHolidays(userId) {
  const { data } = await supabase
    .from('holidays')
    .select('name, date')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (!data) return '';
  const rows = data.map(h => `${h.date} — ${h.name}`);
  return `=== HOLIDAYS (${rows.length}) ===\n${rows.join('\n')}`;
}

async function fetchSales(userId) {
  const { data } = await supabase
    .from('accounting_sales')
    .select('client, product, description, amount, currency, category, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500);
  if (!data) return '';
  const rows = data.map(r =>
    `${r.date} | ${r.client || '-'} | ${r.product ? `Product: ${r.product} | ` : ''}${r.category || '-'} | ${r.amount} ${r.currency || 'GEL'}${r.description ? ` | ${r.description}` : ''}`
  );
  return `=== SALES / REVENUE (${rows.length}) ===\n${rows.join('\n')}`;
}

async function fetchStock(userId) {
  const { data } = await supabase
    .from('accounting_stock')
    .select('sku, name, stock_name, move_in_date, move_in_qty, move_in_price, move_out_date, move_out_qty, move_out_price')
    .eq('user_id', userId)
    .limit(500);
  if (!data) return '';
  const rows = data.map(r =>
    `SKU: ${r.sku || '-'} | Item: ${r.name || '-'} | Stock: ${r.stock_name || '-'} | In Date: ${r.move_in_date || '-'} | In Qty: ${r.move_in_qty || 0} | In Price: ${r.move_in_price || 0} | Out Date: ${r.move_out_date || '-'} | Out Qty: ${r.move_out_qty || 0} | Out Price: ${r.move_out_price || 0}`
  );
  return `=== STOCK / INVENTORY (${rows.length}) ===\n${rows.join('\n')}`;
}

async function fetchClients(userId) {
  if (!userId) return '=== COAGENTS DATABASE ===\nError: User ID is missing.';
  
  // 1. Fetch with filter
  const { data, error } = await supabase
    .from('accounting_agents')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  
  if (error) return `=== COAGENTS DATABASE ===\nDB Error: ${error.message}`;
  
  if (!data || data.length === 0) {
    // 2. Fetch one record WITHOUT filter to see what a "valid" user_id looks like
    const { data: anyData } = await supabase.from('accounting_agents').select('user_id, name').limit(1);
    const sample = anyData?.[0];
    
    return [
      '=== COAGENTS DATABASE ===',
      `No coagents found for your user ID: ${userId}`,
      sample ? `Found other coagents in DB (e.g. "${sample.name}") with user_id: ${sample.user_id}` : 'Database table is completely empty.',
      'Check if your userId matches the one in the table.'
    ].join('\n');
  }
  
  const rows = data.map(r =>
    `Name: ${r.name || '-'} | Type: ${r.type || '-'} | IBAN: ${r.account_number || '-'} | Phone: ${r.phone || '-'} | Address: ${r.address || '-'}`
  );
  return `=== COAGENTS DATABASE (${rows.length} records) ===\n${rows.join('\n')}`;
}

const SOURCE_FETCHERS = {
  employees: fetchEmployees,
  salaries: fetchSalaryChanges,
  insurance: fetchInsurance,
  fitpass: fetchFitpass,
  bonuses: fetchBonuses,
  accounting: fetchAccounting,
  sales: fetchSales,
  stock: fetchStock,
  holidays: fetchHolidays,
  coagents: fetchClients,
  agents: fetchClients,
  clients: fetchClients,
};

// ── CRUD for bots themselves ──────────────────────────────────────────────────

// GET /api/finbots — List all bots for the user
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('finbots')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ bots: data || [] });
  } catch (err) {
    console.error('Fetch bots error:', err);
    res.status(500).json({ error: 'Failed to fetch bots: ' + err.message });
  }
});

// POST /api/finbots — Create or Update a bot
router.post('/', async (req, res) => {
  try {
    const { id, name, description, dataSources, systemPrompt, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Bot name is required.' });

    const botData = {
      user_id: req.userId,
      name,
      description,
      data_sources: dataSources,
      system_prompt: systemPrompt,
      color,
      icon,
      updated_at: new Date().toISOString(),
    };

    if (id && !id.startsWith('temp_')) {
      // Update
      const { data, error } = await supabase
        .from('finbots')
        .update(botData)
        .eq('id', id)
        .eq('user_id', req.userId)
        .select()
        .single();
      if (error) throw error;
      return res.json({ bot: data });
    } else {
      // Create
      const { data, error } = await supabase
        .from('finbots')
        .insert([{ ...botData, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      return res.json({ bot: data });
    }
  } catch (err) {
    console.error('Save bot error:', err);
    res.status(500).json({ error: 'Failed to save bot: ' + err.message });
  }
});

// DELETE /api/finbots/:id — Delete a bot
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('finbots')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete bot error:', err);
    res.status(500).json({ error: 'Failed to delete bot: ' + err.message });
  }
});

// ── POST /api/finbots/chat ───────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { dataSources = [], messages = [], botName = 'FinBot', systemPrompt = '', dlTablesData = [], preferredChartType = 'bar' } = req.body;

    if (!messages.length) return res.status(400).json({ error: 'No messages provided.' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });

    const userId = req.userId;
    console.log(`[FinBot] Request: botName=${botName}, userId=${userId}, sources=${JSON.stringify(dataSources)}`);

    // Fetch data from all selected sources in parallel
    const sourceKeys = dataSources.filter(s => {
      const exists = !!SOURCE_FETCHERS[s];
      console.log(`[FinBot] Checking source "${s}": ${exists ? 'EXISTS' : 'NOT FOUND'}`);
      return exists;
    });

    const contextParts = await Promise.all(
      sourceKeys.map(async (s) => {
        try {
          console.log(`[FinBot] Invoking fetcher for "${s}"`);
          const result = await SOURCE_FETCHERS[s](userId);
          console.log(`[FinBot] Result for "${s}" (len): ${result?.length || 0}`);
          return result;
        } catch (err) {
          console.error(`[FinBot] Error in fetcher "${s}":`, err.message);
          return `=== ${s.toUpperCase()} ===\nError: ${err.message}`;
        }
      })
    );

    // Format any Data Lake custom tables sent from the client.
    const dlParts = (Array.isArray(dlTablesData) ? dlTablesData : [])
      .map((table) => {
        try {
          const cols = table?.columns || [];
          const rows = table?.rows || [];
          if (!cols.length) return '';
          const header = cols.map(c => c.name || c.id).join(' | ');
          const body = rows
            .map(r => cols.map(c => {
              const v = r?.[c.id];
              return v === undefined || v === null ? '' : String(v);
            }).join(' | '))
            .join('\n');
          return `=== TABLE: ${table.name || 'Untitled'} (${rows.length} rows) ===\n${header}\n${body}`;
        } catch {
          return '';
        }
      })
      .filter(Boolean);

    const context = [...contextParts, ...dlParts].filter(Boolean).join('\n\n');
    console.log(`[FinBot] Final context length: ${context.length} (dlTables=${dlParts.length})`);
    if (context.length < 50) console.log(`[FinBot] Context content: "${context}"`);

    const systemContent = [
      systemPrompt ||
        `You are ${botName}, an AI assistant for Finpilot HR & Finance platform. Answer questions accurately and concisely based on the company data provided below. Be helpful and specific.

When the user asks for a chart, graph, or visualization, output a JSON block using EXACTLY this format (no markdown, no code fences, just the tags):
[CHART]{"type":"bar","title":"Chart Title","labels":["Label1","Label2"],"datasets":[{"label":"Series","data":[100,200],"color":"#3b82f6"}]}[/CHART]
You may include text before or after the [CHART] block. Use real values from the data.
Supported chart types:
- bar: column chart, good for comparing values across categories
- line: trend over time, good for salary history or changes over months
- area: filled line chart, good for showing volume or cumulative totals over time
- composed: bar columns + line overlay on the same axes (last dataset becomes the line)
- pie: proportion/share of a total, good for department breakdowns (single dataset only — labels + one data array)
- treemap: hierarchical proportions, good for showing relative sizes (single dataset only)
- radar: spider/radar chart, good for comparing multiple metrics per category
- scatter: scatter plot, good for showing distribution or correlation
- radial-bar: semicircular bar chart, good for progress toward targets (single dataset only)
- funnel: funnel chart, good for pipeline stages or conversion rates (single dataset only)
${preferredChartType && preferredChartType !== 'bar' ? `\nPREFERRED CHART FOR THIS BOT: "${preferredChartType}" — default to this chart type when the user asks for a visualization, unless they explicitly request a different type.` : ''}

CREATING HR ORDERS:
When the user wants to create an HR order (promote, fire/terminate, give advance payment, salary adjustment), ALWAYS respond with a brief confirmation sentence AND an [ORDER_ACTION] block.
Use EXACTLY this format (no markdown, no code fences):
[ORDER_ACTION]{"type":"<type>","employeeId":"<DB_ID>","employeeName":"<full name>",...fields}[/ORDER_ACTION]

Order types and required fields:
- "promotion": employeeId, employeeName, newPosition, oldSalary (number), newSalary (number), effectiveDate (YYYY-MM-DD), notes (optional string)
- "firing": employeeId, employeeName, endDate (YYYY-MM-DD), reason (string)
- "advance": employeeId, employeeName, totalAmount (number), currency ("GEL"/"USD"/"EUR"), numMonths (1-12), startMonth (YYYY-MM)
- "adjusting": employeeId, employeeName, unitType (e.g. "Bonus" or "Deduction"), amount (number), currency ("GEL"/"USD"/"EUR")

IMPORTANT: Use the DB_ID value (e.g. DB_ID:abc123) from the employee data as employeeId. If the user's request is ambiguous (e.g. missing salary or date), ask for the missing info before outputting the block. Always show a brief summary of what will happen alongside the action block.`,
      context
        ? `\n\nCOMPANY DATA:\n\n${context}\n\nUse ONLY this data to answer. If a specific piece of information is genuinely missing, say so — but always check carefully before concluding data is absent.`
        : `\n\nNo data sources are connected to this bot. (Debug: Received sources: ${JSON.stringify(dataSources)}). Tell the user to connect data sources in the bot settings.`,
    ].join('');

    const openai = new OpenAI({ apiKey });

    const validRoles = new Set(['user', 'assistant']);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemContent },
        ...messages
          .filter(m => validRoles.has(m.role))
          .map(m => ({ role: m.role, content: m.content })),
      ],
    });

    res.json({ answer: completion.choices[0]?.message?.content || '' });
  } catch (err) {
    console.error('FinBot chat error:', err);
    res.status(500).json({ error: 'Failed to get answer: ' + (err.message || 'Unknown error') });
  }
});

module.exports = router;
