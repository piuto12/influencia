import Link from "next/link";
import { contacts, edition, nav as defaultNav } from "@/modules/events/site-content";
import { getBranding, getNav, getSocialLinks } from "@/modules/content/queries";
import { mediaUrl } from "@/modules/content/media";
import Image from "next/image";

export async function Footer() {
  const [custom, social, branding] = await Promise.all([getNav(), getSocialLinks(), getBranding()]);
  const logo = mediaUrl(branding.logo_path);
  const nav = custom ? custom.filter((n) => n.visible) : [...defaultNav];
  return (
    <footer className="bg-charcoal text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          {logo ? <Image src={logo} alt={branding.logo_alt || "Influencia"} width={220} height={56} className="h-12 w-auto max-w-[14rem] object-contain" /> : <p className="font-display text-3xl uppercase text-white">Influencia</p>}
          <p className="mt-2 text-sm">{edition.editionLabel} · {edition.dateLabel}<br />{edition.venue}, {edition.city}</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-2 text-sm">
          {nav.map((n) => <Link key={n.href} href={n.href} className="hover:text-white">{n.label}</Link>)}
          <Link href="/registration-status" className="hover:text-white">Registration Status</Link>
          <Link href="/certificates/verify" className="hover:text-white">Verify Certificate</Link>
        </nav>
        <div className="text-sm">
          {contacts.map((c) => <p key={c.name}>{c.name}: <a className="hover:text-white" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></p>)}
          {social.length > 0 && <p className="mt-3 flex flex-wrap gap-4">{social.map((s) => <a key={s.platform} href={s.url} rel="noopener noreferrer" target="_blank" className="capitalize hover:text-white">{s.platform}</a>)}</p>}
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs">
        © {edition.organizer.split(" / ")[1]} · <Link href="/privacy" className="hover:text-white">Privacy</Link> · <Link href="/terms" className="hover:text-white">Terms</Link>
      </div>
    </footer>
  );
}
