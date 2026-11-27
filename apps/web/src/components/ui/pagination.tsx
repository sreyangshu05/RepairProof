import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="Pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}
function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />;
}
function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li {...props} />;
}

interface PaginationLinkProps extends React.ComponentProps<typeof Button> {
  isActive?: boolean;
  'aria-label': string;
}
const PaginationLink = ({ className, isActive, ...props }: PaginationLinkProps) => (
  <Button
    aria-current={isActive ? 'page' : undefined}
    variant={isActive ? 'outline' : 'ghost'}
    size="sm"
    className={cn('h-10 min-w-10 px-2', className)}
    {...props}
  />
);
function PaginationPrevious(props: Omit<PaginationLinkProps, 'children'>) {
  return (
    <PaginationLink {...props}>
      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">Previous page</span>
    </PaginationLink>
  );
}
function PaginationNext(props: Omit<PaginationLinkProps, 'children'>) {
  return (
    <PaginationLink {...props}>
      <span className="sr-only">Next page</span>
      <ChevronRight aria-hidden="true" className="h-4 w-4" />
    </PaginationLink>
  );
}
function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex h-10 w-10 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
