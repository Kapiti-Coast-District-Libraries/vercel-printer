import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ytztmtcdfqpamhityaqz.supabase.co";
const supabaseAnonKey = "sb_publishable_QivpXC97wK00Ov2EedYmIg_q_xBc3fk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);