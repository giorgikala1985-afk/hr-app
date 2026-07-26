const supabase = require('../config/supabase');
const { createEmployeeRecord, setEmployeeEndDate, createEmployeeUnit, recordSalaryChange, updateEmployeePosition } = require('./employeeService');
const { createTransferRecord } = require('./transferService');

// Journal (frontend/src/components/Documents/JournalPage.js) sources its
// Hiring/Firing/Promotion entries from browser localStorage written by the
// web Orders.js tabs — a bot has no browser to write to, so its real DB
// changes would otherwise never show up there. This logs the same event
// shape Journal expects into a real table it also reads from.
async function logOrder(userId, type, payload) {
  try {
    await supabase.from('order_log').insert({ user_id: userId, type, payload });
  } catch (err) {
    console.error('[botActions] logOrder error:', err.message);
  }
}

// Action types the chat-bot channels (Telegram, WhatsApp) know how to actually
// execute after confirmation. The shared system prompt (finbotChat.js) also
// lets the model suggest "advance" for the web FinBots UI — that one isn't
// wired up here yet, so channels should tell the user to use the app instead.
const EXECUTABLE_TYPES = new Set(['hire', 'firing', 'transfer', 'promotion', 'adjusting']);

function summarizeAction(action) {
  switch (action.type) {
    case 'hire':
      return `📋 Hire: ${action.firstName || ''} ${action.lastName || ''} as ${action.position || '-'}, salary ${action.salary ?? '-'} ${action.salaryCurrency || 'GEL'}, starting ${action.startDate || '-'}.`;
    case 'firing':
      return `📋 Terminate: ${action.employeeName || '-'}, end date ${action.endDate || '-'}. Reason: ${action.reason || '-'}`;
    case 'transfer':
      return `📋 Transfer: ${action.amount ?? '-'} GEL to ${action.clientName || '-'}, due ${action.dueDate || '-'}.${action.description ? ` Note: ${action.description}` : ''}`;
    case 'promotion':
      return `📋 Promote: ${action.employeeName || '-'} to ${action.newPosition || '-'}, salary ${action.oldSalary ?? '-'} → ${action.newSalary ?? '-'}, effective ${action.effectiveDate || '-'}.`;
    case 'advance':
      return `📋 Advance payment: ${action.employeeName || '-'}, ${action.totalAmount ?? '-'} ${action.currency || 'GEL'} over ${action.numMonths || '-'} month(s) starting ${action.startMonth || '-'}.`;
    case 'adjusting':
      return `📋 ${action.unitType || 'Adjustment'}: ${action.employeeName || '-'}, ${action.amount ?? '-'} ${action.currency || 'GEL'}.`;
    default:
      return `📋 ${action.type}`;
  }
}

// Runs a confirmed action and reports the outcome via the caller-supplied
// `notify(text)` — each channel (Telegram/WhatsApp) passes in its own sender
// so this logic stays completely channel-agnostic. `actorLabel` identifies
// who sent the message (e.g. "@giorgi (Telegram)") so Journal can show who
// made each hire/fire/promotion/adjustment, same as the web app does.
async function executeAction(userId, action, notify, actorLabel = 'Bot') {
  try {
    if (action.type === 'hire') {
      await createEmployeeRecord(userId, {
        first_name: action.firstName, last_name: action.lastName,
        personal_id: action.personalId, birthdate: action.birthdate,
        position: action.position, salary: action.salary,
        salary_currency: action.salaryCurrency, start_date: action.startDate,
        department: action.department,
      });
      await logOrder(userId, 'hiring', {
        firstName: action.firstName, lastName: action.lastName,
        position: action.position, department: action.department, createdBy: actorLabel,
      });
      await notify(`✅ Hired ${action.firstName} ${action.lastName}.`);
    } else if (action.type === 'firing') {
      await setEmployeeEndDate(userId, action.employeeId, action.endDate);
      await logOrder(userId, 'firing', {
        empName: action.employeeName, terminationDate: action.endDate, reason: action.reason, createdBy: actorLabel,
      });
      await notify(`✅ ${action.employeeName || 'Employee'} terminated, end date ${action.endDate}.`);
    } else if (action.type === 'transfer') {
      await createTransferRecord(userId, actorLabel, null, {
        client_name: action.clientName, agent_id: action.agentId || null,
        amount: action.amount, due_date: action.dueDate,
        description: action.description, iban: action.iban,
      });
      await notify(`✅ Transfer of ${action.amount} GEL to ${action.clientName} submitted for approval.`);
    } else if (action.type === 'promotion') {
      if (action.newPosition) await updateEmployeePosition(userId, action.employeeId, action.newPosition);
      if (action.newSalary != null) {
        await recordSalaryChange(userId, action.employeeId, {
          salary: action.newSalary, effective_date: action.effectiveDate, note: action.notes,
        });
      }
      await logOrder(userId, 'promotion', {
        empName: action.employeeName, newPosition: action.newPosition,
        oldSalary: action.oldSalary, newSalary: action.newSalary, notes: action.notes, createdBy: actorLabel,
      });
      await notify(`✅ ${action.employeeName || 'Employee'} promoted${action.newPosition ? ` to ${action.newPosition}` : ''}${action.newSalary != null ? `, salary now ${action.newSalary}` : ''}.`);
    } else if (action.type === 'adjusting') {
      await createEmployeeUnit(userId, action.employeeId, {
        type: action.unitType, amount: action.amount,
        date: new Date().toISOString().slice(0, 10),
        currency: action.currency || 'GEL', include_in_salary: true,
        created_by_name: actorLabel,
      });
      await notify(`✅ ${action.unitType || 'Adjustment'} of ${action.amount} ${action.currency || 'GEL'} recorded for ${action.employeeName || 'employee'}.`);
    }
  } catch (err) {
    console.error('[botActions] executeAction error:', err.message);
    await notify(`❌ Failed: ${err.message}`);
  }
}

module.exports = { EXECUTABLE_TYPES, summarizeAction, executeAction };
