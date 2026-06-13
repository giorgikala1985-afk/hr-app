import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://nadofndsyejqzhvlphfe.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZG9mbmRzeWVqcXpodmxwaGZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjkyNDcsImV4cCI6MjA4NjA0NTI0N30.3uufczvJfh-m3fXCY1uAuy7gU253rjT6_3np9kB05tk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use a simple in-memory lock instead of the default navigator.locks lock.
    // The navigator lock aborts contending acquisitions, which surfaces as
    // "AbortError: signal is aborted without reason" when concurrent requests
    // each call auth.getSession() (e.g. our axios interceptor on page load,
    // doubled by React StrictMode in dev). Cross-tab refresh coordination isn't
    // needed for this single-tab app.
    lock: (name, acquireTimeout, fn) => fn(),
  },
});
