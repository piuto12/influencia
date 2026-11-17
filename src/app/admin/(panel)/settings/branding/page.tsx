import { requirePageAccess } from "@/lib/auth";
import { adminBranding } from "@/modules/content/admin-queries";
import { saveBranding } from "@/modules/content/actions";
import { UploadField } from "@/components/admin/UploadField";
import { btn, Card, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("settings.manage");
  const sp = await searchParams; const b = await adminBranding();
  return (
    <>
      <PageTitle>Branding</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <p className="mb-4 max-w-3xl text-sm text-charcoal/70">Upload the speaker&apos;s portrait and the official logo. Use only images you have the right to publish. Changes appear on the public site within about a minute. Leave a slot empty to use the built-in default.</p>
      <form action={saveBranding} className="grid gap-6 lg:grid-cols-2">
        <Card title="Speaker portrait (homepage hero)">
          <div className="space-y-4">
            <UploadField name="speaker_path" folder="branding" label="Portrait image (JPG, PNG, WebP or AVIF, up to 10 MB)" initial={b.speaker_path} />
            <label className="block text-sm">Display style
              <select name="speaker_style" defaultValue={b.speaker_style ?? "cutout"} className={`${field} mt-1`}>
                <option value="cutout">Cut-out — transparent PNG laid over the red background (like the poster)</option>
                <option value="circle">Circle — any normal photo, cropped into a circle</option>
              </select></label>
            <label className="block text-sm">Description for screen readers
              <input name="speaker_alt" defaultValue={b.speaker_alt ?? ""} maxLength={120} placeholder="Dr. Rashid Gazzali" className={`${field} mt-1`} /></label>
            <p className="text-xs text-charcoal/60">Best results: a portrait about 1200 × 1500 px. For the cut-out style the background must be transparent; otherwise choose Circle.</p>
          </div>
        </Card>
        <Card title="Official logo (header and footer)">
          <div className="space-y-4">
            <UploadField name="logo_path" folder="branding" label="Logo image (transparent PNG or WebP works best, light or white version for the dark header)" initial={b.logo_path} />
            <label className="block text-sm">Description for screen readers
              <input name="logo_alt" defaultValue={b.logo_alt ?? ""} maxLength={120} placeholder="Influencia" className={`${field} mt-1`} /></label>
            <p className="text-xs text-charcoal/60">The header and footer are dark red / charcoal, so a white or light logo reads best. Without a logo the site shows the text wordmark &ldquo;INFLUENCIA&rdquo;.</p>
          </div>
        </Card>
        <div className="lg:col-span-2"><button className={btn}>Save branding</button></div>
      </form>
    </>
  );
}
