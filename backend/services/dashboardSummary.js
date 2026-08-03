const supabase = require('../config/supabase');

const formatDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

// Text "dashboard" the bot replies with on /dashboard — same stats as the
// Analytics page's Employees tab (frontend/src/components/Analytics/Analytics.js's
// EmployeeInsights), computed server-side so it works over chat.
async function buildDashboardSummary(userId) {
  const { data: employees } = await supabase
    .from('employees')
    .select('first_name, last_name, department, position, start_date, end_date, birthdate')
    .eq('user_id', userId);

  const emps = employees || [];
  const active = emps.filter(e => !e.end_date);
  const departments = new Set(active.map(e => e.department).filter(Boolean));
  const positions = new Set(active.map(e => e.position).filter(Boolean));

  const now = new Date();
  const avgTenure = active.length
    ? active.reduce((sum, e) => {
        if (!e.start_date) return sum;
        return sum + (now - new Date(e.start_date)) / (365.25 * 24 * 3600 * 1000);
      }, 0) / active.length
    : 0;

  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const birthdays = active
    .filter(e => e.birthdate)
    .map(e => {
      const bd = new Date(e.birthdate);
      const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < today) next.setFullYear(now.getFullYear() + 1);
      return { name: `${e.first_name} ${e.last_name}`, next };
    })
    .filter(b => b.next <= in30)
    .sort((a, b) => a.next - b.next);

  let msg = `📊 Datum Dashboard\n\n`;
  msg += `👥 Total Employees: ${emps.length}\n`;
  msg += `✅ Active: ${active.length}\n`;
  msg += `🏢 Departments: ${departments.size}\n`;
  msg += `💼 Positions: ${positions.size}\n`;
  msg += `⏳ Avg. Tenure: ${avgTenure.toFixed(1)}y\n`;

  if (birthdays.length) {
    msg += `\n🎂 Upcoming Birthdays (30d):\n`;
    birthdays.forEach(b => { msg += `• ${b.name} — ${formatDate(b.next)}\n`; });
  }

  return msg;
}

module.exports = { buildDashboardSummary };
