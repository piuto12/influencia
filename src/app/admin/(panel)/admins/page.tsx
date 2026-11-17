import { requirePageAccess } from "@/lib/auth";
import { adminUsers } from "@/modules/admin/queries";
import { createAdminUser, updateAdminUser } from "@/modules/admin/actions";
import { btn, btnGhost, Card, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

const ROLES = [["super_admin", "Super admin"], ["registration_admin", "Registration admin"], ["finance_admin", "Finance admin"]];

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("admins.manage");
  const sp = await searchParams;
  const users = await adminUsers() as { id: string; display_name: string; role_code: string; active: boolean }[];
  return (
    <>
      <PageTitle>Administrators</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <Card title="Accounts"><ul className="divide-y divide-charcoal/10">{users.map((u) => (
        <li key={u.id} className="py-3"><form action={updateAdminUser} className="flex flex-wrap items-center gap-3 text-sm"><input type="hidden" name="id" value={u.id} />
          <strong className="min-w-40">{u.display_name}</strong>
          <select name="role" defaultValue={u.role_code} aria-label="Role" className={`${field} max-w-48`}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={u.active} /> Active</label><button className={btnGhost}>Update</button></form></li>))}</ul></Card>
      <Card title="Add administrator" className="mt-6">
        <form action={createAdminUser} className="grid gap-3 sm:grid-cols-2">
          <input name="display_name" placeholder="Full name" required className={field} /><input name="email" type="email" placeholder="Email" required className={field} />
          <select name="role" className={field} aria-label="Role">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input name="password" type="password" minLength={12} placeholder="Temporary password (12+ chars)" autoComplete="new-password" required className={field} />
          <div className="sm:col-span-2"><button className={btn}>Create administrator</button></div></form>
      </Card>
    </>
  );
}
