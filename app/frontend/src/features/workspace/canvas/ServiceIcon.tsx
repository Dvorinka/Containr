import { useState } from 'react';
import { serviceIcon, serviceIconUrl, serviceTypeIcon, type ServiceIconInput } from './service-visuals';

export function ServiceIcon({
  service,
  size = 16,
}: {
  service: ServiceIconInput;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const brand = serviceIcon(service);
  if (brand && !failed) {
    return (
      <img
        src={serviceIconUrl(brand)}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return serviceTypeIcon(service.type ?? 'service', size);
}
