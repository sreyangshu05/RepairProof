import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';
import { CaseStatus, RepairCase } from '@repairproof/shared';

export const CasesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery<{
    items: RepairCase[];
    nextCursor: string | null;
  }>({
    queryKey: ['cases', 'pages', search, statusFilter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.get('/cases', { params: {
      limit: 50, cursor: pageParam, search: search.trim() || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    } }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const cases = data?.pages.flatMap((page) => page.items) ?? [];

  const filtered = cases;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_REPAIR':
      case 'AWAITING_VERIFICATION':
        return 'info';
      case 'AWAITING_CUSTOMER_APPROVAL':
        return 'warning';
      case 'REJECTED':
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repair Cases</h1>
          <p className="text-sm text-muted-foreground">
            Complete lifecycle tracking from intake diagnostics to quality certification.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/cases/new">
            <Plus className="h-4 w-4 mr-1.5" /> New Repair Case
          </Link>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by case #, customer, phone, or device..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          {Object.values(CaseStatus).map((st) => (
            <option key={st} value={st}>
              {st.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Cases Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading cases...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <ClipboardList className="h-10 w-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium">No repair cases match your filters.</p>
              {search || statusFilter !== 'ALL' ? (
                <Button type="button" variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('ALL'); }}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm"><Link to="/cases/new">Create a Case</Link></Button>
              )}
            </div>
          ) : (
            <div
              role="region"
              aria-label="Repair cases"
              tabIndex={0}
              className="overflow-x-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Case ID
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Device
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Problem Summary
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                        {c.caseNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {c.device ? `${c.device.make} ${c.device.model}` : 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.device?.category}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.customerName}</div>
                        <div className="text-xs text-muted-foreground">{c.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-muted-foreground text-xs">
                        {c.problemDescription}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusBadgeVariant(c.status)}>
                          {c.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm">
                          <Link to={`/cases/${c.id}`}>Workbench</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasNextPage && (
            <div className="border-t p-4 text-center">
              <Button type="button" variant="outline" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                {isFetchingNextPage ? 'Loading more cases…' : 'Load more cases'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
