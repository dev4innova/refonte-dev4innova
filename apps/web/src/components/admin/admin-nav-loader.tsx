import { AdminNav } from "@/components/admin/admin-nav";
import { adminApi, getStaffRole, staffAccess } from "@/lib/admin";
import { getSession } from "@/lib/auth/session";

/** Reads the staff role (and, for sales, what is waiting in the CRM), then renders the
 * tabs. Render inside <Suspense>: it reads the session cookie. */
export async function AdminNavLoader() {
  const session = await getSession();
  if (!session) return <AdminNav />;
  const access = staffAccess(await getStaffRole(session.accessToken));
  if (!access.crm) return <AdminNav ai={access.ai} portal={access.portal} academy={access.academy} billing={access.billing} accounts={access.accounts} />;
  const inbox = await adminApi(session)
    .GET("/api/v1/admin/crm/inbox")
    .then((r) => r.data)
    .catch(() => undefined);
  return (
    <AdminNav crm ai={access.ai} portal={access.portal} academy={access.academy} billing={access.billing} accounts={access.accounts} crmBadge={inbox ? inbox.new_leads + inbox.new_quote_requests : 0} />
  );
}
