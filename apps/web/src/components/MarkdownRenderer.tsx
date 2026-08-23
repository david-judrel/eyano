'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border">
        <span className="text-[11px] font-medium text-muted">{language}</span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150',
            copied
              ? 'bg-brand/10 text-brand'
              : 'text-muted hover:text-foreground hover:bg-surface-2',
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copie' : 'Copier'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          backgroundColor: '#0a0a0a',
          padding: '16px',
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#e8eaed',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (match) {
              return <CodeBlock language={match[1]} code={codeString} />;
            }

            return (
              <code
                className="px-1.5 py-0.5 rounded-lg bg-brand/10 text-[0.875em] text-brand border border-brand/20 font-medium"
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-3 last:mb-0 leading-[1.75] text-foreground/80">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-3 space-y-1.5 text-foreground/80">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-foreground/80">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-[1.75]">{children}</li>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-foreground">{children}</strong>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-3 mt-5 text-brand">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mb-2 mt-4 text-brand">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-[15px] font-semibold mb-2 mt-3 text-foreground">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="pl-4 my-3 text-muted border-l-2 border-brand/30 bg-brand/[3%] rounded-r-xl py-2 pr-3">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-5 border-border" />;
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3 rounded-xl border border-border">
                <table className="w-full text-[13px]">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="px-3 py-2.5 text-left font-semibold bg-surface text-muted text-[11px] uppercase tracking-wider">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-2.5 border-t border-border text-foreground/60">{children}</td>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand underline underline-offset-4 decoration-brand/30 hover:decoration-brand transition-colors"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
