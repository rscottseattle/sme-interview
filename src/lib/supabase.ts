import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DbSession {
  id: string;
  topic: string;
  status: "in-progress" | "complete";
  tweaked_questions: { number: number; question: string; focus: string }[];
  current_question: number;
  created_at: string;
  updated_at: string;
}

export interface DbAnswer {
  id: string;
  session_id: string;
  question_number: number;
  question: string;
  soundbite: string;
  answer: string;
  created_at: string;
}
