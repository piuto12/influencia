import { requirePageAccess } from "@/lib/auth";
import { adminSocial } from "@/modules/content/admin-queries";
import { saveSocial } from "@/modules/content/actions";
import { btn, Card, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("settings.manage");
  const sp = await searchParams; const rows = (await adminSocial()) as { platform: string; url: string; enabled: boolean }[];
  return (
    <>
      <PageTitle>Social media</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <Card><form action={saveSocial} className="space-y-4">{["youtube", "instagram", "facebook", "linkedin"].map((p) => { const r = rows.find((x) => x.platform === p); return (
        <div key={p} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]"><label className="text-sm capitalize">{p} link (https://…) — empty removes it<input name={`${p}_url`} defaultValue={r?.url ?? ""} className={`${field} mt-1`} /></label>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name={`${p}_enabled`} defaultChecked={r?.enabled ?? true} /> Show</label></div>); })}
        <button className={btn}>Save social links</button></form></Card>
    </>
  );
}
