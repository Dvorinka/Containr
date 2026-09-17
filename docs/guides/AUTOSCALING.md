# Autoscaling

Containr has a built-in autoscaler that adjusts service replica counts against
CPU/memory targets. Policies and scale events are held in backend memory —
they do not survive a backend restart (tracked on the roadmap).

## Per-service policy

Open a service → **Scaling** section. Set:

| Field | Meaning |
|-------|---------|
| Min replicas | Lower bound, ≥1 |
| Max replicas | Upper bound |
| Target CPU % | Scale up when average CPU exceeds this |
| Target memory % | Scale up when average memory exceeds this |
| Enabled | Whether the autoscaler evaluates this service |

Creating a policy registers the service with the autoscaler and initializes
its scaling state at `min_replicas`.

## Manual scale

The Scaling section also has a replica input + **Scale** button for an
immediate change, clamped to the policy bounds when a policy exists
(1–20 otherwise). Scaling dispatches to the node scheduler — without
registered node agents it fails with `no ready nodes available`.

## API

```
GET    /api/v1/scaling/policies/:serviceId
POST   /api/v1/scaling/policies          {service_id, min_replicas, max_replicas,
                                          target_cpu, target_memory, enabled}
PUT    /api/v1/scaling/policies/:serviceId
DELETE /api/v1/scaling/policies/:serviceId   (disables, does not remove)
GET    /api/v1/scaling/services/:serviceId   (current/desired replicas)
POST   /api/v1/scaling/services/:serviceId/scale  {replicas, reason}
GET    /api/v1/scaling/services/:serviceId/history
GET    /api/v1/scaling/status | /metrics | /events
```

## Traffic distribution

Replicas are scheduled across registered node agents. In front of them you
still want a load balancer — Traefik (bundled) discovers containers via
labels, or Cloudflare Tunnel can front the platform for external traffic.
Neither provides autoscaling itself; they distribute traffic to whatever
replicas the autoscaler has placed.
