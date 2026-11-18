import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Laptop, Camera, ArrowLeft, Upload, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { DeviceCategory } from '@repairproof/shared';

export const DeviceRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState<DeviceCategory>(DeviceCategory.SMARTPHONE);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [imei, setImei] = useState('');
  const [color, setColor] = useState('');
  const [storageCapacity, setStorageCapacity] = useState('');
  const [intakeCondition, setIntakeCondition] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle client-side intake image compression
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPhotos((prev) => [...prev, compressedDataUrl]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!make.trim() || !model.trim() || !intakeCondition.trim()) {
      setError('Please fill in required fields: Make, Model, and Intake Condition.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const device: any = await api.post('/devices', {
        category,
        make: make.trim(),
        model: model.trim(),
        serialNumber: serialNumber.trim() || undefined,
        imei: imei.trim() || undefined,
        color: color.trim() || undefined,
        storageCapacity: storageCapacity.trim() || undefined,
        intakeCondition: intakeCondition.trim(),
        intakePhotos: photos,
      });

      // Navigate to create a repair case for this device immediately
      navigate(`/cases/new?deviceId=${device.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to register device');
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
        <h1 className="text-xl font-bold tracking-tight">Intake Device Registration</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Physical Device Baseline</CardTitle>
          <CardDescription>
            Document make, model, identifiers, and physical intake condition before diagnostic disassembly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            {/* Category selection */}
            <div>
              <Label className="mb-2 block">Device Category *</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setCategory(DeviceCategory.SMARTPHONE)}
                  className={`p-4 rounded-xl border flex items-center space-x-3 text-left transition-all ${
                    category === DeviceCategory.SMARTPHONE
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Smartphone</p>
                    <p className="text-xs text-muted-foreground">iOS, Android phones & tablets</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory(DeviceCategory.LAPTOP)}
                  className={`p-4 rounded-xl border flex items-center space-x-3 text-left transition-all ${
                    category === DeviceCategory.LAPTOP
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Laptop className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Laptop / PC</p>
                    <p className="text-xs text-muted-foreground">MacBook, Windows, Linux notebooks</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Make & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="make">Make / Manufacturer *</Label>
                <Input
                  id="make"
                  placeholder="e.g. Apple, Samsung, Dell, Lenovo"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model">Model Name & Number *</Label>
                <Input
                  id="model"
                  placeholder="e.g. iPhone 15 Pro Max (A2849), XPS 15 9530"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Serial & IMEI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="serial">Serial Number</Label>
                <Input
                  id="serial"
                  placeholder="e.g. C02GL3..."
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="imei">IMEI / Service Tag</Label>
                <Input
                  id="imei"
                  placeholder="e.g. 359283..."
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                />
              </div>
            </div>

            {/* Color & Storage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="color">Color / Finish</Label>
                <Input
                  id="color"
                  placeholder="e.g. Space Black, Titanium Gray"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="storage">Storage Capacity</Label>
                <Input
                  id="storage"
                  placeholder="e.g. 256GB, 512GB, 1TB SSD"
                  value={storageCapacity}
                  onChange={(e) => setStorageCapacity(e.target.value)}
                />
              </div>
            </div>

            {/* Physical Intake Condition */}
            <div className="space-y-1.5">
              <Label htmlFor="condition">Physical Intake Condition *</Label>
              <textarea
                id="condition"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe pre-existing cosmetic flaws (e.g., hairline crack bottom-left screen, bent chassis, scuffed corners, liquid indicator pink, missing bottom screws)..."
                value={intakeCondition}
                onChange={(e) => setIntakeCondition(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Documenting pre-existing flaws protects both the repair shop and the customer against liability.
              </p>
            </div>

            {/* Intake Photos */}
            <div className="space-y-2">
              <Label>Intake Condition Photos (Client-side Compressed)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                    <img src={url} alt={`Intake ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/40 cursor-pointer flex flex-col items-center justify-center p-3 text-center transition-colors">
                  <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs font-medium text-foreground">Add Photo</span>
                  <span className="text-[10px] text-muted-foreground">Intake baseline</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registering...' : 'Register & Create Repair Case'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
