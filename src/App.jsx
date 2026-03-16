/*
  ╔══════════════════════════════════════════════════════════════════╗
  ║  SUPABASE SCHEMA — run this in your Supabase SQL editor          ║
  ╠══════════════════════════════════════════════════════════════════╣

  create table engagements (
    id          uuid primary key default gen_random_uuid(),
    name        text not null default 'New Engagement',
    created_at  timestamptz default now()
  );

  create table engagement_state (
    id             uuid primary key default gen_random_uuid(),
    engagement_id  uuid references engagements(id) on delete cascade,
    task_statuses  jsonb default '{}'::jsonb,
    task_internal  jsonb default '{}'::jsonb,
    note_int_flags jsonb default '{}'::jsonb,
    ref_notes      text default '',
    ref_notes_int  boolean default false,
    link_int_flags jsonb default '{}'::jsonb,
    updated_at     timestamptz default now(),
    unique(engagement_id)
  );

  create table task_logs (
    id             uuid primary key default gen_random_uuid(),
    engagement_id  uuid references engagements(id) on delete cascade,
    task_id        text not null,
    text           text not null,
    internal       boolean default false,
    created_at     timestamptz default now()
  );

  create table links (
    id             uuid primary key default gen_random_uuid(),
    engagement_id  uuid references engagements(id) on delete cascade,
    label          text,
    url            text not null,
    internal       boolean default false,
    created_at     timestamptz default now()
  );

  create table team_members (
    id             uuid primary key default gen_random_uuid(),
    engagement_id  uuid references engagements(id) on delete cascade,
    name           text default '',
    title          text default '',
    email          text default '',
    slack          text default '',
    booking        text default '',
    avatar_url     text default '',
    sort_order     int default 0,
    created_at     timestamptz default now()
  );

  ╚══════════════════════════════════════════════════════════════════╝
*/

// ── Brand ──────────────────────────────────────────────────────────────────
const NAVY   = "#1a2744";
const TEXT   = "#1c1c1e";
const TMID   = "#4a4a4a";
const TMUTED = "#8a8a8a";
const LGRAY  = "#d1d5db";
const FGRAY  = "#f9fafb";

// ── Data ───────────────────────────────────────────────────────────────────
const PHASES = [
  { id:"prepare", label:"Prepare", num:"01", accent:"#4f46e5", tasks:[
    {id:"p1",label:"Project charter signed",instructions:"Confirm executive sponsor, project scope, budget envelope, and success criteria are documented and countersigned by both the client and Raiz. This document is the commercial backstop for all downstream scope decisions."},
    {id:"p2",label:"PMO structure & governance defined",instructions:"Establish steering committee cadence (bi-weekly), workstream lead structure, and escalation path. Define who has authority to approve scope changes vs. who is advisory only."},
    {id:"p3",label:"Project plan & milestone dates agreed",instructions:"Publish the full timeline with phase gates, key milestones, and buffer weeks. Get written client acknowledgment — verbal agreement doesn't count commercially."},
    {id:"p4",label:"Infrastructure decisions made",instructions:"Greenfield vs. brownfield, hosting model, and sandbox environment count must be locked before Design begins."},
    {id:"p5",label:"Data migration strategy defined",instructions:"Identify source systems, data owners, and migration approach (big bang vs. phased). This is strategy only — detailed mapping happens in Design."},
    {id:"p6",label:"Team onboarded & access provisioned",instructions:"All Raiz and client workstream leads have system access, shared drives, project management tool, and communication channels set up."},
  ]},
  { id:"design", label:"Design", num:"02", accent:"#0284c7", tasks:[
    {id:"d1",label:"Business process workshops completed",instructions:"Run structured fit-gap workshops for each functional domain. Every gap generates a documented decision: accept standard, configure workaround, build custom, or retire process."},
    {id:"d2",label:"Solution Design Document approved",instructions:"The SDD is your commercial and technical contract for the build. Client sign-off is mandatory before Build begins."},
    {id:"d3",label:"Fit-gap analysis & decisions logged",instructions:"Every gap must have a disposition: Accept Standard / Configure / Custom Build / Retire. Unresolved gaps at end of Design are a red flag."},
    {id:"d4",label:"Integration architecture finalized",instructions:"Map all inbound/outbound integrations, middleware, and data flows. Don't start building integrations until both sides of each connection are locked."},
    {id:"d5",label:"RICEF inventory documented",instructions:"List every Report, Interface, Conversion, Enhancement, and Form. Each item needs an approved spec before Build begins."},
    {id:"d6",label:"Data migration mapping complete",instructions:"Field-level source-to-target mapping for all objects. Data quality assessment and cleansing plan should be in flight by end of Design."},
    {id:"d7",label:"Security & roles design approved",instructions:"Define user roles, approval hierarchies, and segregation of duties requirements. Retrofitting security post-build is expensive."},
  ]},
  { id:"build", label:"Build", num:"03", accent:"#b45309", tasks:[
    {id:"b1",label:"Configuration complete — Finance",instructions:"All GL, AR, AP, fixed assets, and cost center configuration built and unit tested in dev. Workstream lead signs off before passing to integration testing."},
    {id:"b2",label:"Configuration complete — Operations",instructions:"Procurement, inventory, order management, and fulfillment processes configured and unit tested."},
    {id:"b3",label:"Configuration complete — HR / Payroll",instructions:"Org structure, employee records, payroll setup, and time tracking configured. Confirm compliance with local payroll regulations."},
    {id:"b4",label:"RICEF objects built & spec-matched",instructions:"Each custom object reviewed against its approved spec. Two-signature rule: consultant lead + client workstream lead."},
    {id:"b5",label:"Integrations built (post config lock)",instructions:"Integrations must be built AFTER the configuration they depend on is locked. Building integrations in parallel with open config is the #1 source of rework."},
    {id:"b6",label:"Data migration: sandbox loads complete",instructions:"First full data loads in sandbox to validate mapping logic, transformation rules, and error handling."},
    {id:"b7",label:"Customer Confirmation Session completed",instructions:"Raiz-led walkthrough of the configured system with client business users before UAT. Consultant drives — client observes. Get written acknowledgment."},
  ]},
  { id:"test", label:"Test", num:"04", accent:"#047857", tasks:[
    {id:"t1",label:"Test scripts written & approved",instructions:"Scripts should map to business processes, not just system functions. Client owns UAT test execution — Raiz owns test script quality."},
    {id:"t2",label:"Integration testing complete",instructions:"End-to-end process flows tested across module boundaries. Defects logged and assigned before proceeding."},
    {id:"t3",label:"UAT cycle 1 complete & defects triaged",instructions:"Client-executed testing. Critical and High defects must be resolved before UAT cycle 2."},
    {id:"t4",label:"UAT cycle 2 (regression) complete",instructions:"Retest of all defect fixes plus regression testing. Aim for zero Critical defects before Go/No-Go."},
    {id:"t5",label:"Performance & volume testing complete",instructions:"Validate system performance under production-level data volumes."},
    {id:"t6",label:"Security testing complete",instructions:"Validate role assignments, approval workflows, and SOD controls against the approved security design."},
    {id:"t7",label:"Go/No-Go decision documented",instructions:"Formal review with steering committee. Both Raiz and client leadership sign the Go/No-Go memo."},
  ]},
  { id:"cutover", label:"Cutover", num:"05", accent:"#b91c1c", tasks:[
    {id:"c1",label:"Cutover plan published & rehearsed",instructions:"Minute-by-minute runbook with owner, duration, and dependency for every step. Run at least one full rehearsal."},
    {id:"c2",label:"Rollback plan documented",instructions:"Define exact conditions that trigger rollback, who has authority to call it, and steps to return to legacy."},
    {id:"c3",label:"Final data migration load & validation",instructions:"Reconcile record counts and key balances between legacy and new system before cutover window opens."},
    {id:"c4",label:"Legacy system freeze executed",instructions:"All legacy transactions stopped at the agreed cutover freeze point. Users notified."},
    {id:"c5",label:"Go-live confirmed & communications sent",instructions:"Steering committee confirmation. War room stood up. Hypercare schedule published."},
  ]},
  { id:"stabilize", label:"Stabilize", num:"06", accent:"#0f766e", tasks:[
    {id:"s1",label:"Hypercare war room active",instructions:"Raiz resources available during business hours for the first 2–4 weeks post go-live. Daily stand-up with client IT and business leads."},
    {id:"s2",label:"Critical issues resolved",instructions:"Any issue preventing core business processes gets P1 treatment. Document root cause and resolution for each."},
    {id:"s3",label:"Month-end close #1 supported",instructions:"First close after go-live requires Raiz support. Document any gaps or manual workarounds for remediation."},
    {id:"s4",label:"Defect backlog triaged & assigned",instructions:"All remaining post-go-live defects classified, prioritized, and assigned."},
    {id:"s5",label:"User adoption assessment completed",instructions:"Assess actual usage vs. expected. Identify low-adoption groups and root-cause."},
    {id:"s6",label:"Project close-out & lessons learned",instructions:"Internal Raiz retrospective + client-facing lessons learned session."},
    {id:"s7",label:"Transition to managed services / BAU",instructions:"Formal handoff. Confirm SLAs, escalation path, and Raiz point of contact. Client signs project acceptance."},
  ]},
];

