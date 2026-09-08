// The "Connections" view's data model — unlike moduleMap.js (a strict
// navigation hierarchy), this is a real graph: nodes can connect to ANY other
// node, not just a parent/child. Add a future connection by adding one node
// (if it's new) and one edge — { source, target, label? } — no layout math
// required beyond picking a `col`/`row` for a brand new node (see COLS below).
//
// Columns read left-to-right as a rough data-flow order:
//   0 Channels (where a user/bot triggers something)
//   1 Shared brain (the one thing all three bot channels run through)
//   2 Actions (what gets triggered)
//   3 Entities (what gets written to the database)
//   4 Downstream (what later reads/displays/uses that data)
export const CONNECTION_COLS = [0, 300, 620, 940, 1260];

export const CONNECTION_NODES = [
  // Column 0 — Channels
  { id: 'ch-orders', label: 'Orders Page (web)', type: 'channel', col: 0, row: 0 },
  { id: 'ch-quickadd', label: 'Quick-Add Modal (+)', type: 'channel', col: 0, row: 1 },
  { id: 'ch-finbot-web', label: 'FinBot Web Chat', type: 'channel', col: 0, row: 2 },
  { id: 'ch-telegram', label: 'Telegram Bot', type: 'channel', col: 0, row: 3 },
  { id: 'ch-whatsapp', label: 'WhatsApp Bot', type: 'channel', col: 0, row: 4 },

  // Column 1 — shared brain
  { id: 'brain-finbot', label: 'FinBot Chat Brain\n(finbotChat.js)', type: 'brain', col: 1, row: 2 },

  // Column 2 — Actions
  { id: 'act-hire', label: 'Hire', type: 'action', col: 2, row: 0 },
  { id: 'act-fire', label: 'Fire', type: 'action', col: 2, row: 1 },
  { id: 'act-promote', label: 'Promote', type: 'action', col: 2, row: 2 },
  { id: 'act-adjust', label: 'Adjust\n(Bonus/Deduction)', type: 'action', col: 2, row: 3 },
  { id: 'act-transfer', label: 'Transfer', type: 'action', col: 2, row: 4 },
  { id: 'act-advance', label: 'Advance Payment\n(web only)', type: 'action', col: 2, row: 5 },

  // Column 3 — Entities (what gets written)
  { id: 'ent-employees', label: 'Employees\n(table)', type: 'entity', col: 3, row: 0 },
  { id: 'ent-salary-changes', label: 'Salary Changes\n(table)', type: 'entity', col: 3, row: 1 },
  { id: 'ent-units', label: 'Employee Units\n(bonus/deduction/OT)', type: 'entity', col: 3, row: 2.5 },
  { id: 'ent-transfers', label: 'Accounting Transfers\n(table)', type: 'entity', col: 3, row: 4 },
  { id: 'ent-order-log', label: 'Order Log\n(bot-only events)', type: 'entity', col: 3, row: 5.3 },
  { id: 'ent-bookkeeping', label: 'Bookkeeping Entries\n(auto-post)', type: 'entity', col: 3, row: 6.4 },

  // Column 4 — Downstream consumers
  { id: 'down-journal', label: 'Journal Page', type: 'downstream', col: 4, row: 0.5 },
  { id: 'down-payroll', label: 'Salary Accrual\n(Payroll)', type: 'downstream', col: 4, row: 2.2 },
  { id: 'down-tbc', label: 'TBC Banking\n(salary payments)', type: 'downstream', col: 4, row: 3.3 },
  { id: 'down-notifications', label: 'Notifications', type: 'downstream', col: 4, row: 4.4 },
];

