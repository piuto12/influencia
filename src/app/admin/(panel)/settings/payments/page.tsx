import { requirePageAccess } from "@/lib/auth";
import { paymentSettings, resolveEdition } from "@/modules/admin/queries";
import { savePaymentSettings } from "@/modules/admin/actions";
import { isoToIstInput } from "@/modules/admin/schemas";
import { I, btn, Card, EditionSwitcher, field, Flash, PageTitle, type SP } from "@/components/admin/ui";

type S = { method_code: string; enabled: boolean; fee_amount: number | string; currency: string; deadline: string | null; verification_mode: string; version: number;
  config: Record<string, string>; discounts: { label: string; type: string; value: number; valid_until?: string }[]; payment_methods: { label: string; provider: string } };

export default async function Page({ searchParams }: { searchParams: SP }) {
  await requirePageAccess("payments.configure");
  const sp = await searchParams;
  const { edition, all } = await resolveEdition(sp.edition);
  if (!edition) return <p>No edition.</p>;
  const rows = (await paymentSettings(edition.id)) as unknown as S[];
  return (
    <>
      <PageTitle>Payment settings</PageTitle><Flash ok={sp.ok} err={sp.err} />
      <EditionSwitcher all={all} current={edition} base="/admin/settings/payments" />
      <p className="mb-4 text-sm text-charcoal/70">Fees apply to new payments only; existing payments keep the fee they were created with. Never enter card details or gateway secrets here — Razorpay keys live in server environment variables.</p>
      <div className="space-y-6">{rows.map((s) => {
        const d = s.discounts[0];
        return (
          <Card key={s.method_code} title={`${s.payment_methods.label} (v${s.version})`}>
            <form action={savePaymentSettings} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="editionId" value={edition.id} /><input type="hidden" name="code" value={edition.code} /><input type="hidden" name="method" value={s.method_code} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Enabled</label>
              <label className="text-sm">Verification<select name="verification_mode" defaultValue={s.verification_mode} className={`${field} mt-1`}><option value="manual">Manual</option><option value="automatic">Automatic (gateway)</option></select></label>
              <I k="fee_amount" l="Registration fee" v={s.fee_amount} type="number" /><I k="currency" l="Currency" v={s.currency.trim()} />
              <I k="deadline" l="Payment deadline (IST)" v={isoToIstInput(s.deadline)} type="datetime-local" />
              {s.method_code.startsWith("upi") && <><I k="upi_id" l="UPI ID" v={s.config.upi_id} /><I k="payee_name" l="Payee name" v={s.config.payee_name} /></>}
              {s.method_code === "bank_transfer" && <><I k="account_name" l="Account name" v={s.config.account_name} /><I k="account_number" l="Account number" v={s.config.account_number} /><I k="ifsc" l="IFSC" v={s.config.ifsc} /><I k="bank_name" l="Bank" v={s.config.bank_name} /><I k="branch" l="Branch" v={s.config.branch} /></>}
              <label className="text-sm sm:col-span-2">Instructions shown to participants<textarea name="instructions" rows={3} defaultValue={s.config.instructions ?? ""} className={`${field} mt-1`} /></label>
              <fieldset className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:col-span-2 sm:grid-cols-4"><legend className="px-1 text-sm">Discount (optional)</legend>
                <I k="discount_label" l="Label" v={d?.label} />
                <label className="text-sm">Type<select name="discount_type" defaultValue={d?.type ?? "percent"} className={`${field} mt-1`}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></label>
                <I k="discount_value" l="Value" v={d?.value} type="number" /><I k="discount_until" l="Valid until (IST)" v={isoToIstInput(d?.valid_until)} type="datetime-local" /></fieldset>
              <div className="sm:col-span-2"><button className={btn}>Save</button></div>
            </form>
          </Card>);
      })}</div>
    </>
  );
}
