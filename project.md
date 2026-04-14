# Self-Hosted PaaS on Proxmox (Railway-like Platform)

A fully self-hosted, open-source Platform-as-a-Service designed to run on top of **Proxmox infrastructure**, providing a Railway-like developer experience: Git-based deployments, container orchestration, automatic scaling, load balancing, and observability — all under your control.

---

## 🎯 Goals

- Railway-like UX, fully self-hosted
- Built primarily on **Proxmox + Docker**
- Horizontal scaling across multiple VMs/LXCs
- Agent-based orchestration (no Kubernetes required)
- Git-driven deploys
- Production-grade networking, metrics, and reliability

---

## 🧱 Core Architecture

- **Control Plane**: Central API + scheduler
- **Node Agents**: Lightweight daemons running on each VM/LXC
- **Execution Layer**: Docker containers
- **Networking**: Traefik reverse proxy & load balancer
- **State Layer**: Externalized databases and caches

---

## 🧠 Technology Stack

### Backend / Control Plane
- **Go (primary language)**
  - Scheduler
  - Orchestration logic
  - API server
  - Scaling engine
- **Python (auxiliary tooling)**
  - Metrics processing
  - Background jobs
  - Scripts where Go is impractical
- **Rust (performance-critical components)**
  - Node agent (optional)
  - Low-level system monitoring
  - High-throughput data collectors

---

### Frontend / Dashboard
- **Bun**
  - Package manager
  - Runtime for tooling & scripts
  - [Documentation](https://bun.sh/)
- **Vite**
  - Fast frontend build system
  - [Documentation](https://vitejs.dev/)
- **React 18**
  - Modern UI framework with hooks and concurrent features
  - [React Documentation](https://react.dev/)
- **TypeScript (TS / TSX)**
  - Strict typing
  - Shared contracts with backend
  - [Documentation](https://www.typescriptlang.org/)
- **Tailwind CSS**
  - Utility-first CSS framework
  - Rapid UI development with design tokens
  - [Documentation](https://tailwindcss.com/)
- **shadcn/ui**
  - Beautiful, accessible component library built on Radix UI
  - [Documentation](https://ui.shadcn.com/)
- **Lucide React**
  - Beautiful icon library for React
  - [Documentation](https://lucide.dev/)

**Documentation:**
- [React 18](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Lucide React](https://lucide.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [TanStack Query](https://tanstack.com/query/latest)

---

### Infrastructure & Runtime
- **Docker**
  - Container runtime
  - Image builds & execution
- **Docker Compose / Custom Orchestrator**
  - Service definitions
  - Replica management
- **Traefik**
  - Reverse proxy
  - Automatic service discovery
  - TLS & routing
- **Proxmox**
  - VM & LXC orchestration
  - Compute isolation
  - Infrastructure backbone

---

### Data & State
- **PostgreSQL**
  - Persistent platform state
  - Users, apps, deployments, scaling rules
- **Redis**
  - Caching
  - Session storage
  - Queues & pub/sub

---

## 🏗️ Build System & Deployment

### Builder Types (Railway-inspired)

**1️⃣ Nixpacks (Primary, Default Builder) ⭐**

Auto-detection build system based on Nix for reproducible builds.

- **How it works**: Scans repo for `go.mod`, `package.json`, `requirements.txt`, etc.
- **Supports**: Go, Node.js, Bun, Python, Ruby, PHP, Rust, Deno, Static sites
- **Advantages**: No Dockerfile needed, fast builds, reproducible, easy overrides
- **Default choice**: Used when no other builder is specified

**2️⃣ Dockerfile Builder**

Standard Docker build using your existing Dockerfile.

- **When to use**: Complex builds, custom system dependencies, non-standard runtimes
- **Control**: Full control over base image, OS packages, multi-stage builds
- **Tradeoff**: Slower than Nixpacks, more responsibility

**3️⃣ Prebuilt Image Deployment**

Deploy existing container images from Docker Hub, GHCR, or any OCI registry.

- **Use cases**: Workers, infrastructure tools, third-party services, optimized custom images
- **Process**: No build step - Railway pulls and runs the image directly

**4️⃣ Platform Templates**

Predefined service configurations that wrap around the above builders.

- **Function**: Predefine services, choose builder type (usually Nixpacks), preconfigure variables & databases
- **Underlying**: Still uses Nixpacks, Dockerfile, or prebuilt images

### Builder Selection Logic

```
Dockerfile present? → Docker builder
Else if image specified? → Image deploy  
Else → Nixpacks (default)
```

### Build Output

Regardless of builder type, the result is always:
- Container image
- Versioned per deployment
- Immutable
- Rollback-able

### Stack Mapping

- **Go backend** → Nixpacks (perfect fit)
- **Vite/React/Bun** → Nixpacks
- **Rust helpers** → Nixpacks or Dockerfile
- **Custom system deps** → Dockerfile
- **Workers/cron** → Prebuilt image or Nixpacks

---

## 🔁 Scaling Model

- Horizontal scaling via container replicas
- Node-aware scheduling across Proxmox VMs/LXCs
- Metrics-based auto-scaling:
  - CPU
  - Memory
  - Request rate
- Stateless application containers
- Externalized state (DB, cache, storage)

---

## 📦 Deployment Flow

1. Git push / webhook trigger
2. Backend schedules build
3. Docker image is built & stored
4. Scheduler selects optimal nodes
5. Node agents start containers
6. Traefik automatically routes traffic
7. Metrics collected → scaling decisions applied

---

## � Analytics & Monitoring

### Umami Integration
- **Privacy-focused web analytics** for user insights
- **Self-hosted analytics dashboard** for application monitoring
- **Real-time visitor tracking** with geographic and device data
- **Performance metrics** including bounce rates and session duration
- **Traffic source analysis** and top page tracking
- **GDPR compliant** with no personal data collection
- **Integration points**:
  - Dashboard analytics overview
  - Project-specific metrics
  - Service performance tracking
  - User behavior analysis

### Built-in Monitoring
- **Real-time metrics** with custom visualizations
- **Service health monitoring** with status indicators
- **Resource usage tracking** (CPU, memory, storage, network)
- **Geographic service distribution** with interactive globe
- **Performance graphs** and data visualizations
- **Build logs integration** with step-by-step progress tracking
- **Deployment history** with rollback capabilities

---

## �🔐 Networking & Security

- TLS termination via Traefik
- Internal service networking
- Agent authentication via tokens / mTLS
- No direct Docker socket exposure to UI

---

## 🧩 Design Principles

- Infrastructure-first (Proxmox as the cloud)
- Stateless by default
- Explicit over magical
- Horizontal scalability
- Fail-fast & observable
- Open-source friendly

---

## 🚀 Long-Term Vision

- Multi-cluster support
- Cloud bursting (home → cloud nodes)
- Preview environments per Git branch
- Resource-based billing (optional)
- Plugin system for runtimes & buildpacks

---

## 📄 License

MIT / Apache-2.0 (TBD)

---

## 🛠️ Status

Early architecture & design phase.
