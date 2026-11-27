import { ClipboardList } from 'lucide-react';
import { EmptyState, type EmptyStateProps } from './empty-state';

type PageEmptyStateProps = Omit<EmptyStateProps, 'icon'> & { icon?: EmptyStateProps['icon'] };

export function PageEmptyState({
  icon = <ClipboardList className="h-8 w-8" />,
  ...props
}: PageEmptyStateProps) {
  return <EmptyState icon={icon} {...props} />;
}
