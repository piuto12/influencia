import { redirect } from "next/navigation";
import { enforceMfa, getAdmin } from "@/lib/auth";
import { dashboard, resolveEdition } from "@/modules/admin/queries";
import { can } from "@/lib/rbac";
import { Card, EditionSwitcher, Flash, PageTitle, Stat, type SP, money } from "@/components/admin/ui";
import { CATEGORIES } from "@/modules/registration/schemas";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  enforceMfa(a);
  const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition exists yet. Create one in the database (see README).</p>;
  const d = await dashboard(edition);
  const finance = can(a.role, "payments.read");
  const label = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
  const max = Math.max(1, ...Object.values(d.reg.byCategory));
  return (
    <>
      <PageTitle>Dashboard</PageTitle>
      {sp.denied && <Flash err="You don’t have access to that page." />}
      <EditionSwitcher all={all} current={edition} base="/admin" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registrations" value={d.reg.total} />
        <Stat label="Confirmed" value={d.reg.confirmed} hint={`Capacity ${edition.capacity}`} />
        <Stat label="Pending" value={d.reg.pending} hint="Not counted as seats" />
        <Stat label="Available seats" value={d.reg.availableSeats} />
        {finance && <Stat label="Awaiting verification" value={d.pay.awaitingVerification} />}
        {finance && <Stat label="Verified collection (net)" value={Object.keys(d.pay.net).length ? Object.entries(d.pay.net).map(([c, v]) => money(v, c)).join(" · ") : "₹0"} hint="After recorded refunds" />}
        <Stat label="Checked in" value={d.reg.checkedIn} hint={`${d.reg.attendanceRate}% of confirmed`} />
        <Stat label="Waitlisted" value={d.reg.byStatus.waitlisted ?? 0} />
      </div>
      <Card title="Participant categories" className="mt-6">
        {Object.keys(d.reg.byCategory).length === 0 ? <p className="text-sm text-charcoal/60">No registrations yet.</p> :
          <ul className="space-y-2">{Object.entries(d.reg.byCategory).sort((x, y) => y[1] - x[1]).map(([k, v]) => (
            <li key={k} className="grid grid-cols-[11rem_1fr_2.5rem] items-center gap-3 text-sm"><span>{label(k)}</span>
              <span className="h-3 rounded-full bg-crimson/10"><span className="block h-3 rounded-full bg-crimson" style={{ width: `${(v / max) * 100}%` }} /></span><span className="text-right">{v}</span></li>))}</ul>}
      </Card>
    </>
  );
}
