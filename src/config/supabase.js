import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = 'https://savbsndzmdtjqtkaebsg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhdmJzbmR6bWR0anF0a2FlYnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MjI5MTEsImV4cCI6MjA5OTI5ODkxMX0.JbUA0A7smDYpJpta9tOGY4DZ2xZCrODTVsp9wVYm3Bc';

// OBLIGATORIO: Debe llevar la palabra 'export' antes de 'const'
export const supabase = createClient(supabaseUrl, supabaseAnonKey); 