const STATUS_OPTS = [
  {key:"not_started", label:"Not Started", color:"#9ca3af", dot:"#d1d5db"},
  {key:"in_progress",  label:"In Progress", color:"#d97706", dot:"#fbbf24"},
  {key:"complete",     label:"Complete",    color:"#059669", dot:"#34d399"},
  {key:"blocked",      label:"Blocked",     color:"#dc2626", dot:"#f87171"},
  {key:"na",           label:"N/A",         color:"#9ca3af", dot:"#e5e7eb"},
];
const SCYCLE = STATUS_OPTS.map(s => s.key);
const SMAP   = Object.fromEntries(STATUS_OPTS.map(s => [s.key, s]));

const BLANK_MEMBER = {name:"",title:"",email:"",slack:"",booking:"",avatar_url:""};
const DEFAULT_NOTES = `General engagement notes go here.\n\nUse this space for:\n- Key client contacts and their priorities\n- Known constraints or sensitivities\n- Decisions made outside formal documentation`;
const STANDARDS = [
  "Client-facing deliverables reviewed by senior before delivery — never first draft to client.",
  "All deliverables saved to shared project folder within 24 hours of delivery.",
  "Meeting notes sent within 24 hours of meeting.",
  "No undocumented verbal commitments — follow up every verbal agreement in writing.",
  "Issues escalated within 24 hours of identification — do not sit on problems.",
  "Weekly status report sent every Friday regardless of whether client asks for it.",
];

