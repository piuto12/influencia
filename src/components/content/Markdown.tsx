import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Raw HTML in markdown is never rendered (react-markdown escapes it); only http(s)/mailto/tel/relative links survive. */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`space-y-4 leading-relaxed [&_a]:text-crimson [&_a]:underline [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-xl [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
        urlTransform={(u) => (/^(https?:|mailto:|tel:|\/|#)/i.test(u) ? u : "")}
        components={{ a: ({ href, children: c }) => <a href={href} {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{c}</a> }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
