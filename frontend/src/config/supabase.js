import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nadofndsyejqzhvlphfe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZG9mbmRzeWVqcXpodmxwaGZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjkyNDcsImV4cCI6MjA4NjA0NTI0N30.3uufczvJfh-m3fXCY1uAuy7gU253rjT6_3np9kB05tk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
