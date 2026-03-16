import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Admin client — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is authenticated and is a Raiz (non-client) user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  if (user.user_metadata?.role === "client") {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const { email, engagement_id, redirect_url, mode, password } = await req.json();
  if (!email || !engagement_id) {
    return new Response(
      JSON.stringify({ error: "email and engagement_id are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (mode === "create") {
    // Create user with password — no email sent
    if (!password) {
      return new Response(
        JSON.stringify({ error: "password is required for create mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { role: "client", engagement_id, full_name: "" },
      email_confirm: true,
    });
    if (createErr) {
      return new Response(
        JSON.stringify({ error: createErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } else {
    // Invite flow — sends magic link email
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { role: "client", engagement_id, full_name: "" },
      redirectTo: redirect_url,
    });
    if (inviteErr) {
      return new Response(
        JSON.stringify({ error: inviteErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
