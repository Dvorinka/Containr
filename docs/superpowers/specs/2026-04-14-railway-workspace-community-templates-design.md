# Railway Workspace And Community Templates Design

## Goal
Containr should feel simple after self-hosting: start the app, create an account, land in a Railway-style workspace, create projects, add services, connect GitHub, deploy templates, and manage running services from one canvas.

## Scope
This slice replaces the broad dashboard-first experience with a project-first workspace:

- Left navigation: Projects, Templates, Usage, People, Settings, Docs.
- Projects page: grid/list management inspired by the Railway dashboard reference.
- Project page: canvas-first service management inspired by the Railway project reference.
- Templates page: official and community templates with deployment into a selected project.
- GitHub wiring: provider token validation, repository listing, branch listing, repository connection, and webhook creation through GitHub REST APIs.
- Usage page: self-hosted monitoring and resource usage only. Billing is out of scope.

## User Flow
After registration or login, the user lands on Projects. They create a project, open it, and see a canvas. The Add action lets them create a GitHub service, Docker image service, database/worker/cron service, or deploy from a template. Services appear as nodes on the canvas, can be selected, managed, and connected, and expose quick actions through a context menu.

## Frontend Design
The UI uses a dark, restrained Railway-like shell, not the current broad admin dashboard structure. Project cards show service previews, status, environment, and recent activity. The project detail route becomes the main operational screen with a dotted canvas, grouped service cards, dashed dependency connections, zoom controls, add controls, and a service management panel for deployments, variables, logs, activity, and settings.

Templates get a gallery with search, category filters, official/community badges, GitHub source metadata, and deployment actions. Community templates can be imported from a connected GitHub repository when it contains a supported manifest.

## Backend Design
The existing Go/Gin API remains the base. GitHub handlers move from mock data to real GitHub REST calls using the saved personal access token provider model already in the schema. The implementation should validate GitHub tokens against `/user`, list repositories from `/user/repos`, fetch repository metadata from `/repos/{owner}/{repo}`, fetch branches from `/repos/{owner}/{repo}/branches`, and create webhooks on `/repos/{owner}/{repo}/hooks`.

Templates continue to use `service_templates`, extended with community/source metadata where needed. Deployment from template should keep using `POST /api/v1/templates/:id/deploy`, creating a service in the target project.

## Error Handling
GitHub failures should return clear API errors without exposing tokens. Template imports should validate project access, repo access, manifest shape, and required variables. Frontend forms should show inline loading, empty, and error states.

## Testing
Run TypeScript build checks, relevant frontend tests if build passes, Go tests for touched backend packages, and a browser smoke check for login/register, projects, templates, and project canvas.
