import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify Slack signing secret (HMAC-SHA256)
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
  complete:    "Complete",
  in_progress: "In Progress",
  not_started: "Not Started",
  blocked:     "Blocked",
};

function fmtDate(isoStr: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const opts = { hour: "numeric" as const, minute: "2-digit" as const, timeZone: TZ };
  const time = d.toLocaleTimeString("en-US", opts);
  const todayStr = now.toLocaleDateString("en-US", { timeZone: TZ });
  const dStr     = d.toLocaleDateString("en-US", { timeZone: TZ });
  if (dStr === todayStr) return `Today · ${time}`;
  const mo = d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: TZ });
  if (d.getFullYear() === now.getFullYear()) return `${mo} · ${time}`;
  return `${mo} '${String(d.getFullYear()).slice(2)} · ${time}`;
}

async function buildAndPostProgress(channelId: string, responseUrl: string) {
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

  const [{ data: tasks }, { data: state }, { data: recentLogs }] = await Promise.all([
    supabase.from("engagement_tasks").select("task_key, label, hidden").eq("engagement_id", eng.id),
    supabase.from("engagement_state").select("task_statuses").eq("engagement_id", eng.id).single(),
    supabase.from("task_logs").select("text, author_name, created_at, task_id").eq("engagement_id", eng.id).is("deleted_at", null).eq("internal", false).order("created_at", { ascending: false }).limit(5),
  ]);

  const statuses: Record<string, string> = state?.task_statuses ?? {};
  const taskByKey: Record<string, any> = {};
  for (const t of (tasks ?? [])) taskByKey[t.task_key] = t;

  const visTasks = (tasks ?? []).filter((t: any) => !t.hidden);
  const totalT   = visTasks.length;
  const doneT    = visTasks.filter((t: any) => statuses[t.task_key] === "complete").length;
  const pct      = totalT ? Math.round(doneT / totalT * 100) : 0;

  const activityLines = (recentLogs ?? [])
    .map((l: any) => {
      const who        = l.author_name ? ` — ${l.author_name}` : "";
      const when       = l.created_at ? ` · ${fmtDate(l.created_at)}` : "";
      const task       = taskByKey[l.task_id];
      const taskLabel  = task?.label ?? "";
      const taskStatus = STATUS_LABELS[statuses[l.task_id]] ?? "Not Started";
      const context    = taskLabel ? ` _(${taskLabel} - ${taskStatus})_` : "";
      return `• "${l.text}"${who}${when}${context}`;
    }).join("\n");

  const trackerUrl = Deno.env.get("TRACKER_URL") ?? "";

  const blocks: any[] = [
    { type: "header", text: { type: "plain_text", text: `📊 ${eng.name} — Progress Update`, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `*${pct}% complete*  (${doneT} of ${totalT} tasks)` } },
  ];

  if (activityLines) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Recent Activity*\n${activityLines}` } });
  }

  if (trackerUrl) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `<${trackerUrl}|View full tracker →>` } });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `_Updated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}_` }],
  });

  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "in_channel", blocks }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const rawBody = await req.text();

  // TODO: re-enable signature verification once confirmed working
  // const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
  // if (signingSecret) {
  //   const valid = await verifySlackSignature(signingSecret, rawBody, req);
  //   if (!valid) return new Response(
  //     JSON.stringify({ response_type: "ephemeral", text: "Invalid request signature." }),
  //     { status: 200, headers: { "Content-Type": "application/json" } }
  //   );
  // }

  const params      = new URLSearchParams(rawBody);
  const channelId   = params.get("channel_id") ?? "";
  const responseUrl = params.get("response_url") ?? "";

  if (!channelId || !responseUrl) {
    return new Response(
      JSON.stringify({ response_type: "ephemeral", text: "Missing required fields." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Respond immediately to Slack, then post result asynchronously via response_url
  // @ts-ignore
  EdgeRuntime.waitUntil(buildAndPostProgress(channelId, responseUrl));

  return new Response(
    JSON.stringify({ response_type: "ephemeral", text: "Fetching progress…" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
