// Supabase Edge Function: Telegram Webhook Handler
// Deploy with: supabase functions deploy telegram-webhook
// Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.supabase.co/functions/v1/telegram-webhook

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log incoming webhook for debugging
    console.log("Received telegram update:", JSON.stringify(update));

    // Handle /start command with referral code
    if (update.message?.text?.startsWith("/start")) {
      const userId = update.message.from.id;
      const text = update.message.text;
      const parts = text.split(" ");
      const referralCode = parts.length > 1 ? parts[1] : null;

      // Check if user exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("telegram_id")
        .eq("telegram_id", userId)
        .single();

      if (!existingUser && referralCode) {
        // Find referrer by code
        const { data: referrer } = await supabase
          .from("users")
          .select("telegram_id")
          .eq("referral_code", referralCode)
          .single();

        if (referrer) {
          // Store referral relationship
          await supabase.from("referrals").insert({
            referrer_id: referrer.telegram_id,
            referred_id: userId,
            referral_code: referralCode,
          });

          console.log(`Referral created: ${referrer.telegram_id} -> ${userId}`);
        }
      }
    }

    // Return success to Telegram
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
