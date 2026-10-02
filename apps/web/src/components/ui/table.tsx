import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tableau de donnees. Sur petit ecran, il defile horizontalement dans son
 * conteneur (jamais la page).
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-body-sm', className)} {...props} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border-subtle', className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors duration-fast hover:bg-hover', className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('h-10 whitespace-nowrap border-b border-border-subtle px-4 text-left text-caption font-medium text-foreground-muted', className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('whitespace-nowrap px-4 py-3 text-foreground-secondary', className)} {...props} />;
}
