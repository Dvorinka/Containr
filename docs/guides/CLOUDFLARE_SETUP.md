# Cloudflare Tunnel Setup

This guide explains how to set up Cloudflare tunnel for Containr, allowing you to expose your services without configuring a domain.

## Prerequisites

1. A Cloudflare account
2. A domain (any domain, even a free one)

## Setup Steps

### 1. Create a Cloudflare Tunnel

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Zero Trust** → **Networks** → **Tunnels**
3. Click **Create tunnel**
4. Choose **Cloudflared** and click **Next**
5. Give your tunnel a name (e.g., "containr-tunnel")
6. Click **Save tunnel**

### 2. Get Your Tunnel Token

After creating the tunnel, Cloudflare will show you a command like:
```bash
cloudflared tunnel run <tunnel-id>
```

Copy the token from the `.cloudflared/config.yml` file or use the token provided by Cloudflare.

### 3. Configure Containr

1. Copy `.env.example` to `.env` if you haven't already:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Cloudflare tunnel token:
   ```env
   CLOUDFLARED_TOKEN=your_copied_tunnel_token_here
   ```

### 4. Start Services with Cloudflare Tunnel

```bash
# Start all services including cloudflared
make cloudflared-up

# Or start manually
docker-compose --profile cloudflared up -d
```

### 5. Configure Tunnel Routes

In your Cloudflare dashboard:

1. Go to your tunnel settings
2. Add the following public hostnames:
   - `your-domain.com` → `http://traefik:80` (for frontend)
   - `api.your-domain.com` → `http://traefik:80` (for backend)
   - `traefik.your-domain.com` → `http://traefik:80` (for dashboard)

### 6. Access Your Services

Once configured, you can access:
- Frontend: `https://your-domain.com`
- API: `https://api.your-domain.com`
- Traefik Dashboard: `https://traefik.your-domain.com`

## Management Commands

```bash
# Start with Cloudflare tunnel
make cloudflared-up

# Stop Cloudflare tunnel
make cloudflared-down

# View logs
docker-compose logs -f cloudflared

# Check status
docker-compose ps
```

## Benefits

- **No domain configuration required** in `.env`
- **Automatic SSL** through Cloudflare
- **DDoS protection** and security features
- **Easy setup** - just need a tunnel token
- **Works anywhere** - no port forwarding needed

## Troubleshooting

### Tunnel Not Connecting
- Verify your `CLOUDFLARED_TOKEN` is correct
- Check cloudflared logs: `docker-compose logs cloudflared`
- Ensure your tunnel is active in Cloudflare dashboard

### Services Not Accessible
- Verify you've configured the public hostnames in Cloudflare
- Check that all services are running: `docker-compose ps`
- Ensure the tunnel routes point to `http://traefik:80`

### Token Issues
- Regenerate your tunnel token in Cloudflare dashboard
- Make sure there are no extra spaces or newlines in the token

## Alternative: Domain Mode

If you prefer traditional domain setup instead of Cloudflare tunnel:

1. Configure your domain in `.env`:
   ```env
   DOMAIN=yourdomain.com
   ACME_EMAIL=admin@yourdomain.com
   ```

2. Use regular commands:
   ```bash
   make prod
   ```

This will use Let's Encrypt certificates instead of Cloudflare tunnel.
