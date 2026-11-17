import type { Metadata } from "next";
import { Suspense } from "react";
import { signIn } from "@/modules/admin/actions";
import { Flash, field, btn, type SP } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

async function Form({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <form action={signIn} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-xl">
      <h1 className="font-serif text-3xl text-charcoal">Admin sign in</h1>
      <Flash err={sp.err} />
      <div><label htmlFor="email" className="mb-1 block text-sm">Email</label><input id="email" name="email" type="email" autoComplete="username" required className={field} /></div>
      <div><label htmlFor="password" className="mb-1 block text-sm">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className={field} /></div>
      <button className={`${btn} w-full justify-center`}>Sign in</button>
    </form>
  );
}
export default function Page(props: { searchParams: SP }) {
  return <main className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-hero)] p-5"><Suspense><Form {...props} /></Suspense></main>;
}
