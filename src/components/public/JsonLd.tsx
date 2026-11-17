/**
 * The ONLY place in the codebase allowed to use dangerouslySetInnerHTML (enforced by tests/security.test.ts).
 * Content is JSON built from trusted constants; "<" is escaped so it can never close the script tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
