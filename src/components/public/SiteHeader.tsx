import { nav as defaultNav } from "@/modules/events/site-content";
import { getBranding, getNav } from "@/modules/content/queries";
import { mediaUrl } from "@/modules/content/media";
import { SiteHeaderClient } from "./SiteHeaderClient";

/** Navigation comes from the admin-editable `nav` setting, falling back to the built-in list. */
export async function SiteHeader() {
  const [custom, branding] = await Promise.all([getNav(), getBranding()]);
  const items = custom ? custom.filter((n) => n.visible) : [...defaultNav];
  return <SiteHeaderClient nav={items.map((n) => ({ href: n.href, label: n.label }))} logo={mediaUrl(branding.logo_path)} logoAlt={branding.logo_alt || "Influencia"} />;
}
