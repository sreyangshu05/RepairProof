import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Smartphone, Laptop, Search, Plus, Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';
import { Device, DeviceCategory } from '@repairproof/shared';

export const DevicesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const { data: devices = [], isLoading } = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: () => api.get('/devices'),
  });

  const filtered = devices.filter((d) => {
    const matchesSearch =
      d.make.toLowerCase().includes(search.toLowerCase()) ||
      d.model.toLowerCase().includes(search.toLowerCase()) ||
      (d.serialNumber && d.serialNumber.toLowerCase().includes(search.toLowerCase())) ||
      (d.imei && d.imei.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || d.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Intake Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Registered devices, physical condition baselines, and cumulative repair logs.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/devices/register">
            <Plus className="h-4 w-4 mr-1.5" /> Register New Device
          </Link>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by make, model, serial number or IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex space-x-2">
          {['ALL', DeviceCategory.SMARTPHONE, DeviceCategory.LAPTOP].map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'ALL'
                ? 'All'
                : cat === DeviceCategory.SMARTPHONE
                  ? 'Smartphones'
                  : 'Laptops'}
            </Button>
          ))}
        </div>
      </div>

      {/* Devices Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading devices...</div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent className="space-y-3">
            <Smartphone className="h-10 w-10 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium">No matching devices found</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/devices/register">Register a Device</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <Card key={d.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {d.category === DeviceCategory.SMARTPHONE ? (
                        <Smartphone className="h-5 w-5" />
                      ) : (
                        <Laptop className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold leading-tight">
                        {d.make} {d.model}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {d.serialNumber
                          ? `S/N: ${d.serialNumber}`
                          : d.imei
                            ? `IMEI: ${d.imei}`
                            : 'Unindexed'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {d.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/50 border text-muted-foreground">
                  <p className="font-semibold text-foreground mb-0.5">Intake Condition:</p>
                  <p className="line-clamp-2">{d.intakeCondition}</p>
                </div>

                {d.intakePhotos && d.intakePhotos.length > 0 && (
                  <div className="flex items-center space-x-2 overflow-x-auto py-1">
                    {d.intakePhotos.map((photo, i) => (
                      <img
                        key={i}
                        src={photo}
                        alt="Intake"
                        className="h-12 w-12 rounded object-cover border shrink-0"
                      />
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    {formatDate(d.createdAt)}
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/cases/new?deviceId=${d.id}`}>Start Repair</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
