require('dotenv').config();
const supabase = require('./config/supabase');

async function run() {
  const { data, error } = await supabase.from('accounting_sales').select('*').limit(1);
  if (error) console.error(error);
  else console.log('Columns:', Object.keys(data[0] || {}));
}
run();
