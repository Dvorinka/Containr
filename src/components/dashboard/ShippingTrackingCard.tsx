import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Package, Truck } from 'lucide-react';

export function ShippingTrackingCard() {
  const trackingSteps = [
    { icon: Package, label: 'Order Placed', time: 'Dec 10, 2:30 PM', completed: true },
    { icon: CheckCircle, label: 'Processing', time: 'Dec 10, 4:15 PM', completed: true },
    { icon: Truck, label: 'Shipped', time: 'Dec 11, 10:00 AM', completed: true },
    { icon: Clock, label: 'Out for Delivery', time: 'Dec 12, 8:00 AM', completed: false },
    { icon: CheckCircle, label: 'Delivered', time: 'Expected by 6:00 PM', completed: false }
  ];

  return (
    <Card className="w-full">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <div className="text-sm text-muted-foreground">Shipping Tracking</div>
              </div>
              <div className="mt-1 text-lg font-semibold">Order #12345</div>
            </div>
            <Badge variant="secondary">In Transit</Badge>
          </div>

          {/* Tracking Steps */}
          <div className="space-y-4">
            {trackingSteps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <step.icon 
                    className={`w-5 h-5 ${
                      step.completed ? 'text-green-600' : 'text-muted-foreground'
                    }`} 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${
                    step.completed ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{step.time}</div>
                </div>
                {index < trackingSteps.length - 1 && (
                  <div className={`w-px h-8 ${
                    index < 2 ? 'bg-green-600' : 'bg-border'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
