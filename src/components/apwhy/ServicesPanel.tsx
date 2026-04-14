import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

// Types for better TypeScript support
interface Service {
  id: string;
  name: string;
  slug: string;
  upstreamUrl: string;
  routePrefix: string;
  enabled: boolean;
  rpmLimit?: number;
  monthlyQuota?: number;
  lastValidationStatus?: string;
  lastValidationMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface ServiceFormData {
  name: string;
  upstreamUrl: string;
  routePrefix: string;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

interface ServicesResponse {
  services: Service[];
  count: number;
}

// Validation rules
const VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_]+$/,
  },
  upstreamUrl: {
    required: true,
    maxLength: 500,
    pattern: /^https?:\/\/.+/,
  },
  routePrefix: {
    required: true,
    minLength: 1,
    maxLength: 200,
    pattern: /^\/.*/,
  },
} as const;

// Validation errors
interface ValidationErrors {
  name?: string;
  upstreamUrl?: string;
  routePrefix?: string;
}

// Custom hook for API calls with error handling
const useAPICall = <T,>() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (
    url: string,
    options?: RequestInit
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      const result: APIResponse<T> = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'API request failed');
      }

      return result.data || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error };
};

// Form validation helper
const validateServiceForm = (data: ServiceFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.name.trim()) {
    errors.name = 'Service name is required';
  } else if (data.name.length > VALIDATION_RULES.name.maxLength) {
    errors.name = `Service name must be less than ${VALIDATION_RULES.name.maxLength} characters`;
  } else if (!VALIDATION_RULES.name.pattern.test(data.name)) {
    errors.name = 'Service name can only contain letters, numbers, spaces, hyphens, and underscores';
  }

  if (!data.upstreamUrl.trim()) {
    errors.upstreamUrl = 'Upstream URL is required';
  } else if (data.upstreamUrl.length > VALIDATION_RULES.upstreamUrl.maxLength) {
    errors.upstreamUrl = `Upstream URL must be less than ${VALIDATION_RULES.upstreamUrl.maxLength} characters`;
  } else if (!VALIDATION_RULES.upstreamUrl.pattern.test(data.upstreamUrl)) {
    errors.upstreamUrl = 'Upstream URL must be a valid HTTP or HTTPS URL';
  }

  if (!data.routePrefix.trim()) {
    errors.routePrefix = 'Route prefix is required';
  } else if (data.routePrefix.length > VALIDATION_RULES.routePrefix.maxLength) {
    errors.routePrefix = `Route prefix must be less than ${VALIDATION_RULES.routePrefix.maxLength} characters`;
  } else if (!VALIDATION_RULES.routePrefix.pattern.test(data.routePrefix)) {
    errors.routePrefix = 'Route prefix must start with /';
  }

  return errors;
};

export default function ServicesPanel() {
  const [services, setServices] = useState<Service[]>([]);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    upstreamUrl: '',
    routePrefix: '',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Custom hooks for API calls
  const { execute: fetchServices, loading: loadingServices, error: servicesError } = useAPICall<ServicesResponse>();
  const { execute: createService, loading: creatingService } = useAPICall<{ service: Service; message: string }>();

  // Fetch services on component mount
  useEffect(() => {
    const loadServices = async () => {
      const result = await fetchServices('/api/v1/services');
      if (result) {
        setServices(result.services);
      }
    };

    loadServices();
  }, [fetchServices]);

  // Handle form input changes
  const handleInputChange = (field: keyof ServiceFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const errors = validateServiceForm(formData);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);

    const result = await createService('/api/v1/services', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    if (result) {
      // Reset form
      setFormData({ name: '', upstreamUrl: '', routePrefix: '' });
      setSuccessMessage(result.message);
      
      // Refresh services list
      const servicesResult = await fetchServices('/api/v1/services');
      if (servicesResult) {
        setServices(servicesResult.services);
      }
    }

    setIsSubmitting(false);
  };

  // Handle service toggle
  const toggleService = async (id: string, enabled: boolean) => {
    const result = await fetchServices(`/api/v1/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });

    if (result) {
      // Refresh services list
      const servicesResult = await fetchServices('/api/v1/services');
      if (servicesResult) {
        setServices(servicesResult.services);
      }
    }
  };

  // Get status badge variant
  const getStatusBadge = (service: Service) => {
    if (service.enabled) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
    }
    return <Badge variant="secondary">Inactive</Badge>;
  };

  // Get validation status icon
  const getValidationIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {servicesError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{servicesError}</AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Service Creation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add API Service</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Service Name</label>
              <Input
                id="name"
                placeholder="e.g., Billing API"
                value={formData.name}
                onChange={handleInputChange('name')}
                className={validationErrors.name ? 'border-red-500' : ''}
              />
              {validationErrors.name && (
                <p className="text-sm text-red-500">{validationErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="upstreamUrl" className="text-sm font-medium">Upstream URL</label>
              <Input
                id="upstreamUrl"
                placeholder="https://api.example.com"
                value={formData.upstreamUrl}
                onChange={handleInputChange('upstreamUrl')}
                className={validationErrors.upstreamUrl ? 'border-red-500' : ''}
              />
              {validationErrors.upstreamUrl && (
                <p className="text-sm text-red-500">{validationErrors.upstreamUrl}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="routePrefix" className="text-sm font-medium">Route Prefix</label>
              <Input
                id="routePrefix"
                placeholder="/v1/billing"
                value={formData.routePrefix}
                onChange={handleInputChange('routePrefix')}
                className={validationErrors.routePrefix ? 'border-red-500' : ''}
              />
              {validationErrors.routePrefix && (
                <p className="text-sm text-red-500">{validationErrors.routePrefix}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || creatingService}
              className="w-full"
            >
              {isSubmitting || creatingService ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Service...
                </>
              ) : (
                'Create Service'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Services List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Services</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingServices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading services...</span>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No API services configured yet. Create your first service above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Upstream</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validation</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{service.routePrefix}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {new URL(service.upstreamUrl).hostname}
                      </code>
                    </TableCell>
                    <TableCell>{getStatusBadge(service)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getValidationIcon(service.lastValidationStatus)}
                        {service.lastValidationStatus && (
                          <span className="text-sm text-muted-foreground">
                            {service.lastValidationStatus}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleService(service.id, !service.enabled)}
                      >
                        {service.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