// ── Tiny shared components ─────────────────────────────────────────────────
function Card({children, internal=false, style={}}) {
  return (
    <div style={{background:"#fff",border:`1px solid ${internal?"#c7d2fe":LGRAY}`,borderRadius:12,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.05)",...style}}>
      {children}
    </div>
  );
}
function CHead({children, internal=false, right=null}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:`1px solid ${internal?"#c7d2fe":LGRAY}`,background:internal?"#eef2ff":"#fff"}}>
      <div style={{fontWeight:700,fontSize:13,color:internal?NAVY:TEXT,display:"flex",alignItems:"center",gap:6}}>{children}</div>
      {right}
    </div>
  );
}
function LockBtn({active, onClick}) {
  return (
    <button onClick={onClick} style={{background:active?"#e0e7ff":"transparent",border:`1px solid ${active?"#a5b4fc":LGRAY}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:active?NAVY:TMUTED}}>🔒</button>
  );
}
function IBadge() {
  return <span style={{fontSize:10,background:"#e0e7ff",color:NAVY,padding:"1px 8px",borderRadius:99,fontWeight:600,marginLeft:4}}>Internal</span>;
}
function Spinner() {
  return <div style={{display:"inline-block",width:14,height:14,border:`2px solid ${LGRAY}`,borderTopColor:NAVY,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
}

// ── Logo ───────────────────────────────────────────────────────────────────

// ── Main ───────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from './supabase.js';
import logoSrc from './assets/Raiz-Logo.png';

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtTs(isoStr) {
  const d   = new Date(isoStr);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  const mo = d.toLocaleString('default', { month: 'short', day: 'numeric' });
  if (d.getFullYear() === now.getFullYear()) return `${mo} · ${time}`;
  return `${mo} '${String(d.getFullYear()).slice(2)} · ${time}`;
}

function shortName(full) {
  if (!full) return null;
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const mapTask = r => ({
  id: r.id, key: r.task_key, phase_id: r.phase_id,
  label: r.label, instructions: r.instructions || '',
  hidden: r.hidden, is_custom: r.is_custom, sort_order: r.sort_order
});

// ── Login screen ────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [magicMode, setMagicMode] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const inputSt = { width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (magicMode) {
      const { error: err } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname } });
      if (err) { setError(err.message); setLoading(false); }
      else setMagicSent(true);
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); }
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "40px 36px", width: 360, boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src={logoSrc} alt="Raiz" style={{ height: 44, marginBottom: 16 }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2744" }}>Sign in to Raiz Tracker</div>
        </div>
        {magicSent
          ? <div style={{ textAlign: "center", color: "#4a4a4a", fontSize: 14, lineHeight: 1.6 }}>
              Check your inbox — we sent a sign-in link to <strong>{email}</strong>.
            </div>
          : <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email" required autoFocus style={inputSt}/>
              {!magicMode && (
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password" required style={inputSt}/>
              )}
              {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{ background: "#1a2744", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
                {loading ? (magicMode ? "Sending…" : "Signing in…") : (magicMode ? "Send magic link" : "Sign in")}
              </button>
              <button type="button" onClick={() => { setMagicMode(m => !m); setError(null); }}
                style={{ background: "none", border: "none", color: "#8a8a8a", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                {magicMode ? "Sign in with password instead" : "Sign in with magic link (no password)"}
              </button>
            </form>
        }
      </div>
    </div>
  );
}

// ── Name prompt (first login) ────────────────────────────────────────────────
function NamePrompt() {
  const [name,    setName]    = useState("");
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
    if (err) { setError(err.message); setLoading(false); }
    // On success, onAuthStateChange fires with updated session → gate clears
  };

  const inputSt = { width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "40px 36px", width: 360, boxShadow: "0 2px 16px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src={logoSrc} alt="Raiz" style={{ height: 44, marginBottom: 16 }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2744" }}>Welcome to Raiz Tracker</div>
          <div style={{ fontSize: 13, color: "#8a8a8a", marginTop: 6 }}>What should we call you?</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Full name (e.g. Bruce Smith)" required autoFocus style={inputSt}
          />
          {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
          <button type="submit" disabled={loading || !name.trim()}
            style={{ background: "#1a2744", color: "#fff", border: "none", borderRadius: 6, padding: "10px 0", fontWeight: 600, fontSize: 14, cursor: (loading || !name.trim()) ? "default" : "pointer", opacity: (loading || !name.trim()) ? 0.6 : 1, fontFamily: "inherit" }}>
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  // ── UI state (not persisted) ──
  const [tab,       setTab]       = useState("tracker");
  const [phase,     setPhase]     = useState("prepare");
  const [instrOpen, setInstrOpen] = useState(null);
  const [logsOpen,  setLogsOpen]  = useState({});
  const [noteIn,    setNoteIn]    = useState({});
  const [noteIntF,  setNoteIntF]  = useState({});
  const [linkIn,    setLinkIn]    = useState({label:"",url:""});
  const [editName,  setEditName]  = useState(false);
  const [view,      setView]      = useState("raiz");
  const [saving,    setSaving]    = useState(false);
  const [session,   setSession]   = useState(undefined); // undefined = checking, null = logged out

  // ── Engagement selector ──
  const [engagements,   setEngagements]   = useState([]);
  const [engagementId,  setEngagementId]  = useState(null);
  const [engLoading,    setEngLoading]    = useState(true);
  const [showNewEng,    setShowNewEng]    = useState(false);
  const [newEngName,    setNewEngName]    = useState("");

  // ── Persisted engagement state ──
  const [projName,     setProjName]     = useState("Client Name");
  const [statuses,     setStatuses]     = useState({});
  const [taskInternal, setTaskInternal] = useState({});
  const [noteIntFlags, setNoteIntFlags] = useState({});
  const [refNotes,     setRefNotes]     = useState(DEFAULT_NOTES);
  const [refNotesInt,  setRefNotesInt]  = useState(false);
  const [linkIntFlags, setLinkIntFlags] = useState({});
  const [logs,         setLogs]         = useState({});   // { taskId: [{id,text,internal,ts}] }
  const [links,        setLinks]        = useState([]);   // [{id,label,url,internal}]
  const [members,      setMembers]      = useState([{...BLANK_MEMBER}]);
  const [phases,        setPhases]        = useState(PHASES); // defaults to hardcoded until DB loads
  const [engTasks,      setEngTasks]      = useState([]);
  const [editTaskId,    setEditTaskId]    = useState(null);
  const [editTaskLabel, setEditTaskLabel] = useState("");
  const [addTaskPhase,  setAddTaskPhase]  = useState(null);
  const [addTaskLabel,  setAddTaskLabel]  = useState("");
  const [showInvite,      setShowInvite]      = useState(false);
  const [inviteEmail,     setInviteEmail]     = useState("");
  const [inviteStatus,    setInviteStatus]    = useState(null); // null | "sending" | "sent" | "error"
  const [inviteError,     setInviteError]     = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [pwStatus,        setPwStatus]        = useState(null); // null | "saving" | "saved" | "error"
  const [pwError,         setPwError]         = useState("");
  const [addEmail,        setAddEmail]        = useState("");
  const [addPassword,     setAddPassword]     = useState("");
  const [addStatus,       setAddStatus]       = useState(null); // null | "saving" | "saved" | "error"
  const [addError,        setAddError]        = useState("");

  const saveTimer     = useRef(null);
  const memberTimer   = useRef(null);
  const isRaiz        = view === "raiz";
  const isClientUser  = session?.user?.user_metadata?.role === "client";

  // ── Seed tasks helper ──
  const seedTasks = async (engId) => {
    const rows = PHASES.flatMap(ph =>
      ph.tasks.map((t, i) => ({
        engagement_id: engId, task_key: t.id, phase_id: ph.id,
        label: t.label, instructions: t.instructions,
        sort_order: i, hidden: false, is_custom: false
      }))
    );
    const { data } = await supabase.from('engagement_tasks').insert(rows).select();
    return data ? data.map(mapTask) : [];
  };

  // ── Spin keyframe (injected once) ──
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(s);
  }, []);

  // ── Auth init on mount ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Force client view for client-role users ──
  useEffect(() => {
    if (isClientUser) setView("client");
  }, [isClientUser]);

  // ── Load engagement list when authenticated ──
  useEffect(() => {
    if (!session) return;
    (async () => {
      setEngLoading(true);

      // Load phases (global config table)
      const { data: ph, error: phErr } = await supabase
        .from('phases').select('*').eq('active', true).order('sort_order');
      if (phErr) {
        console.warn('phases table not found — using defaults:', phErr.message);
        // keep default PHASES state
      } else if (ph && ph.length === 0) {
        // Auto-seed from PHASES constant
        const rows = PHASES.map((p, i) => ({ id: p.id, label: p.label, num: p.num, accent: p.accent, sort_order: i, active: true }));
        await supabase.from('phases').insert(rows);
        // keep default PHASES state (identical content)
      } else if (ph) {
        setPhases(ph);
      }

      const userRole  = session?.user?.user_metadata?.role;
      const userEngId = session?.user?.user_metadata?.engagement_id;
      const engQuery  = (userRole === 'client' && userEngId)
        ? supabase.from('engagements').select('*').eq('id', userEngId)
        : supabase.from('engagements').select('*').order('created_at');
      const { data } = await engQuery;
      if (data?.length) {
        setEngagements(data);
        setEngagementId(data[0].id);
      } else {
        setEngLoading(false);
      }
    })();
  }, [session]);

  // ── Load full engagement data whenever engagementId changes ──
  useEffect(() => {
    if (!engagementId) return;
    (async () => {
      setEngLoading(true);
      setEngTasks([]);

      // Project name
      const { data: eng } = await supabase
        .from('engagements').select('name').eq('id', engagementId).single();
      if (eng) setProjName(eng.name);

      // engagement_state (statuses, internals, notes, etc.)
      const { data: st } = await supabase
        .from('engagement_state').select('*').eq('engagement_id', engagementId).single();
      if (st) {
        setStatuses(st.task_statuses    || {});
        setTaskInternal(st.task_internal || {});
        setNoteIntFlags(st.note_int_flags || {});
        setRefNotes(st.ref_notes         ?? DEFAULT_NOTES);
        setRefNotesInt(!!st.ref_notes_int);
        setLinkIntFlags(st.link_int_flags || {});
      } else {
        // First time seeing this engagement — reset to defaults
        setStatuses({});
        setTaskInternal({});
        setNoteIntFlags({});
        setRefNotes(DEFAULT_NOTES);
        setRefNotesInt(false);
        setLinkIntFlags({});
      }

      // task_logs
      const { data: tl } = await supabase
        .from('task_logs')
        .select('*')
        .eq('engagement_id', engagementId)
        .is('deleted_at', null)
        .order('created_at');
      if (tl) {
        const grouped = {};
        tl.forEach(r => {
          if (!grouped[r.task_id]) grouped[r.task_id] = [];
          grouped[r.task_id].push({ id: r.id, text: r.text, internal: r.internal, ts: r.created_at, author: r.author_name || null, author_id: r.author_id || null, author_role: r.author_role || 'raiz' });
        });
        setLogs(grouped);
      } else {
        setLogs({});
      }

      // links
      const { data: lk } = await supabase
        .from('links').select('*').eq('engagement_id', engagementId).order('created_at');
      if (lk) {
        setLinks(lk.map(r => ({ id: r.id, label: r.label || r.url, url: r.url, internal: r.internal })));
      } else {
        setLinks([]);
      }

      // team_members
      const { data: tm } = await supabase
        .from('team_members').select('*').eq('engagement_id', engagementId).order('sort_order');
      if (tm?.length) {
        setMembers(tm.map(r => ({ id: r.id, name: r.name, title: r.title, email: r.email, slack: r.slack, booking: r.booking, avatar_url: r.avatar_url })));
      } else {
        setMembers([{...BLANK_MEMBER}]);
      }

      // engagement_tasks
      const inMemoryTasks = () => PHASES.flatMap(ph =>
        ph.tasks.map((t, i) => ({ id: t.id, key: t.id, phase_id: ph.id, label: t.label, instructions: t.instructions, hidden: false, is_custom: false, sort_order: i }))
      );
      const { data: et, error: etErr } = await supabase
        .from('engagement_tasks').select('*')
        .eq('engagement_id', engagementId).order('sort_order');
      if (etErr) {
        // Table likely doesn't exist yet — show default tasks in-memory (read-only until migration is run)
        console.warn('engagement_tasks query failed:', etErr.message, '— showing in-memory defaults');
        setEngTasks(inMemoryTasks());
      } else if (et && et.length === 0) {
        const seeded = await seedTasks(engagementId);
        setEngTasks(seeded.length ? seeded : inMemoryTasks());
      } else if (et) {
        setEngTasks(et.map(mapTask));
      }

      setLogsOpen({});
      setEngLoading(false);
    })();
  }, [engagementId]);

  // ── Debounced save for engagement_state ──
  const scheduleSave = useCallback((patch) => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('engagement_state').upsert({ engagement_id: engagementId, ...patch }, { onConflict: 'engagement_id' });
      setSaving(false);
    }, 800);
  }, [engagementId]);

  // ── Helpers that update state + schedule save ──
  const getSt   = id => statuses[id] || "not_started";
  const cycleSt = id => {
    const i   = SCYCLE.indexOf(getSt(id));
    const next = SCYCLE[(i + 1) % SCYCLE.length];
    const ns   = { ...statuses, [id]: next };
    setStatuses(ns);
    scheduleSave({ task_statuses: ns });
  };

  const toggleTaskInternal = id => {
    const nv = { ...taskInternal, [id]: !taskInternal[id] };
    setTaskInternal(nv);
    scheduleSave({ task_internal: nv });
  };

  const toggleNoteIntF = id => {
    setNoteIntF(n => ({ ...n, [id]: !n[id] }));
  };

  const updateRefNotes = val => {
    setRefNotes(val);
    scheduleSave({ ref_notes: val });
  };

  const toggleRefNotesInt = () => {
    const nv = !refNotesInt;
    setRefNotesInt(nv);
    scheduleSave({ ref_notes_int: nv });
  };

  const toggleLinkInt = async (linkId) => {
    const link = links.find(l => l.id === linkId);
    if (!link) return;
    const updated = !link.internal;
    setLinks(ls => ls.map(l => l.id === linkId ? { ...l, internal: updated } : l));
    const nf = { ...linkIntFlags, [linkId]: updated };
    setLinkIntFlags(nf);
    await supabase.from('links').update({ internal: updated }).eq('id', linkId);
    scheduleSave({ link_int_flags: nf });
  };

  const saveProjName = async (name) => {
    setProjName(name);
    setEngagements(e => e.map(x => x.id === engagementId ? { ...x, name } : x));
    await supabase.from('engagements').update({ name }).eq('id', engagementId);
  };

  // ── Notes ──
  const addNote = async tid => {
    const text = (noteIn[tid] || "").trim();
    if (!text) return;
    const isInt      = !!noteIntF[tid];
    const authorName = session.user.user_metadata?.full_name || null;
    const authorId   = session.user.id;
    const authorRole = isClientUser ? 'client' : 'raiz';
    const { data } = await supabase.from('task_logs')
      .insert({ engagement_id: engagementId, task_id: tid, text, internal: isInt, author_name: authorName, author_id: authorId, author_role: authorRole })
      .select().single();
    if (data) {
      const entry = { id: data.id, text, internal: isInt, ts: data.created_at, author: authorName, author_id: authorId, author_role: authorRole };
      setLogs(l => ({ ...l, [tid]: [...(l[tid] || []), entry] }));
      setNoteIn(n => ({ ...n, [tid]: "" }));
      setNoteIntF(n => ({ ...n, [tid]: false }));
      setLogsOpen(o => ({ ...o, [tid]: true }));
    }
  };

  const deleteNote = async (taskId, noteId) => {
    await supabase.from('task_logs').update({ deleted_at: new Date().toISOString() }).eq('id', noteId);
    setLogs(l => ({ ...l, [taskId]: (l[taskId] || []).filter(e => e.id !== noteId) }));
  };

  // ── Task management ──
  const renameTask = async (dbId, label) => {
    await supabase.from('engagement_tasks').update({ label }).eq('id', dbId);
    setEngTasks(ts => ts.map(t => t.id === dbId ? { ...t, label } : t));
  };

  const toggleTaskHidden = async (dbId) => {
    const t = engTasks.find(t => t.id === dbId);
    if (!t) return;
    const hidden = !t.hidden;
    await supabase.from('engagement_tasks').update({ hidden }).eq('id', dbId);
    setEngTasks(ts => ts.map(x => x.id === dbId ? { ...x, hidden } : x));
  };

  const addCustomTask = async (phaseId) => {
    const label = addTaskLabel.trim();
    if (!label) return;
    const maxSort = Math.max(0, ...engTasks.filter(t => t.phase_id === phaseId).map(t => t.sort_order));
    const { data, error } = await supabase.from('engagement_tasks')
      .insert({ engagement_id: engagementId, task_key: 'placeholder', phase_id: phaseId,
                label, sort_order: maxSort + 1, hidden: false, is_custom: true })
      .select().single();
    if (error) {
      console.error('addCustomTask failed:', error.message, error.details);
      return;
    }
    if (data) {
      await supabase.from('engagement_tasks').update({ task_key: data.id }).eq('id', data.id);
      setEngTasks(ts => [...ts, mapTask({ ...data, task_key: data.id })]);
      setAddTaskLabel("");
      setAddTaskPhase(null);
    }
  };

  const deleteCustomTask = async (dbId, taskKey) => {
    await supabase.from('engagement_tasks').delete().eq('id', dbId);
    setEngTasks(ts => ts.filter(t => t.id !== dbId));
    setLogs(l => { const n = { ...l }; delete n[taskKey]; return n; });
  };

  const inviteClient = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteStatus("sending");
    setInviteError("");
    const { error } = await supabase.functions.invoke('invite-client', {
      body: { email, engagement_id: engagementId, redirect_url: window.location.origin },
    });
    if (error) {
      setInviteStatus("error");
      setInviteError(error.message || "Failed to send invite");
    } else {
      setInviteStatus("sent");
      setInviteEmail("");
    }
  };

  const createClient = async () => {
    const email = addEmail.trim();
    if (!email || !addPassword) return;
    setAddStatus("saving");
    setAddError("");
    const { error } = await supabase.functions.invoke('invite-client', {
      body: { email, password: addPassword, engagement_id: engagementId, mode: "create" },
    });
    if (error) {
      setAddStatus("error");
      setAddError(error.message || "Failed to create client");
    } else {
      setAddStatus("saved");
      setAddEmail("");
      setAddPassword("");
    }
  };

  const exportPDF = () => {
    const exportDate = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    const sBadge = key => {
      const s = SMAP[key] || SMAP['not_started'];
      return `<span style="display:inline-block;padding:2px 10px;border-radius:99px;background:${s.color}22;color:${s.color};font-weight:600;font-size:11px">${s.label}</span>`;
    };
    const phaseSections = phases.map(ph => {
      const tasks = engTasks
        .filter(t => t.phase_id === ph.id && (isRaiz || (!t.hidden && !taskInternal[t.key])))
        .sort((a, b) => a.sort_order - b.sort_order);
      if (!tasks.length) return '';
      const prog = phaseProg(ph);
      const rows = tasks.map(t => {
        const isInt = !!taskInternal[t.key];
        const taskLogs = (logs[t.key] || []).filter(n => isRaiz || !n.internal);
        const notesHtml = taskLogs.length ? `<div style="margin-top:8px;padding-left:12px;border-left:2px solid #e5e7eb">${
          taskLogs.map(n => `<div style="margin-bottom:5px">${isRaiz && n.internal ? '<span style="font-size:10px;color:#1a2744;margin-right:4px">🔒</span>' : ''}<span style="font-size:12px;color:#4a4a4a">${n.text}</span><span style="font-size:10px;color:#8a8a8a;margin-left:6px">${n.author_name ? `— ${n.author_name} · ` : ''}${fmtTs(n.created_at)}</span></div>`).join('')
        }</div>` : '';
        return `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:10px 8px;vertical-align:top"><div style="font-size:13px;font-weight:500;color:#1c1c1e">${t.label}${isInt && isRaiz ? '<span style="font-size:10px;background:#e0e7ff;color:#1a2744;padding:1px 8px;border-radius:99px;font-weight:600;margin-left:6px">Internal</span>' : ''}${t.hidden && isRaiz ? '<span style="font-size:10px;background:#f3f4f6;color:#8a8a8a;padding:1px 8px;border-radius:99px;font-weight:600;margin-left:6px">Hidden</span>' : ''}</div>${notesHtml}</td><td style="padding:10px 8px;white-space:nowrap;vertical-align:top">${sBadge(getSt(t.key))}</td></tr>`;
      }).join('');
      return `<div style="margin-bottom:28px"><div style="display:flex;align-items:center;margin-bottom:10px"><div style="width:26px;height:26px;border-radius:7px;background:${ph.accent};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;margin-right:10px;flex-shrink:0">${ph.num}</div><span style="font-size:15px;font-weight:700;color:#1c1c1e">${ph.label}</span><span style="font-size:12px;color:#8a8a8a;margin-left:10px">${prog.done}/${prog.total} · ${prog.pct}%</span></div><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden"><colgroup><col style="width:72%"><col style="width:28%"></colgroup>${rows}</table></div>`;
    }).join('');
    const notesHtml = (isRaiz || !refNotesInt) && refNotes.trim() ? `<div style="margin-bottom:28px"><h2 style="font-size:14px;font-weight:700;color:#1c1c1e;margin:0 0 10px">Engagement Notes</h2><div style="white-space:pre-wrap;font-size:13px;color:#4a4a4a;line-height:1.75;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">${refNotes}</div></div>` : '';
    const linksHtml = links.filter(l => isRaiz || !l.internal).length ? `<div style="margin-bottom:28px"><h2 style="font-size:14px;font-weight:700;color:#1c1c1e;margin:0 0 10px">Links &amp; Resources</h2>${links.filter(l => isRaiz || !l.internal).map(l => `<div style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:6px">${l.internal ? '<span style="font-size:10px;color:#1a2744;margin-right:4px">🔒</span>' : ''}<a href="${l.url}" style="color:#1a2744;font-weight:600;font-size:13px;text-decoration:none">${l.label || l.url}</a><span style="color:#8a8a8a;font-size:11px;margin-left:8px">${l.url}</span></div>`).join('')}</div>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${projName} — Implementation Tracker</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1c1c1e;background:#fff;padding:40px;max-width:880px;margin:0 auto}@media print{body{padding:20px}.no-print{display:none!important}@page{margin:1.5cm}}</style></head><body>
<div class="no-print" style="background:#1a2744;color:#fff;padding:12px 20px;border-radius:8px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:13px">Press <strong>Ctrl+P</strong> (or <strong>⌘P</strong>) then choose <strong>Save as PDF</strong></span><button onclick="window.print()" style="background:#fff;color:#1a2744;border:none;border-radius:6px;padding:6px 18px;font-weight:700;cursor:pointer;font-size:13px">Save as PDF</button></div>
<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #1a2744"><div><div style="font-size:10px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Implementation Tracker${isRaiz ? ' · Raiz View' : ''}</div><h1 style="font-size:22px;font-weight:800;color:#1a2744">${projName}</h1><div style="font-size:12px;color:#8a8a8a;margin-top:4px">Exported ${exportDate}</div></div><div style="text-align:right"><div style="font-size:30px;font-weight:800;color:#1a2744">${pct}%</div><div style="font-size:11px;color:#8a8a8a">${doneT} of ${totalT} tasks complete</div><div style="margin-top:6px;height:7px;width:130px;background:#f3f4f6;border-radius:99px;overflow:hidden;margin-left:auto"><div style="height:100%;width:${pct}%;background:#1a2744;border-radius:99px"></div></div></div></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px">${phases.map(ph => { const p = phaseProg(ph); return `<div style="flex:1;min-width:90px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;border-top:3px solid ${ph.accent}"><div style="font-size:11px;font-weight:700;color:#1c1c1e">${ph.label}</div><div style="font-size:17px;font-weight:800;color:${ph.accent};margin-top:2px">${p.pct}%</div><div style="font-size:10px;color:#8a8a8a">${p.done}/${p.total}</div></div>`; }).join('')}</div>
${phaseSections}${notesHtml}${linksHtml}</body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };

  const moveTask = async (dbId, direction) => {
    const phaseId = engTasks.find(x => x.id === dbId)?.phase_id;
    const phaseTasks = [...engTasks].filter(t => t.phase_id === phaseId).sort((a, b) => a.sort_order - b.sort_order);
    const idx = phaseTasks.findIndex(t => t.id === dbId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= phaseTasks.length) return;
    const a = phaseTasks[idx], b = phaseTasks[swapIdx];
    await supabase.from('engagement_tasks').update({ sort_order: b.sort_order }).eq('id', a.id);
    await supabase.from('engagement_tasks').update({ sort_order: a.sort_order }).eq('id', b.id);
    setEngTasks(ts => ts.map(t =>
      t.id === a.id ? { ...t, sort_order: b.sort_order } :
      t.id === b.id ? { ...t, sort_order: a.sort_order } : t
    ));
  };

  // ── Links ──
  const addLink = async () => {
    if (!linkIn.url.trim()) return;
    const { data } = await supabase.from('links')
      .insert({ engagement_id: engagementId, label: linkIn.label || linkIn.url, url: linkIn.url, internal: false })
      .select().single();
    if (data) {
      setLinks(l => [...l, { id: data.id, label: data.label, url: data.url, internal: false }]);
      setLinkIn({ label: "", url: "" });
    }
  };

  const removeLink = async id => {
    await supabase.from('links').delete().eq('id', id);
    setLinks(l => l.filter(x => x.id !== id));
  };

  // ── Members ──
  const updMember = async (i, f, v) => {
    const m = { ...members[i], [f]: v };
    setMembers(ms => ms.map((x, j) => j === i ? m : x));
    if (m.id) {
      clearTimeout(memberTimer.current);
      memberTimer.current = setTimeout(async () => {
        await supabase.from('team_members').update({
          name: m.name, title: m.title, email: m.email,
          slack: m.slack, booking: m.booking, avatar_url: m.avatar_url,
        }).eq('id', m.id);
      }, 800);
    }
  };

  const addMember = async () => {
    const { data } = await supabase.from('team_members')
      .insert({ engagement_id: engagementId, ...BLANK_MEMBER, sort_order: members.length })
      .select().single();
    if (data) setMembers(m => [...m, { id: data.id, ...BLANK_MEMBER }]);
  };

  const remMember = async i => {
    const m = members[i];
    if (m.id) await supabase.from('team_members').delete().eq('id', m.id);
    setMembers(ms => ms.filter((_, j) => j !== i));
  };

  // ── Engagements ──
  const createEngagement = async () => {
    const name = newEngName.trim() || "New Engagement";
    const { data } = await supabase.from('engagements').insert({ name }).select().single();
    if (data) {
      setEngagements(e => [...e, data]);
      const seeded = await seedTasks(data.id);
      setEngTasks(seeded);
      setEngagementId(data.id);
      setShowNewEng(false);
      setNewEngName("");
    }
  };

  // ── Progress calcs ──
  const phaseProg = ph => {
    const vis  = engTasks.filter(t => t.phase_id === ph.id && !t.hidden && !taskInternal[t.key]);
    const done = vis.filter(t => getSt(t.key) === "complete").length;
    return { done, total: vis.length, pct: vis.length ? Math.round(done / vis.length * 100) : 0 };
  };
  const totalT = engTasks.filter(t => !t.hidden && !taskInternal[t.key]).length;
  const doneT  = engTasks.filter(t => !t.hidden && !taskInternal[t.key] && getSt(t.key) === "complete").length;
  const pct    = totalT ? Math.round(doneT / totalT * 100) : 0;

  const curPhase = phases.find(p => p.id === phase) ?? phases[0];
  const visTasks = engTasks
    .filter(t => t.phase_id === phase && (isRaiz || (!t.hidden && !taskInternal[t.key])))
    .sort((a, b) => a.sort_order - b.sort_order);

  // ── Shared styles ──
  const iSt    = {background:FGRAY,border:`1px solid ${LGRAY}`,borderRadius:6,padding:"6px 10px",color:TEXT,fontSize:12,outline:"none"};
  const iBtnSt = {display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600,padding:"4px 0",borderRadius:6,textDecoration:"none",whiteSpace:"nowrap",justifyContent:"center"};

  // ── Auth gates ──
  if (session === undefined) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",flexDirection:"column",gap:12}}>
        <img src={logoSrc} alt="Raiz" style={{height: 42}} />
        <div style={{display:"flex",alignItems:"center",gap:8,color:"#9ca3af",fontSize:13,marginTop:8}}>
          <Spinner/> Loading…
        </div>
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  if (!session.user.user_metadata?.full_name) return <NamePrompt />;

  // ── Loading screen ──
  if (engLoading) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",flexDirection:"column",gap:12}}>
        <img src={logoSrc} alt="Raiz" style={{height: 42}} />
        <div style={{display:"flex",alignItems:"center",gap:8,color:TMUTED,fontSize:13,marginTop:8}}>
          <Spinner/> Loading engagement…
        </div>
      </div>
    );
  }

  // ── No engagements yet ──
  if (!engagements.length || !engagementId) {
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",flexDirection:"column",gap:16}}>
        <img src={logoSrc} alt="Raiz" style={{height: 42}} />
        {isClientUser ? (
          <>
            <div style={{fontSize:15,fontWeight:700,color:TEXT}}>No engagement found</div>
            <div style={{fontSize:13,color:TMUTED}}>Contact your Raiz team to get access.</div>
            <button onClick={() => supabase.auth.signOut()} style={{fontSize:12,fontWeight:600,color:TMUTED,background:"transparent",border:`1px solid ${LGRAY}`,borderRadius:6,padding:"6px 14px",cursor:"pointer",marginTop:4}}>Sign out</button>
          </>
        ) : (
          <>
            <div style={{fontSize:15,fontWeight:700,color:TEXT}}>No engagements yet</div>
            <div style={{display:"flex",gap:8}}>
              <input value={newEngName} onChange={e=>setNewEngName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createEngagement()} placeholder="Client / engagement name" style={{...iSt,width:220}}/>
              <button onClick={createEngagement} style={{background:NAVY,border:"none",borderRadius:6,padding:"7px 18px",color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer"}}>Create</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#fff",color:TEXT,fontFamily:"'Inter','Helvetica Neue',sans-serif",fontSize:14}}>

      {/* ── Header ── */}
      <div style={{background:"#fff",borderBottom:`1px solid ${LGRAY}`,padding:"0 24px"}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:16,paddingTop:16}}>

            {/* Left: logo + project name */}
            <div style={{flex:"2 1 0",display:"flex",alignItems:"center",gap:16}}>
              <img src={logoSrc} alt="Raiz" style={{height: 42}} />
              <div style={{width:1,height:32,background:LGRAY}}/>
              <div>
                <div style={{fontSize:10,color:TMUTED,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Implementation Tracker</div>
                {editName&&isRaiz
                  ? <input value={projName}
                      onChange={e => setProjName(e.target.value)}
                      onBlur={()=>{ setEditName(false); saveProjName(projName); }}
                      onKeyDown={e=>{ if(e.key==="Enter"){ setEditName(false); saveProjName(projName); } }}
                      autoFocus
                      style={{background:"transparent",border:"none",borderBottom:`2px solid ${NAVY}`,color:TEXT,fontSize:15,fontWeight:700,outline:"none",width:200}}/>
                  : <div onClick={isRaiz?()=>setEditName(true):undefined} style={{fontSize:15,fontWeight:700,cursor:isRaiz?"pointer":"default"}} title={isRaiz?"Click to rename":undefined}>
                      {projName} {isRaiz&&<span style={{color:TMUTED,fontSize:11}}>✎</span>}
                    </div>
                }
              </div>

              {/* Engagement switcher */}
              {engagements.length > 1 && (
                <select value={engagementId} onChange={e => setEngagementId(e.target.value)}
                  style={{...iSt,fontSize:12,marginLeft:4,maxWidth:180,cursor:"pointer"}}>
                  {engagements.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}

              {/* New engagement */}
              {isRaiz && !showNewEng && (
                <button onClick={()=>setShowNewEng(true)} style={{fontSize:11,background:"transparent",border:`1px solid ${LGRAY}`,borderRadius:6,padding:"3px 10px",cursor:"pointer",color:TMUTED,flexShrink:0}}>+ New</button>
              )}
              {isRaiz && showNewEng && (
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input value={newEngName} onChange={e=>setNewEngName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")createEngagement();if(e.key==="Escape")setShowNewEng(false);}} autoFocus placeholder="Engagement name" style={{...iSt,width:150,fontSize:11}}/>
                  <button onClick={createEngagement} style={{background:NAVY,border:"none",borderRadius:6,padding:"4px 10px",color:"#fff",fontWeight:600,fontSize:11,cursor:"pointer"}}>Add</button>
                  <button onClick={()=>setShowNewEng(false)} style={{background:"transparent",border:"none",color:TMUTED,cursor:"pointer",fontSize:16}}>×</button>
                </div>
              )}

            </div>

            {/* Right: progress + save indicator + view toggle */}
            <div style={{flex:"1 1 0",display:"flex",alignItems:"center",gap:14,justifyContent:"flex-end"}}>
              {saving && (
                <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:TMUTED}}>
                  <Spinner/> Saving…
                </div>
              )}
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:TMUTED}}>Overall Progress</span>
                  <span style={{fontSize:18,fontWeight:800,color:NAVY}}>{pct}%</span>
                </div>
                <div style={{height:6,background:FGRAY,borderRadius:99,border:`1px solid ${LGRAY}`,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:NAVY,borderRadius:99,transition:"width .3s"}}/>
                </div>
                <div style={{fontSize:10,color:TMUTED,marginTop:2,textAlign:"right"}}>{doneT}/{totalT} tasks</div>
              </div>
              {isRaiz && (
                <div style={{display:"flex",background:FGRAY,borderRadius:8,border:`1px solid ${LGRAY}`,overflow:"hidden",flexShrink:0}}>
                  {["raiz","client"].map(v => (
                    <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:view===v?NAVY:"transparent",color:view===v?"#fff":TMUTED,textTransform:"capitalize",transition:"all .15s"}}>
                      {v==="raiz"?"🔒 Raiz":"👤 Client"}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={exportPDF} style={{fontSize:11,fontWeight:600,color:TMUTED,background:"transparent",border:`1px solid ${LGRAY}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",flexShrink:0}}>Export</button>
              {isRaiz && (
                <button onClick={() => supabase.auth.signOut()} style={{fontSize:11,fontWeight:600,color:TMUTED,background:"transparent",border:`1px solid ${LGRAY}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",flexShrink:0}}>
                  Sign out
                </button>
              )}
              {!isRaiz && isClientUser && (
                <button onClick={() => supabase.auth.signOut()} style={{fontSize:11,fontWeight:600,color:TMUTED,background:"transparent",border:`1px solid ${LGRAY}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",flexShrink:0}}>
                  Sign out
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",gap:4,marginTop:12}}>
            {["tracker","reference"].map(t => (
              <button key={t} onClick={()=>setTab(t)} style={{padding:"7px 18px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tab===t?"#fff":"transparent",color:tab===t?NAVY:TMUTED,borderBottom:tab===t?`2px solid ${NAVY}`:"2px solid transparent",textTransform:"capitalize",transition:"all .15s",marginBottom:-1}}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{maxWidth:1000,margin:"0 auto",padding:"24px 16px"}}>

        {/* ════ TRACKER ════ */}
        {tab==="tracker" && (
          <>
            {/* Phase buttons */}
            <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
              {phases.map(ph => {
                const {done,total,pct:pp} = phaseProg(ph);
                const active = ph.id === phase;
                return (
                  <button key={ph.id} onClick={()=>setPhase(ph.id)} style={{position:"relative",padding:"10px 16px",borderRadius:10,border:`1.5px solid ${active?ph.accent:LGRAY}`,cursor:"pointer",background:"#fff",color:active?ph.accent:TMID,fontWeight:600,fontSize:12,overflow:"hidden",minWidth:90,textAlign:"left",boxShadow:active?`0 2px 8px ${ph.accent}30`:"0 1px 2px rgba(0,0,0,0.04)",transition:"all .2s"}}>
                    <div style={{position:"absolute",inset:0,background:ph.accent,opacity:0.1,width:`${pp}%`,transition:"width .4s",borderRadius:9}}/>
                    <div style={{position:"relative",zIndex:1}}>
                      <div style={{fontSize:10,color:active?ph.accent:TMUTED,marginBottom:2}}>{ph.num}</div>
                      <div>{ph.label}</div>
                      <div style={{fontSize:10,color:TMUTED,marginTop:3}}>{done}/{total}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Phase heading */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{width:3,height:22,background:curPhase.accent,borderRadius:99}}/>
              <h2 style={{margin:0,fontSize:17,fontWeight:700}}>{curPhase.num} · {curPhase.label}</h2>
              <span style={{fontSize:11,color:TMUTED,marginLeft:"auto"}}>{phaseProg(curPhase).done}/{phaseProg(curPhase).total} complete</span>
            </div>

            {/* Task list */}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {visTasks.map(task => {
                const st     = SMAP[getSt(task.key)];
                const isInt  = !!taskInternal[task.key];
                const tlog   = (logs[task.key] || []).filter(n => isRaiz || !n.internal);
                const logVis = logsOpen[task.key];
                const iOpen  = instrOpen === task.key;
                const done   = getSt(task.key) === "complete";

                return (
                  <div key={task.id} style={{background:"#fff",border:`1px solid ${isInt&&isRaiz?"#c7d2fe":LGRAY}`,borderRadius:10,overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",opacity:task.hidden?0.5:1}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"11px 16px"}}>
                      <button onClick={isRaiz?()=>cycleSt(task.key):undefined} title={isRaiz?`${st.label} — click to cycle`:st.label} style={{marginTop:4,width:13,height:13,borderRadius:"50%",border:"2px solid #fff",background:st.dot,cursor:isRaiz?"pointer":"default",flexShrink:0,boxShadow:`0 0 0 1.5px ${st.color}`}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          {isRaiz && editTaskId === task.id
                            ? <input value={editTaskLabel} autoFocus
                                onChange={e=>setEditTaskLabel(e.target.value)}
                                onBlur={()=>{renameTask(task.id,editTaskLabel);setEditTaskId(null);}}
                                onKeyDown={e=>{if(e.key==="Enter"){renameTask(task.id,editTaskLabel);setEditTaskId(null);}if(e.key==="Escape")setEditTaskId(null);}}
                                style={{fontWeight:500,border:"none",borderBottom:`1px solid ${NAVY}`,outline:"none",background:"transparent",fontSize:"inherit",color:TEXT,minWidth:0,flex:1}}/>
                            : <span onClick={isRaiz?()=>{setEditTaskId(task.id);setEditTaskLabel(task.label);}:undefined}
                                style={{fontWeight:500,textDecoration:done?"line-through":"none",color:done?TMUTED:TEXT,cursor:isRaiz?"text":"default"}}>{task.label}</span>
                          }
                          {isInt&&isRaiz&&<IBadge/>}
                          {task.hidden&&isRaiz&&<span style={{fontSize:10,background:"#f3f4f6",color:TMUTED,padding:"1px 7px",borderRadius:99,fontWeight:600}}>hidden</span>}
                          <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
                            {isRaiz&&(
                              <>
                                <button onClick={()=>moveTask(task.id,'up')} title="Move up" style={{background:"transparent",border:"none",color:TMUTED,cursor:"pointer",fontSize:11,padding:"0 1px",lineHeight:1}}>↑</button>
                                <button onClick={()=>moveTask(task.id,'down')} title="Move down" style={{background:"transparent",border:"none",color:TMUTED,cursor:"pointer",fontSize:11,padding:"0 1px",lineHeight:1}}>↓</button>
                              </>
                            )}
                            <span style={{fontSize:11,padding:"2px 9px",borderRadius:99,background:`${st.color}18`,color:st.color,fontWeight:600}}>{st.label}</span>
                            {task.instructions&&<button onClick={()=>setInstrOpen(iOpen?null:task.key)} style={{fontSize:11,background:"transparent",border:"none",color:TMUTED,cursor:"pointer"}}>{iOpen?"▲ hide":"ℹ guide"}</button>}
                            {isRaiz&&<LockBtn active={isInt} onClick={()=>toggleTaskInternal(task.key)}/>}
                            {isRaiz&&(
                              task.is_custom
                                ? <button onClick={()=>deleteCustomTask(task.id,task.key)} title="Delete task" style={{background:"transparent",border:"none",color:TMUTED,cursor:"pointer",fontSize:13,padding:"0 2px"}}>×</button>
                                : <button onClick={()=>toggleTaskHidden(task.id)} title={task.hidden?"Restore task":"Hide task"} style={{background:"transparent",border:"none",color:task.hidden?"#059669":TMUTED,cursor:"pointer",fontSize:11,fontWeight:600,padding:"0 2px"}}>{task.hidden?"show":"hide"}</button>
                            )}
                          </div>
                        </div>
                        {iOpen&&<div style={{marginTop:8,padding:12,background:FGRAY,border:`1px solid ${LGRAY}`,borderRadius:8,fontSize:12,color:TMID,lineHeight:1.7}}>{task.instructions}</div>}
                        {tlog.length>0&&(
                          <div style={{marginTop:8}}>
                            <button onClick={()=>setLogsOpen(o=>({...o,[task.key]:!o[task.key]}))} style={{fontSize:11,color:TMUTED,background:"transparent",border:"none",cursor:"pointer"}}>
                              {logVis?"▲":"▼"} {tlog.length} note{tlog.length>1?"s":""}
                            </button>
                            {logVis&&(
                              <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:4}}>
                                {tlog.map(e=>{
                                  const ini = e.author ? e.author.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase() : null;
                                  const tip = `${e.author || ""}${e.author ? " · " : ""}${new Date(e.ts).toLocaleString()}`;
                                  return (
                                    <div key={e.id} title={tip} style={{display:"flex",alignItems:"baseline",gap:6,padding:"6px 10px",background:e.internal?"#eef2ff":"#fafafa",border:`1px solid ${LGRAY}`,borderRadius:6,fontSize:12}}>
                                      {ini && <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:"50%",background:e.author_role==="client"?"#128387": "rgb(8, 21, 83)",color:"#fff",fontSize:9,fontWeight:700,flexShrink:0,lineHeight:1}}>{ini}</span>}
                                      <span style={{color:TMUTED,flexShrink:0}}>
                                        {e.author && `${shortName(e.author)} · `}{fmtTs(e.ts)}
                                      </span>
                                      {e.internal&&<span style={{fontSize:10,color:NAVY,flexShrink:0}}>🔒</span>}
                                      <span style={{flex:1}}>{e.text}</span>
                                      {e.author_id===session.user.id&&(isRaiz||getSt(task.key)!=='complete')&&(
                                        <button onClick={()=>deleteNote(task.key,e.id)} title="Delete note" style={{marginLeft:"auto",background:"transparent",border:"none",color:TMUTED,cursor:"pointer",fontSize:14,padding:"0 2px",flexShrink:0}}>×</button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        {(isRaiz||getSt(task.key)!=='complete')&&(
                          <div style={{marginTop:8,display:"flex",gap:6,alignItems:"center"}}>
                            <input value={noteIn[task.key]||""} onChange={e=>setNoteIn(n=>({...n,[task.key]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addNote(task.key)} placeholder="Add a note…" style={{...iSt,flex:1}}/>
                            {isRaiz&&<LockBtn active={!!noteIntF[task.key]} onClick={()=>toggleNoteIntF(task.key)}/>}
                            <button onClick={()=>addNote(task.key)} style={{background:NAVY,border:"none",borderRadius:6,padding:"5px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:600}}>+ Log</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {visTasks.filter(t=>!t.hidden).length===0&&!isRaiz&&<div style={{padding:32,textAlign:"center",color:TMUTED,fontSize:13}}>No visible tasks for this phase in client view.</div>}
              {isRaiz&&(
                <div style={{marginTop:4}}>
                  {addTaskPhase===phase
                    ? <div style={{display:"flex",gap:6,alignItems:"center",padding:"8px 12px",background:FGRAY,border:`1px dashed ${LGRAY}`,borderRadius:10}}>
                        <input value={addTaskLabel} onChange={e=>setAddTaskLabel(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")addCustomTask(phase);if(e.key==="Escape")setAddTaskPhase(null);}}
                          autoFocus placeholder="New task label…" style={{...iSt,flex:1}}/>
                        <button onClick={()=>addCustomTask(phase)} style={{background:NAVY,border:"none",borderRadius:6,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Add</button>
                        <button onClick={()=>setAddTaskPhase(null)} style={{background:"transparent",border:"none",color:TMUTED,cursor:"pointer",fontSize:16}}>×</button>
                      </div>
                    : <button onClick={()=>{setAddTaskPhase(phase);setAddTaskLabel("");}}
                        style={{fontSize:11,color:TMUTED,background:"transparent",border:`1px dashed ${LGRAY}`,borderRadius:8,padding:"6px 16px",cursor:"pointer",width:"100%"}}>
                        + Add task
                      </button>
                  }
                </div>
              )}
            </div>

            {/* Legend */}
            <div style={{display:"flex",gap:16,marginTop:20,flexWrap:"wrap",fontSize:11,color:TMUTED}}>
              <span style={{fontWeight:600,color:TMID}}>Status:</span>
              {STATUS_OPTS.map(s=>(
                <span key={s.key} style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:s.dot,border:`1.5px solid ${s.color}`,display:"inline-block"}}/>
                  {s.label}
                </span>
              ))}
              {isRaiz&&<span>· click dot to cycle</span>}
              {isRaiz&&<span>· 🔒 = internal only</span>}
            </div>
          </>
        )}

        {/* ════ REFERENCE ════ */}
        {tab==="reference" && (
          <div style={{display:"flex",flexDirection:"row",gap:20}}>

            {/* LEFT column */}
            <div style={{flex:"1 1 0",minWidth:0,display:"flex",flexDirection:"column",gap:20}}>

              <Card internal={refNotesInt&&isRaiz}>
                <CHead internal={refNotesInt&&isRaiz} right={isRaiz&&<LockBtn active={refNotesInt} onClick={toggleRefNotesInt}/>}>
                  Engagement Notes {refNotesInt&&isRaiz&&<IBadge/>}
                </CHead>
                {isRaiz
                  ? <textarea value={refNotes} onChange={e=>updateRefNotes(e.target.value)} rows={8} style={{width:"100%",background:"transparent",border:"none",padding:"14px 16px",color:TEXT,fontSize:13,lineHeight:1.75,resize:"vertical",outline:"none",boxSizing:"border-box"}} placeholder="General notes…"/>
                  : (!refNotesInt
                      ? <div style={{padding:"14px 16px",fontSize:13,color:TEXT,lineHeight:1.75,whiteSpace:"pre-wrap"}}>{refNotes}</div>
                      : <div style={{padding:"14px 16px",color:TMUTED,fontSize:13,fontStyle:"italic"}}>Internal — hidden in client view.</div>
                    )
                }
              </Card>

              <Card>
                <CHead>🔗 Links & Resources</CHead>
                <div style={{padding:"14px 16px"}}>
                  {links.filter(l=>isRaiz||!l.internal).length>0
                    ? <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                        {links.filter(l=>isRaiz||!l.internal).map(l=>(
                          <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:FGRAY,border:`1px solid ${LGRAY}`,borderRadius:8}}>
                            {l.internal&&<span style={{fontSize:10,color:NAVY}}>🔒</span>}
                            <a href={l.url} target="_blank" rel="noreferrer" style={{flex:1,color:NAVY,fontSize:13,textDecoration:"none",fontWeight:600}}>{l.label}</a>
                            <span style={{fontSize:11,color:TMUTED,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.url}</span>
                            {isRaiz&&<LockBtn active={!!l.internal} onClick={()=>toggleLinkInt(l.id)}/>}
                            {isRaiz&&<button onClick={()=>removeLink(l.id)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:16,color:TMUTED}}>×</button>}
                          </div>
                        ))}
                      </div>
                    : <div style={{color:TMUTED,fontSize:13,marginBottom:14}}>No links added yet.</div>
                  }
                  {isRaiz&&(
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <input value={linkIn.label} onChange={e=>setLinkIn(l=>({...l,label:e.target.value}))} placeholder="Label (optional)" style={{...iSt,flex:"1 1 130px"}}/>
                      <input value={linkIn.url} onChange={e=>setLinkIn(l=>({...l,url:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addLink()} placeholder="https://…" style={{...iSt,flex:"2 1 200px"}}/>
                      <button onClick={addLink} style={{background:NAVY,border:"none",borderRadius:6,padding:"7px 18px",color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer"}}>Add</button>
                    </div>
                  )}
                </div>
              </Card>

              {isRaiz&&(
                <Card internal>
                  <CHead internal right={<IBadge/>}>📋 Raiz Delivery Standards</CHead>
                  <div style={{padding:"14px 16px",fontSize:12,color:TMID,lineHeight:1.85}}>
                    {STANDARDS.map((s,i)=>(
                      <div key={i} style={{display:"flex",gap:10,marginBottom:6}}>
                        <span style={{color:NAVY,flexShrink:0}}>·</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* RIGHT column — team */}
            <div style={{width:200,flexShrink:0,flexGrow:0,alignSelf:"flex-start",position:"sticky",top:16,maxHeight:"calc(100vh - 180px)",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,fontWeight:700,color:TMID,textTransform:"uppercase",letterSpacing:"0.07em"}}>Raiz Team</span>
                {isRaiz&&<button onClick={addMember} style={{fontSize:11,background:NAVY,color:"#fff",border:"none",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontWeight:600}}>+ Add</button>}
              </div>

              {members.map((m,i)=>{
                const ini=(m.name||"?").trim().split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
                return (
                  <div key={m.id||i} style={{display:"flex",flexDirection:"column",gap:6}}>
                    {isRaiz&&(
                      <div style={{display:"flex",flexDirection:"column",gap:4,padding:"8px 10px",background:FGRAY,border:`1px solid ${LGRAY}`,borderRadius:8}}>
                        <div style={{display:"flex",gap:4}}>
                          <input value={m.name} onChange={e=>updMember(i,"name",e.target.value)} placeholder="Full name" style={{...iSt,flex:1,fontSize:11,padding:"3px 7px",fontWeight:600}}/>
                          {members.length>1&&<button onClick={()=>remMember(i)} style={{background:"transparent",border:"none",color:TMUTED,cursor:"pointer",fontSize:15}}>×</button>}
                        </div>
                        {["title","email","slack","avatar_url","booking"].map(f=>(
                          <input key={f} value={m[f]||""} onChange={e=>updMember(i,f,e.target.value)}
                            placeholder={{title:"Title",email:"Email",slack:"Slack (@handle)",avatar_url:"Photo URL",booking:"Booking URL"}[f]}
                            style={{...iSt,fontSize:11,padding:"3px 7px"}}/>
                        ))}
                      </div>
                    )}
                    {m.name&&(
                      <div style={{border:`1px solid ${LGRAY}`,borderRadius:10,overflow:"hidden",background:"#fff",boxShadow:"0 1px 4px rgba(6,21,83,0.07)"}}>
                        <div style={{padding:"12px"}}>
                          <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
                            <div style={{flexShrink:0}}>
                              {m.avatar_url&&<img src={m.avatar_url} alt={m.name} onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex"}} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",display:"block"}}/>}
                              <div style={{width:40,height:40,borderRadius:"50%",background:NAVY,display:m.avatar_url?"none":"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14}}>{ini}</div>
                            </div>
                            <div style={{minWidth:0}}>
                              <div style={{fontWeight:700,fontSize:13,lineHeight:1.3}}>{m.name}</div>
                              {m.title&&<div style={{fontSize:11,color:TMUTED,marginTop:2,lineHeight:1.3}}>{m.title}</div>}
                            </div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {m.email&&<a href={`mailto:${m.email}`} style={{...iBtnSt,background:NAVY,color:"#fff",width:"100%"}}>✉ Email</a>}
                            {m.slack&&<a href={`https://slack.com/app_redirect?channel=${m.slack.replace("@","")}`} target="_blank" rel="noreferrer" style={{...iBtnSt,background:"#4a154b",color:"#fff",width:"100%"}}>💬 Slack</a>}
                            {m.booking&&<a href={m.booking} target="_blank" rel="noreferrer" style={{...iBtnSt,background:"#047857",color:"#fff",width:"100%"}}>📅 Book</a>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── Footer actions ── */}
      <div style={{borderTop:`1px solid ${LGRAY}`,marginTop:8,padding:"20px 24px"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",flexDirection:"column",gap:12}}>

          {/* Raiz: invite client */}
          {!isClientUser && (
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:600,color:TMID,minWidth:100}}>Invite client</span>
              {inviteStatus==="sent"
                ? <span style={{fontSize:12,color:"#059669",fontWeight:600}}>Invite sent ✓</span>
                : <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&inviteClient()}
                      type="email" placeholder="Client email" style={{...iSt,width:220,fontSize:12}}/>
                    <button onClick={inviteClient} disabled={inviteStatus==="sending"}
                      style={{background:NAVY,border:"none",borderRadius:6,padding:"6px 16px",color:"#fff",fontWeight:600,fontSize:12,cursor:inviteStatus==="sending"?"default":"pointer",opacity:inviteStatus==="sending"?0.6:1}}>
                      {inviteStatus==="sending"?"Sending…":"Send invite"}
                    </button>
                    {inviteStatus==="error" && <span style={{fontSize:11,color:"#dc2626"}}>{inviteError}</span>}
                  </div>
              }
            </div>
          )}

          {/* Raiz: add client manually */}
          {!isClientUser && (
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:600,color:TMID,minWidth:100}}>Add client</span>
              {addStatus==="saved"
                ? <span style={{fontSize:12,color:"#059669",fontWeight:600}}>Client added ✓</span>
                : <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <input value={addEmail} onChange={e=>setAddEmail(e.target.value)}
                      type="email" placeholder="Client email" style={{...iSt,width:200,fontSize:12}}/>
                    <input value={addPassword} onChange={e=>setAddPassword(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&createClient()}
                      type="text" placeholder="Temp password" style={{...iSt,width:150,fontSize:12}}/>
                    <button onClick={createClient} disabled={addStatus==="saving"||!addEmail||!addPassword}
                      style={{background:NAVY,border:"none",borderRadius:6,padding:"6px 16px",color:"#fff",fontWeight:600,fontSize:12,cursor:addStatus==="saving"||!addEmail||!addPassword?"default":"pointer",opacity:addStatus==="saving"||!addEmail||!addPassword?0.6:1}}>
                      {addStatus==="saving"?"Adding…":"Add client"}
                    </button>
                    {addStatus==="error" && <span style={{fontSize:11,color:"#dc2626"}}>{addError}</span>}
                  </div>
              }
            </div>
          )}

          {/* Client: set password */}
          {isClientUser && (
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:12,fontWeight:600,color:TMID,minWidth:100}}>Set password</span>
              {pwStatus==="saved"
                ? <span style={{fontSize:12,color:"#059669",fontWeight:600}}>Password saved ✓</span>
                : <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <input value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                      onKeyDown={async e=>{
                        if(e.key==="Enter"){
                          setPwStatus("saving"); setPwError("");
                          const {error} = await supabase.auth.updateUser({password: newPassword});
                          if(error){setPwStatus("error");setPwError(error.message);}
                          else{setPwStatus("saved");setNewPassword("");}
                        }
                      }}
                      type="password" placeholder="New password" style={{...iSt,width:200,fontSize:12}}/>
                    <button
                      disabled={pwStatus==="saving"||!newPassword}
                      onClick={async()=>{
                        setPwStatus("saving"); setPwError("");
                        const {error} = await supabase.auth.updateUser({password: newPassword});
                        if(error){setPwStatus("error");setPwError(error.message);}
                        else{setPwStatus("saved");setNewPassword("");}
                      }}
                      style={{background:NAVY,border:"none",borderRadius:6,padding:"6px 16px",color:"#fff",fontWeight:600,fontSize:12,cursor:pwStatus==="saving"||!newPassword?"default":"pointer",opacity:pwStatus==="saving"||!newPassword?0.6:1}}>
                      {pwStatus==="saving"?"Saving…":"Save password"}
                    </button>
                    {pwStatus==="error" && <span style={{fontSize:11,color:"#dc2626"}}>{pwError}</span>}
                  </div>
              }
            </div>
          )}

        </div>
      </div>

    </div>
  );
}