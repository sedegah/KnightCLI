// Supabase Edge Function: Weekly Points Reset
// Deploy with: supabase functions deploy weekly-reset
// Schedule with: supabase functions schedule weekly-reset --cron "0 0 * * 0"

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklyResetResponse {
  success: boolean;
  usersReset: number;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current leaderboard before reset
    const { data: topUsers, error: leaderboardError } = await supabase
      .from("users")
      .select("telegram_id, username, weekly_points")
      .order("weekly_points", { ascending: false })
      .limit(10);

    if (leaderboardError) {
      throw new Error(`Failed to fetch leaderboard: ${leaderboardError.message}`);
    }

    // Archive top performers (optional - store in leaderboard_history table)
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    if (topUsers && topUsers.length > 0) {
      const historyRecords = topUsers.map((user, index) => ({
        telegram_id: user.telegram_id,
        username: user.username,
        points: user.weekly_points,
        rank: index + 1,
        week_number: weekNumber,
        year: year,
      }));

      // Insert into history (create this table if needed)
      const { error: historyError } = await supabase
        .from("leaderboard_history")
        .insert(historyRecords);

      if (historyError) {
        console.error("Failed to archive leaderboard:", historyError.message);
      }
    }

    // Reset weekly points for all users
    const { data: resetData, error: resetError } = await supabase
      .from("users")
      .update({ weekly_points: 0 })
      .gt("telegram_id", 0);

    if (resetError) {
      throw new Error(`Failed to reset points: ${resetError.message}`);
    }

    // Count affected users
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const response: WeeklyResetResponse = {
      success: true,
      usersReset: count || 0,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in weekly-reset:", error);

    const response: WeeklyResetResponse = {
      success: false,
      usersReset: 0,
      error: error.message,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