export const CONNECTION_EDGES = [
  // Channels → Actions (direct, web-side)
  { source: 'ch-orders', target: 'act-hire', detail: "Orders page → Hiring tab: a multipart form (with photo) submits first/last name, personal_id, birthdate, position, salary, salary_currency, start_date to POST /employees." },
  { source: 'ch-orders', target: 'act-fire', detail: "Orders page → Firing tab: submits terminationDate for the selected employee via PATCH /employees/:id/end-date (sets employees.end_date)." },
  { source: 'ch-orders', target: 'act-promote', detail: "Orders page → Promotion tab only writes a local order record (hr_promotion_orders in localStorage) — it does NOT call any backend endpoint, so employees.position/salary are untouched from here." },
  { source: 'ch-orders', target: 'act-adjust', detail: "Orders page → Adjusting tab: posts type/amount/date/currency=USD/include_in_salary to POST /employees/:id/units; if include_in_salary is false it also posts a payout to POST /accounting/transfers." },
  { source: 'ch-orders', target: 'act-transfer', detail: "No dedicated 'Transfer' tab in Orders.js — the Business Trip tab posts client_name/amount/due_date/description (auto_approved:true) to POST /accounting/transfers for trip cost payouts." },
  { source: 'ch-orders', target: 'act-advance', detail: "Advance Payment tab loops per scheduled month, posting type='Advance', amount (converted to USD), date, include_in_salary to POST /employees/:id/units, then one POST /accounting/transfers for the total." },
  { source: 'ch-quickadd', target: 'act-hire', detail: "The (+) button's 'Hire' option has no modal of its own — it navigates to the Orders page (tab=orders, openHire:true), landing on the same Hiring tab as the edge above." },
  { source: 'ch-quickadd', target: 'act-fire', detail: "QuickFireModal submits employeeId + endDate via PATCH /employees/:id/end-date, then logs a local hr_firing_orders entry via addLocalOrder." },
  { source: 'ch-quickadd', target: 'act-promote', detail: "QuickPromoteModal posts salary, effective_date, note, optional position to POST /employees/:id/salary-changes — unlike the Orders-page Promotion tab, this one actually writes to the DB." },
  { source: 'ch-quickadd', target: 'act-adjust', detail: "QuickUnitModal: pick a unit type, then submit type/amount(USD)/date/include_in_salary to POST /employees/:id/units; if not included in salary, also POSTs a payout to /accounting/transfers." },
  { source: 'ch-quickadd', target: 'act-transfer', detail: "QuickTransferModal posts client_name, agent_id, amount, due_date, description to POST /accounting/transfers ('New Transfer' form)." },

  // Bot channels → shared brain → Actions
  { source: 'ch-finbot-web', target: 'brain-finbot', detail: "Web FinBot chat sends {dataSources, messages, botName, systemPrompt} to POST /api/finbots/chat, which calls runFinBotChat() in finbotChat.js." },
  { source: 'ch-telegram', target: 'brain-finbot', detail: "Telegram webhook (routes/telegram.js) forwards the user's text as a single message plus the account's configured dataSources into runFinBotChat()." },
  { source: 'ch-whatsapp', target: 'brain-finbot', detail: "WhatsApp webhook (routes/whatsapp.js) forwards the user's text plus the account's configured dataSources into runFinBotChat(), mirroring the Telegram flow." },
  { source: 'brain-finbot', target: 'act-hire', label: 'suggests', detail: "Model output is scanned for [ORDER_ACTION]{type:'hire',...}; fields are firstName,lastName,personalId,birthdate,position,salary,salaryCurrency,startDate,department (finbotChat.js prompt spec)." },
  { source: 'brain-finbot', target: 'act-fire', label: 'suggests', detail: "[ORDER_ACTION]{type:'firing', employeeId, employeeName, endDate, reason} — Telegram/WhatsApp require a YES/NO reply before executing; the web chat shows a confirm card instead." },
  { source: 'brain-finbot', target: 'act-promote', label: 'suggests', detail: "[ORDER_ACTION]{type:'promotion', employeeId, employeeName, newPosition, oldSalary, newSalary, effectiveDate, notes}." },
  { source: 'brain-finbot', target: 'act-adjust', label: 'suggests', detail: "[ORDER_ACTION]{type:'adjusting', employeeId, employeeName, unitType, amount, currency}." },
  { source: 'brain-finbot', target: 'act-transfer', label: 'suggests', detail: "[ORDER_ACTION]{type:'transfer', clientName, agentId, amount, dueDate, description, iban} — agentId is the coagent's DB_ID if the recipient matches a known coagent." },

  // Actions → Entities (what each action writes)
  { source: 'act-hire', target: 'ent-employees', label: 'creates', detail: "createEmployeeRecord() inserts a row with first_name, last_name, personal_id, birthdate, position, salary, salary_currency, overtime_rate, start_date, end_date, pension, pit_rate, photo_url." },
  { source: 'act-hire', target: 'ent-bookkeeping', label: 'auto-posts', detail: "Same call inserts 2 bookkeeping_entries rows (debit account 3130, credit account 1210) for the salary amount, tagged with transaction_id = the new employee's id." },
  { source: 'act-fire', target: 'ent-employees', label: 'sets end_date', detail: "setEmployeeEndDate() updates only employees.end_date (and updated_at) for the given employee id." },
  { source: 'act-promote', target: 'ent-employees', label: 'updates position', detail: "updateEmployeePosition() sets employees.position (only if a position was supplied); recordSalaryChange() separately updates employees.salary and overtime_rate on the same row." },
  { source: 'act-promote', target: 'ent-salary-changes', label: 'creates', detail: "recordSalaryChange() inserts a row: employee_id, old_salary, new_salary, old_overtime_rate, new_overtime_rate, effective_date, note." },
  { source: 'act-adjust', target: 'ent-units', label: 'creates', detail: "createEmployeeUnit() inserts into employee_units: employee_id, type, amount, date, currency, include_in_salary, note, created_by_name." },
  { source: 'act-advance', target: 'ent-units', label: 'creates (looped)', detail: "One employee_units row per scheduled month is created (type:'Advance', amount converted to USD, include_in_salary) — one POST /employees/:id/units call per installment." },
  { source: 'act-advance', target: 'ent-transfers', label: 'creates payout', detail: "A single POST /accounting/transfers is queued for the full advance total (client_name=employee, amount, due_date=today, iban=employee.account_number) — only on initial creation, not edits." },
  { source: 'act-transfer', target: 'ent-transfers', label: 'creates', detail: "createTransferRecord() inserts into accounting_transfers: client_name, agent_id, amount, due_date, description, iban, invoice_number, status, requester_name/email, approval_status." },

  // Bot-only visibility bridge
  { source: 'act-hire', target: 'ent-order-log', label: 'bot channel only', detail: "botActions.logOrder() inserts {user_id, type:'hiring', payload:{firstName,lastName,position,department,createdBy}} into order_log — reached only from Telegram/WhatsApp executeAction()." },
  { source: 'act-fire', target: 'ent-order-log', label: 'bot channel only', detail: "logOrder() inserts {type:'firing', payload:{empName,terminationDate,reason,createdBy}} — bot-only; the web Firing tab writes to hr_firing_orders in localStorage instead." },
  { source: 'act-promote', target: 'ent-order-log', label: 'bot channel only', detail: "logOrder() inserts {type:'promotion', payload:{empName,newPosition,oldSalary,newSalary,notes,createdBy}} — bot-only path; no equivalent write from the web Promotion tab." },

  // Entities → Downstream
  { source: 'ent-order-log', target: 'down-journal', detail: "JournalPage calls GET /employees/order-log and maps each row's payload + created_at into a journal entry (_type = log.type)." },
  { source: 'ent-units', target: 'down-journal', label: 'Adjustment rows', detail: "JournalPage calls GET /employees/units/all (joined with employee first/last/position) and renders each unit as an 'adjustment' row showing type, amount, direction." },
  { source: 'ent-employees', target: 'down-payroll', detail: "GET /api/salaries reads employees.salary, overtime_rate, start_date, end_date, pension, pit_rate to compute each employee's accrued_salary for the selected month." },
  { source: 'ent-units', target: 'down-payroll', label: 'net salary +/-', detail: "The same /api/salaries call pulls that month's employee_units rows per employee and sums include_in_salary=true amounts into total_additions/total_deductions to get net_salary." },
  { source: 'down-payroll', target: 'down-tbc', label: 'salary batch', detail: "TBC Banking's Salary Payments tab builds payments (iban=employee.account_number, amount=net_salary) from /salaries and POSTs to /tbc-bank/salary-payment, which calls TBC's bulk transfer API." },
  { source: 'ent-transfers', target: 'down-notifications', label: 'notifies approvers', detail: "createTransferRecord() inserts app_notifications rows (type='transfer_submitted', body, reference_id=transfer id) for each approver email (user_matrix.approve_transfer≠No) plus the account owner." },
];
