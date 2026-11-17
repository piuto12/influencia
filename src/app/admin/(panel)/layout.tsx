import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { enforceMfa, getAdmin } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";
import { signOut } from "@/modules/admin/actions";

const NAV: { href: string; label: string; perm?: Permission[] }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/participants", label: "Participants", perm: ["participants.read"] },
  { href: "/admin/payments", label: "Payments", perm: ["payments.read"] },
  { href: "/admin/attendance", label: "Attendance", perm: ["attendance.manage"] },
  { href: "/admin/certificates", label: "Certificates", perm: ["certificates.manage"] },
  { href: "/admin/notifications", label: "Notifications", perm: ["participants.write", "settings.manage"] },
  { href: "/admin/reports", label: "Reports", perm: ["reports.registration", "reports.finance"] },
  { href: "/admin/settings/event", label: "Event settings", perm: ["events.manage"] },
  { href: "/admin/settings/payments", label: "Payment settings", perm: ["payments.configure"] },
  { href: "/admin/content/sections", label: "Homepage sections", perm: ["content.manage"] },
  { href: "/admin/content/pages", label: "Pages", perm: ["content.manage"] },
  { href: "/admin/content/blog", label: "Blog", perm: ["content.manage"] },
  { href: "/admin/media/videos", label: "Videos", perm: ["media.manage"] },
  { href: "/admin/media/testimonials", label: "Testimonials", perm: ["media.manage"] },
  { href: "/admin/media/gallery", label: "Gallery", perm: ["media.manage"] },
  { href: "/admin/settings/editions", label: "Editions", perm: ["events.manage"] },
  { href: "/admin/settings/branding", label: "Branding", perm: ["settings.manage"] },
  { href: "/admin/settings/social", label: "Social media", perm: ["settings.manage"] },
  { href: "/admin/settings/navigation", label: "Navigation", perm: ["settings.manage"] },
  { href: "/admin/audit", label: "Audit log", perm: ["audit.read"] },
  { href: "/admin/admins", label: "Administrators", perm: ["admins.manage"] },
];

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin · Influencia", robots: { index: false, follow: false } };

// Admin pages are signed-in, per-request views; they are not expected to be instant navigations (dev-only validation).
export const instant = false;

async function Frame({ children }: { children: ReactNode }) {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  enforceMfa(a);
  return (
    <div className="min-h-screen bg-warm text-charcoal md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-maroon-deep p-5 text-white md:min-h-screen">
        <p className="font-display text-2xl uppercase">Influencia</p>
        <p className="text-xs uppercase tracking-widest text-white/60">Admin</p>
        <nav aria-label="Admin" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm md:flex-col md:gap-3">
          {NAV.filter((n) => !n.perm || n.perm.some((p) => can(a.role, p))).map((n) => <Link key={n.href} href={n.href} className="text-white/85 hover:text-white">{n.label}</Link>)}
        </nav>
        <div className="mt-8 text-xs text-white/70"><p>{a.name}</p><p>{a.role.replace(/_/g, " ")}</p>
          <p><Link href="/admin/security" className="underline">Security</Link></p>
          <form action={signOut}><button className="mt-2 underline">Sign out</button></form></div>
      </aside>
      <main className="min-w-0 p-5 md:p-8">{children}</main>
    </div>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="p-8">Loading…</p>}><Frame>{children}</Frame></Suspense>;
}
