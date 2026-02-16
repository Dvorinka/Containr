# 🧩 What the Project Page Is

The Project page represents one isolated application environment on Railway.

Think of a project as:

> A self-contained box that holds all services, databases, configs, deployments, logs, metrics, and environments for one product or system.

### Example Structure

```
One project = spark-screen
├── Go backend
├── Frontend (Vite/Solid)
├── PostgreSQL
├── Redis
├── Worker / cron
└── Preview + Production environments
```

## 🗺️ Main Layout of the Project Page

Visually, the project page is built around a canvas + side panels model.

### 1️⃣ Project Canvas (Center)

This is the graph view you see first.

### What it shows:

- **Each service as a card** (app, db, worker, etc.)
- **Lines showing relationships** (e.g. `backend → database`)
- **Deployment status per service**

### Each card usually displays:

- **Service name**
- **Source** (GitHub repo, Dockerfile, template)
- **Current deployment status** (running, building, failed)
- **Quick access to logs & settings**

> 👉 This canvas is not just visual — it reflects actual runtime dependencies.

### 2️⃣ Services (Core Units)

Each box on the canvas is a Service.

A service can be:

- **Web app** (Go, Node, Bun, Python, etc.)
- **Background worker**
- **Cron job**
- **Database** (Postgres, Redis, MySQL)
- **Custom Docker container**

Clicking a service opens its Service Detail Panel.

## 🔍 Inside a Service (Very Important)

When you click a service, you get several tabs:

### ⚙️ Settings

This is the brain of the service.

You configure:

- **Source**
  - GitHub repo (via GitHub App)
  - Branch
  - Root directory
- **Build**
  - Build command
  - Start command
  - Dockerfile (optional)
- **Resources**
  - CPU / RAM limits
- **Networking**
  - Public domain
  - Internal service-to-service URLs

> **How it works:** Any change here triggers a new deployment. Railway stores this config and applies it at runtime.

### 🔐 Variables (Environment Variables)

This is where Railway shines.

Key–value environment variables

Can be:

- **Service-specific**
- **Shared across the project**
- **Environment-scoped** (prod / preview)

### Examples:

```
DATABASE_URL
REDIS_URL
JWT_SECRET
PORT
```


> **Behind the scenes:**
>
> - Injected into the container at runtime
> - Never hardcoded into images
> - Securely stored and masked in UI

### 📦 Deployments

This tab shows:

- **Full deployment history**
- **Commit hash** (if GitHub)
- **Build logs**
- **Runtime logs**
- **Rollback button**

> **How it works:**
>
> 1. Git push (or manual deploy)
> 2. Railway pulls code
> 3. Builds container (Railpack or Docker)
> 4. Starts new instance
> 5. Old one is replaced (zero-downtime when possible)

### 📜 Logs

### Real-time logs:

- **stdout / stderr**
- **Build logs**
- **Runtime errors**

Logs are:

- **Per-service**
- **Per-deployment**
- **Streamed live from containers**

> This is basically `docker logs` but cloud-native.

### 📊 Metrics

### Per-service metrics:

- **CPU usage**
- **Memory usage**
- **Network traffic**
- **Disk usage** (for DBs)

This helps you:

- **Detect leaks**
- **Decide when to optimize**
- **Understand cost drivers**

## 🧱 Databases Inside a Project

Databases are first-class services, not addons.

When you add:

- **PostgreSQL**
- **Redis**
- **MySQL**

Railway:

- **Provisions it**
- **Injects connection URLs**
- **Handles backups** (plan-dependent)

Databases:

- **Appear on the same canvas**
- **Can be linked to multiple services**
- **Expose internal connection strings only**

### Database Benefits

- **Easy setup**
- **Managed backups**
- **Internal connection strings**

## 🌍 Environments (Prod, Preview, Dev)

Each project can have multiple environments.

### Common setup:

- **Production** – live app
- **Preview** – per-PR deployments
- **Development** – testing

### What changes per environment:

- **Variables**
- **Domains**
- **Deployments**
- **Scaling**

> This is not separate projects — it's logical isolation inside one project.

## 👥 Project-Level Controls

At the project level (not service-level):

### 👤 Members & Permissions

- **Invite teammates**
- **Control access** (admin / developer)

### 🔔 Notifications

- **Deploy failures**
- **Usage alerts**
- **Service crashes**

### 💳 Usage & Billing

- **CPU hours**
- **RAM hours**
- **Network**
- **Cost per service**

## 🧠 How the Project Page Works Internally

Under the hood:

- **The UI talks to the Railway API**
- **Every service = container + config**
- **Every deploy = immutable container version**
- **Variables = injected at runtime**
- **Services communicate via private internal network**

> So the project page is essentially: a visual orchestrator for containers, deployments, configs, and environments

## 🧠 Mental Model (Best Way to Think About It)

If Docker Compose had:

- **A UI**
- **GitHub auto-deploys**
- **Built-in databases**
- **Metrics**
- **Logs**
- **Secrets**
- **Environments**

> 👉 That's the Railway project page.