import { requirePageAccess } from "@/lib/auth";
import { adminNav } from "@/modules/content/admin-queries";
import { saveNavigation } from "@/modules/content/actions";
import { nav as defaults } from "@/modules/events/site-content";
import { btn, Card, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("settings.manage");
  const sp = await searchParams; const saved = await adminNav();
  const items = saved ?? defaults.map((n) => ({ label: n.label, href: n.href, visible: true }));
  const rows = [...items, ...Array.from({ length: Math.max(0, 12 - items.length) }, () => ({ label: "", href: "", visible: true }))];
  return (
    <>
      <PageTitle>Navigation</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <p className="mb-4 text-sm text-charcoal/70">Rows are shown in this order in the header and footer. Clear both fields of a row to remove it. Clearing every row restores the built-in menu.</p>
      <Card><form action={saveNavigation} className="space-y-2">{rows.map((r, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"><input name={`label_${i}`} defaultValue={r.label} placeholder="Label" aria-label={`Label ${i + 1}`} className={field} />
          <input name={`href_${i}`} defaultValue={r.href} placeholder="/about or https://…" aria-label={`Link ${i + 1}`} className={field} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`visible_${i}`} defaultChecked={r.visible} /> Visible</label></div>))}
        <button className={`${btn} mt-3`}>Save navigation</button></form></Card>
    </>
  );
}
