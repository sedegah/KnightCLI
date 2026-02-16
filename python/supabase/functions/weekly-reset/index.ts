// Supabase Edge Function: Weekly AP rollover
// Deploy with: supabase functions deploy weekly-reset
// Schedule with: supabase functions schedule weekly-reset --cron "59 23 * * 0"

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklyResetResponse {
  success: boolean;
  usersAffected: number;
  executedAt: string;
  timezone: string;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appTimezone = Deno.env.get("APP_TIMEZONE") || "UTC";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Preferred path: execute DB-side rollover atomically
    const { error: rolloverError } = await supabase.rpc("rollover_weekly_ap");

    if (rolloverError) {
      throw new Error(`Failed to rollover AP: ${rolloverError.message}`);
    }

    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const response: WeeklyResetResponse = {
      success: true,
      usersAffected: count || 0,
      executedAt: new Date().toISOString(),
      timezone: appTimezone,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in weekly-reset:", err);

    const response: WeeklyResetResponse = {
      success: false,
      usersAffected: 0,
      executedAt: new Date().toISOString(),
      timezone: Deno.env.get("APP_TIMEZONE") || "UTC",
      error: err.message,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
