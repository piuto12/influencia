import { requirePageAccess } from "@/lib/auth";
import { auditLog } from "@/modules/admin/queries";
import { PageTitle, Td, Th, when } from "@/components/admin/ui";

export default async function Page() {
  await requirePageAccess("audit.read");
  const rows = await auditLog();
  return (
    <>
      <PageTitle>Audit log</PageTitle>
      <div className="overflow-x-auto rounded-2xl border border-charcoal/10 bg-white"><table className="w-full text-sm">
        <thead className="border-b"><tr><Th>When</Th><Th>Action</Th><Th>Entity</Th><Th>Actor</Th><Th>IP</Th></tr></thead>
        <tbody className="divide-y divide-charcoal/5">{rows.map((r: { id: number; created_at: string; action: string; entity_type: string; entity_id: string; actor_id: string | null; ip: string | null }) => <tr key={r.id}>
          <Td>{when(r.created_at)}</Td><Td>{r.action}</Td><Td>{r.entity_type} <span className="text-xs text-charcoal/50">{r.entity_id?.slice(0, 13)}</span></Td><Td className="text-xs">{r.actor_id?.slice(0, 8) ?? "system"}</Td><Td>{r.ip ?? "—"}</Td></tr>)}</tbody></table></div>
    </>
  );
}
