import { requirePageAccess } from "@/lib/auth";
import { editionFull, resolveEdition } from "@/modules/admin/queries";
import { saveEditionSettings } from "@/modules/admin/actions";
import { isoToIstInput } from "@/modules/admin/schemas";
import { L, btn, Card, EditionSwitcher, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("events.manage");
  const sp = await searchParams;
  const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition.</p>;
  const e = await editionFull(edition.id);
  return (
    <>
      <PageTitle>Event settings</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <EditionSwitcher all={all} current={edition} base="/admin/settings/event" />
      <Card>
        <form action={saveEditionSettings} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="editionId" value={e.id} /><input type="hidden" name="code" value={e.code} />
          <L k="title" label="Title" v={e.title} /><L k="subtitle" label="Subtitle" v={e.subtitle} />
          <L k="starts_at" label="Starts (IST)" type="datetime-local" v={isoToIstInput(e.starts_at)} />
          <L k="registration_deadline" label="Registration deadline (IST)" type="datetime-local" v={isoToIstInput(e.registration_deadline)} />
          <L k="venue_name" label="Venue" v={e.venue_name} /><L k="venue_city" label="City" v={e.venue_city} />
          <L k="venue_address" label="Address" v={e.venue_address} /><L k="capacity" label="Maximum confirmed capacity" type="number" v={e.capacity} />
          <label className="text-sm">Status<select name="status" defaultValue={e.status} className={`${field} mt-1`}>{["draft", "upcoming", "active", "completed", "archived"].map((s) => <option key={s}>{s}</option>)}</select></label>
          <L k="whatsapp_group_url" label="Official WhatsApp group link (shown only to confirmed participants)" v={e.whatsapp_group_url} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="registration_open" defaultChecked={e.registration_open} /> Registration open</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="waitlist_enabled" defaultChecked={e.waitlist_enabled} /> Waiting list enabled</label>
          <div className="sm:col-span-2"><button className={btn}>Save event settings</button></div>
        </form>
      </Card>
    </>
  );
}
