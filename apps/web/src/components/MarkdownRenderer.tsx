'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Terminal } from 'lucide-react';
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
    <div className="relative group my-4 rounded-2xl border border-white/[8%] overflow-hidden bg-[#0c0c0c] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#141414] border-b border-white/[6%]">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[5%] border border-white/[6%]">
            <Terminal className="h-3 w-3 text-white/30" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{language}</span>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200',
            copied
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              : 'text-white/30 hover:text-white/60 hover:bg-white/[5%] border border-transparent'
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copie' : 'Copier'}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        PreTag="div"
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          backgroundColor: 'transparent',
          padding: '16px 20px',
          fontSize: '13px',
          lineHeight: '1.7',
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
