# Security Policy

## Reporting a Vulnerability

Please do **not** open a public issue for security vulnerabilities.

Report privately via GitHub's private vulnerability reporting
(Security tab → Report a vulnerability), or contact the maintainer directly.

Include:

- A description of the vulnerability and its impact
- Steps to reproduce
- Affected version/commit if known

You will receive an acknowledgement as soon as possible. Please allow
reasonable time for a fix before any public disclosure.

## Scope

Containr is a self-hosted platform that runs Docker containers, stores
credentials, and terminates user traffic. In scope:

- Authentication and session handling (Better Auth sidecar, JWT, agent tokens)
- Secrets storage (Git provider tokens, environment variables)
- API authorization and per-user resource scoping
- Webhook signature validation
- CORS and trusted-origin configuration
- Deployment engine command/path handling

## Secrets

- Never commit `.env`, `.env.prod`, or any file containing credentials.
- Git provider access tokens are stored server-side only and are never
  returned by the API.
- Rotate any secret that has ever been committed to git history.

## Self-Hosting Notes

- Set strong `JWT_SECRET`, `BETTER_AUTH_SECRET`, and
  `BETTER_AUTH_INTERNAL_TOKEN` values in production.
- Set `COOKIE_SECURE=true` when serving over HTTPS.
- Restrict `CORS_ALLOWED_ORIGINS` to your actual frontend origin.
- Keep Traefik's dashboard disabled or behind auth in production
  (`TRAEFIK_API_INSECURE=false`).
