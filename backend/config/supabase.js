const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
}

// A stuck network call to Supabase (seen in production: requests hanging
// indefinitely with no response, no error) holds its connection open forever,
// which piles up over time and starves every subsequent Supabase call —
// including on completely unrelated requests. Force every Supabase call to
// abort after 15s so a stuck one releases its connection instead of leaking it.
const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
};

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

module.exports = supabase;
