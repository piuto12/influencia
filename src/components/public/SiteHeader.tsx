import { nav as defaultNav } from "@/modules/events/site-content";
import { getNav } from "@/modules/content/queries";
import { SiteHeaderClient } from "./SiteHeaderClient";

/** Navigation comes from the admin-editable `nav` setting, falling back to the built-in list. */
export async function SiteHeader() {
  const custom = await getNav();
  const items = custom ? custom.filter((n) => n.visible) : [...defaultNav];
  return <SiteHeaderClient nav={items.map((n) => ({ href: n.href, label: n.label }))} />;
}
