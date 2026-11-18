import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Smartphone, Laptop, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Device, CasePriority } from '@repairproof/shared';

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDeviceId = searchParams.get('deviceId');

  const [deviceId, setDeviceId] = useState(preselectedDeviceId || '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [priority, setPriority] = useState<CasePriority>(CasePriority.NORMAL);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: devices = [], isLoading: isLoadingDevices } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: () => api.get('/devices'),
  });

  const selectedDevice = devices.find((d) => d.id === deviceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId) {
      setError('Please select a registered device.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !problemDescription.trim()) {
      setError('Please fill in Customer Name, Phone, and Problem Description.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newCase: any = await api.post('/cases', {
        deviceId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        problemDescription: problemDescription.trim(),
        priority,
      });

      navigate(`/cases/${newCase.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create repair case');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Initiate Repair Case</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case Intake & Customer Authorization Setup</CardTitle>
          <CardDescription>
            Attach the registered hardware to a customer repair order and initiate the proof chain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Device Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="device">Select Target Device *</Label>
                <Link to="/devices/register" className="text-xs text-primary hover:underline">
                  + Register New Device
                </Link>
              </div>

              {isLoadingDevices ? (
                <div className="text-sm text-muted-foreground">Loading devices...</div>
              ) : devices.length === 0 ? (
                <div className="p-4 rounded-lg bg-muted text-center space-y-2">
                  <p className="text-sm">No registered devices found.</p>
                  <Button asChild size="sm">
                    <Link to="/devices/register">Register Device First</Link>
                  </Button>
                </div>
              ) : (
                <select
                  id="device"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  required
                >
                  <option value="">-- Choose a registered device --</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.make} {d.model} ({d.category}) — {d.serialNumber || d.imei || 'No S/N'}
                    </option>
                  ))}
                </select>
              )}

              {selectedDevice && (
                <div className="mt-2 p-3 rounded-lg bg-secondary/50 border text-xs space-y-1">
                  <p className="font-semibold text-foreground">
                    Selected: {selectedDevice.make} {selectedDevice.model}
                  </p>
                  <p className="text-muted-foreground">
                    Intake Condition: {selectedDevice.intakeCondition}
                  </p>
                </div>
              )}
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="custName">Customer Full Name *</Label>
                <Input
                  id="custName"
                  placeholder="e.g. Alex Henderson"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custPhone">Customer Phone Number *</Label>
                <Input
                  id="custPhone"
                  placeholder="e.g. +1 (555) 234-5678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="custEmail">Customer Email (For digital quote & certificate link)</Label>
              <Input
                id="custEmail"
                type="email"
                placeholder="e.g. alex@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            {/* Problem Description */}
            <div className="space-y-1.5">
              <Label htmlFor="problem">Customer Reported Symptoms & Faults *</Label>
              <textarea
                id="problem"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe failure symptoms (e.g., phone dropped in pool, no boot, thermal throttling under load, cracked OLED panel, intermittent charging port)..."
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                required
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label>Case Priority</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  CasePriority.LOW,
                  CasePriority.NORMAL,
                  CasePriority.HIGH,
                  CasePriority.URGENT,
                ].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                      priority === p
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !deviceId}>
                {isSubmitting ? 'Creating Case...' : 'Open Workbench & Capture Diagnostics'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
