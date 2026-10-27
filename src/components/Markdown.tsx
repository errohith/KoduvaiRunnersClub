import ReactMarkdown from "react-markdown";

/** Renders admin-authored Markdown. Raw HTML is NOT rendered (react-markdown default), preventing XSS. */
export function Markdown({ children, className = "" }: { children: string | null | undefined; className?: string }) {
  if (!children) return null;
  return (
    <div className={`prose prose-slate max-w-none prose-headings:font-display prose-headings:uppercase prose-a:text-brand ${className}`}>
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
