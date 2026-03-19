import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifySlackSignature(signingSecret: string, rawBody: string, req: Request): Promise<boolean> {
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const slackSig  = req.headers.get("x-slack-signature");
  if (!timestamp || !slackSig) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const sigBase = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sigBase));
  const hex = "v0=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === slackSig;
}

const TZ = Deno.env.get("TIMEZONE") ?? "America/New_York";

const STATUS_LABELS: Record<string, string> = {
  complete:    "✅ Complete",
  in_progress: "🔄 In Progress",
  not_started: "⬜ Not Started",
  blocked:     "🚫 Blocked",
};

function fmtDate(isoStr: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const now  = new Date();
  const opts = { hour: "numeric" as const, minute: "2-digit" as const, timeZone: TZ };
  const time = d.toLocaleTimeString("en-US", opts);
  const todayStr = now.toLocaleDateString("en-US", { timeZone: TZ });
  const dStr     = d.toLocaleDateString("en-US", { timeZone: TZ });
  if (dStr === todayStr) return `Today · ${time}`;
  const mo = d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: TZ });
  return `${mo} · ${time}`;
}

function parsePeriod(text: string): { label: string; since: Date } {
  const t = (text ?? "").trim().toLowerCase();
  const now = new Date();
  if (t === "today") {
    const since = new Date(now.toLocaleDateString("en-US", { timeZone: TZ }));
    return { label: "today", since };
  }
  if (t === "48h" || t === "48hours") {
    const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return { label: "last 48 hours", since };
  }
  // default: last 7 days
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { label: "last 7 days", since };
}

async function buildAndPostProgress(channelId: string, responseUrl: string, queryText: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: eng } = await supabase
    .from("engagements").select("id, name")
    .eq("slack_channel_id", channelId).single();

  if (!eng) {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response_type: "ephemeral", text: "No engagement is linked to this channel. Ask your Raiz team to connect it in the tracker." }),
    });
    return;
  }

  const { label: periodLabel, since } = parsePeriod(queryText);

  const { data: allTasks } = await supabase
    .from("engagement_tasks")
    .select("id, label, hidden, internal, status, status_updated_at, task_owner")
    .eq("engagement_id", eng.id);

  const visTasks = (allTasks ?? []).filter((t: any) => !t.hidden && !t.internal);
  const totalT   = visTasks.length;
  const doneT    = visTasks.filter((t: any) => t.status === "complete").length;
  const pct      = totalT ? Math.round(doneT / totalT * 100) : 0;

  const changedTasks = visTasks
    .filter((t: any) => t.status_updated_at && new Date(t.status_updated_at) >= since)
    .sort((a: any, b: any) => new Date(b.status_updated_at).getTime() - new Date(a.status_updated_at).getTime());

  const ownerLabel = (owner: string) => {
    if (owner === "raiz")   return "Raiz";
    if (owner === "client") return eng.name;
    if (owner === "other")  return "Other";
    return owner || "—";
  };

  const taskLines = changedTasks.length
    ? changedTasks.map((t: any) =>
        `• ${t.label}  |  ${ownerLabel(t.task_owner)}  |  ${STATUS_LABELS[t.status] ?? t.status}  |  ${fmtDate(t.status_updated_at)}`
      ).join("\n")
    : "_No status changes in this period._";

  const trackerUrl = Deno.env.get("TRACKER_URL") ?? "";

  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: eng.name, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${pct}% complete*  (${doneT} of ${totalT} tasks)` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Status changes — ${periodLabel}*\n${taskLines}` },
    },
  ];

  if (trackerUrl) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `<${trackerUrl}|View full tracker →>` },
    });
  }

  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "in_channel", blocks }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();

  const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
  if (signingSecret) {
    const valid = await verifySlackSignature(signingSecret, rawBody, req);
    if (!valid) return new Response(
      JSON.stringify({ response_type: "ephemeral", text: "Invalid request signature." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const params      = new URLSearchParams(rawBody);
  const channelId   = params.get("channel_id") ?? "";
  const responseUrl = params.get("response_url") ?? "";
  const queryText   = params.get("text") ?? "";

  if (!channelId || !responseUrl) {
    return new Response(
      JSON.stringify({ response_type: "ephemeral", text: "Missing required fields." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // @ts-ignore
  EdgeRuntime.waitUntil(buildAndPostProgress(channelId, responseUrl, queryText));

  return new Response(
    JSON.stringify({ response_type: "ephemeral", text: "Fetching progress…" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
