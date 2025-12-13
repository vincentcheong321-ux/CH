
import { createClient } from '@supabase/supabase-js';

// Configuration for the backend connection
const supabaseUrl = 'https://zojhzyqpevzabpmqkpfa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpvamh6eXFwZXZ6YWJwbXFrcGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MzQ2MDgsImV4cCI6MjA4MTIxMDYwOH0.QknOhj_49l9dN_YGVXbYWNLlrEUKN-DW6a_YybZTMnU';

export const supabase = createClient(supabaseUrl, supabaseKey);
