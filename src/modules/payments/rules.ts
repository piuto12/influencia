/** Methods paid offline (cash/card at the desk): there is nothing for the participant to upload; the team records the payment. */
export const OFFLINE_METHODS = ["venue"] as const;
export const isOfflineMethod = (method: string) => (OFFLINE_METHODS as readonly string[]).includes(method);

/** Statuses from which an authorised admin may verify a payment (the DB function enforces the same rule). */
export function adminCanVerify(status: string, method: string): boolean {
  return status === "proof_submitted" || status === "under_verification" || (status === "pending" && isOfflineMethod(method));
}
/** Rejection only makes sense once something was submitted for review. */
export const adminCanReject = (status: string) => status === "proof_submitted" || status === "under_verification";
