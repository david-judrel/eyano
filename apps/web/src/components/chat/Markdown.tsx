'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';
import { Button } from '@/components/ui/button';

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border-subtle bg-surface">
      <div className="flex h-9 items-center justify-between border-b border-border-subtle pl-3 pr-1">
        <span className="font-mono text-caption text-foreground-muted">{language}</span>
        <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={handleCopy} aria-label={copied ? 'Code copié' : 'Copier le code'}>
          {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        PreTag="div"
        style={resolvedTheme === 'light' ? oneLight : oneDark}
        customStyle={{ margin: 0, borderRadius: 0, background: 'transparent', padding: '16px', fontSize: '13px', lineHeight: '20px' }}
        codeTagProps={{ style: { fontFamily: 'var(--font-mono), ui-monospace, monospace', background: 'transparent' } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/** Reponse d'EYANO en Markdown : la typographie du systeme, sans couleur decorative. */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="max-w-none text-body-md text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            if (match) return <CodeBlock language={match[1]} code={codeString} />;
            return (
              <code className="rounded-sm border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-code" {...props}>
                {children}
              </code>
            );
          },
          // Le bloc de code porte deja son cadre : pas de <pre> autour.
          pre: ({ children }) => <>{children}</>,
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 flex list-disc flex-col gap-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 flex list-decimal flex-col gap-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          h1: ({ children }) => <h1 className="mb-2 mt-6 text-heading-lg first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-5 text-heading-md first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 text-heading-sm first:mt-0">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-border-strong pl-4 text-foreground-secondary">{children}</blockquote>
          ),
          hr: () => <hr className="my-6 border-border-subtle" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border-subtle">
              <table className="w-full text-body-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="bg-surface px-3 py-2 text-left text-label text-foreground-secondary">{children}</th>,
          td: ({ children }) => <td className="border-t border-border-subtle px-3 py-2 text-foreground-secondary">{children}</td>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline decoration-border-strong underline-offset-4 transition-colors duration-fast hover:decoration-foreground"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
