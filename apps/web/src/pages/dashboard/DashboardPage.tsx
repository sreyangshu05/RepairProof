import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Smartphone,
  ShieldCheck,
  Clock,
  ArrowRight,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';
import { RepairCase, Device } from '@repairproof/shared';

export const DashboardPage: React.FC = () => {
  const { data: caseSummary, isLoading: isLoadingCases } = useQuery<{
    countsByStatus: Record<string, number>;
    recentCases: RepairCase[];
  }>({
    queryKey: ['cases', 'summary'],
    queryFn: () => api.get('/cases/summary'),
  });
  const cases = caseSummary?.recentCases ?? [];

  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: () => api.get('/devices'),
  });

  const counts = caseSummary?.countsByStatus ?? {};
  const activeCases = Object.entries(counts).reduce((sum, [status, count]) => sum + (status !== 'COMPLETED' && status !== 'CANCELLED' ? count : 0), 0);
  const certifiedCases = counts.COMPLETED ?? 0;
  const awaitingApproval = counts.AWAITING_CUSTOMER_APPROVAL ?? 0;

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
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Workshop Operations</h1>
          <p className="text-sm text-muted-foreground">
            Overview of active repair orders, evidence capture, and verification workflows.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/devices/register">
              <Plus className="h-4 w-4 mr-1.5" /> Register Device
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/cases/new">
              <Plus className="h-4 w-4 mr-1.5" /> New Repair Case
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active Cases
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCases}</div>
            <p className="text-xs text-muted-foreground mt-1">In diagnostic or repair pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Awaiting Approval
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{awaitingApproval}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending customer quotation sign-off
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Verified & Certified
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certifiedCases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tamper-proof digital certificates issued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Registered Devices
            </CardTitle>
            <Smartphone className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Intake catalog with condition logs</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Cases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Recent Repair Cases</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live status and proof chain progress
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/cases" className="flex items-center text-xs">
              View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingCases ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading repair cases...
            </div>
          ) : cases.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <ClipboardList className="h-10 w-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium">No repair cases created yet.</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Start by registering a customer device, documenting intake condition photos, and
                creating a case.
              </p>
              <Button asChild size="sm">
                <Link to="/devices/register">Register First Device</Link>
              </Button>
            </div>
          ) : (
            <div
              role="region"
              aria-label="Recent repair cases"
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
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cases.slice(0, 6).map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                        {c.caseNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {c.device ? `${c.device.make} ${c.device.model}` : 'Unknown Device'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.device?.serialNumber || c.device?.imei || 'No serial/IMEI'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.customerName}</div>
                        <div className="text-xs text-muted-foreground">{c.customerPhone}</div>
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
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/cases/${c.id}`}>Open Workbench</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
