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

// storageKey isolates this client's auth state from any other Supabase
// client in the process. This matters because calling a session-mutating
// method (signInWithPassword, setSession, etc.) on ANY client permanently
// swaps that client's Authorization header to the signed-in user's token —
// routes/auth.js's /login route used to do exactly that on THIS shared
// service-role client, so after the first login of the process's life,
// every subsequent "service role" request silently ran as whichever user
// logged in most recently (see freshAuthClient() in routes/auth.js for the
// actual fix — this storageKey is defense in depth, not the fix itself).
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    storageKey: 'datum-backend-service-role',
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

module.exports = supabase;
