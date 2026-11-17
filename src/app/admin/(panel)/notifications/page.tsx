import { requirePageAccess } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEdition } from "@/modules/admin/queries";
import { emailConfigured } from "@/modules/notifications/email";
import { DEFAULTS, TEMPLATE_KEYS, TEMPLATE_LABELS, VARIABLES } from "@/modules/notifications/templates";
import { BULK_KEYS } from "@/modules/ops/schemas";
import { resetNotificationTemplate, saveNotificationTemplate, sendBulk } from "@/modules/ops/actions";
import { btn, btnGhost, Card, EditionSwitcher, field, Flash, PageTitle, Td, Th, when, type SP } from "@/components/admin/ui";

// Bulk email / PDF / export work can exceed the platform default timeout.
export const maxDuration = 60;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const a = await requirePageAccess(["participants.write", "settings.manage"]);
  const sp = await searchParams; const { edition, all } = await resolveEdition(sp.edition);
  const db = createAdminClient();
  const [{ data: saved }, { data: log }] = await Promise.all([db.from("notification_templates").select("key,subject,body"), db.from("notifications").select("id,channel,template_key,status,error,created_at,registrations(reference)").order("created_at", { ascending: false }).limit(60)]);
  const custom = new Map((saved ?? []).map((t) => [t.key, t])); const configured = emailConfigured();
  return (
    <>
      <PageTitle>Notifications</PageTitle><Flash ok={sp.ok} err={sp.err} />
      {!configured && <p role="alert" className="mb-4 rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900">Email sending is not configured. Set <code>EMAIL_PROVIDER_API_KEY</code> and <code>EMAIL_FROM</code> on the server (see README). Until then emails are recorded as failed; WhatsApp click-to-chat links on each participant page still work.</p>}
      {edition && can(a.role, "participants.write") && (<>
        <EditionSwitcher all={all} current={edition} base="/admin/notifications" />
        <Card title="Send to all confirmed participants"><form action={sendBulk} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"><input type="hidden" name="code" value={edition.code} />
          <label className="text-sm">Message<select name="key" className={`${field} mt-1`}>{BULK_KEYS.map((k) => <option key={k} value={k}>{TEMPLATE_LABELS[k]}</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> I confirm this goes to every confirmed participant</label><button className={btn}>Send</button></form></Card></>)}
      {can(a.role, "settings.manage") && <Card title="Message templates" className="mt-6">
        <p className="mb-3 text-sm text-charcoal/70">Variables: {VARIABLES.map((v) => <code key={v} className="mr-2">{`{{${v}}}`}</code>)}. <code>{"{{group_link}}"}</code> is filled only for confirmed participants.</p>
        <div className="space-y-3">{TEMPLATE_KEYS.map((k) => { const t = custom.get(k) ?? DEFAULTS[k]; return (
          <details key={k} className="rounded-xl border border-charcoal/10 p-4"><summary className="cursor-pointer font-medium">{TEMPLATE_LABELS[k]} {custom.has(k) && <span className="ml-2 text-xs text-crimson">customised</span>}</summary>
            <form action={saveNotificationTemplate} className="mt-3 space-y-3"><input type="hidden" name="key" value={k} />
              <input name="subject" defaultValue={t.subject ?? ""} className={field} aria-label="Subject" /><textarea name="body" rows={9} defaultValue={t.body} className={`${field} font-mono`} aria-label="Body" />
              <button className={btn}>Save</button></form>
            {custom.has(k) && <form action={resetNotificationTemplate} className="mt-2"><input type="hidden" name="key" value={k} /><button className={btnGhost}>Reset to default</button></form>}</details>); })}</div></Card>}
      <Card title="Recent notifications" className="mt-6"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><Th>When</Th><Th>Reference</Th><Th>Type</Th><Th>Channel</Th><Th>Result</Th></tr></thead><tbody className="divide-y divide-charcoal/5">
        {(log ?? []).map((n) => <tr key={n.id}><Td>{when(n.created_at)}</Td><Td>{(n.registrations as unknown as { reference: string } | null)?.reference ?? "—"}</Td><Td>{n.template_key.replace(/_/g, " ")}</Td><Td>{n.channel}</Td><Td className={n.status === "failed" ? "text-red-700" : "text-emerald-800"}>{n.status}{n.error ? ` (${n.error})` : ""}</Td></tr>)}
        {!log?.length && <tr><Td className="py-6 text-center text-charcoal/60">Nothing sent yet.</Td></tr>}</tbody></table></div></Card>
    </>
  );
}
