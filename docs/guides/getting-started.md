# Getting Started with Containr

Welcome to Containr! This guide will walk you through setting up your first project and deploying your first application.

## Prerequisites

Before you begin, make sure you have:

- A Containr instance running (either self-hosted or using our hosted version)
- A Git repository with your application code
- Basic knowledge of Docker and containerization concepts

## Step 1: Create Your Account

1. Navigate to your Containr instance URL
2. Click "Sign Up" in the top-right corner
3. Fill in your email, name, and password
4. Verify your email address (if required)
5. Log in to your new account

## Step 2: Create Your First Project

1. From the dashboard, click "New Project"
2. Enter a project name (e.g., "my-awesome-app")
3. Add an optional description
4. Click "Create Project"

You'll be taken to your project's main canvas view.

## Step 3: Connect Your Git Repository

### Option A: Using GitHub (Recommended)

1. Click "Add Service" → "Connect Git Repository"
2. Select "GitHub" as the provider
3. Click "Connect to GitHub" and authorize Containr
4. Browse your repositories and select the one you want to deploy
5. Choose the branch (usually `main` or `master`)
6. Select the root directory if your app isn't in the root
7. Click "Connect Repository"

### Option B: Using Other Git Providers

Containr also supports GitLab and Bitbucket:

1. Click "Add Service" → "Connect Git Repository"
2. Select your preferred provider
3. Follow the authorization flow
4. Select your repository and branch

## Step 4: Configure Your Service

After connecting your repository, Containr will:

1. **Auto-detect your stack** (Node.js, Python, Go, etc.)
2. **Generate a build plan** using Nixpacks
3. **Show you the configuration**

### Basic Configuration

- **Service Name**: Give your service a descriptive name
- **Build Command**: Auto-detected, but you can customize
- **Start Command**: Auto-detected, but you can customize
- **Environment Variables**: Add any needed variables

### Example: Node.js Application

For a typical Node.js app:

```bash
# Build Command (auto-detected)
npm install && npm run build

# Start Command (auto-detected)
npm start
```

### Example: Go Application

For a Go application:

```bash
# Build Command (auto-detected)
go build -o app .

# Start Command (auto-detected)
./app
```

## Step 5: Add Environment Variables

Most applications need environment variables:

1. Go to the "Variables" tab in your service
2. Add your variables as key-value pairs:
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://...`
   - `API_KEY=your-secret-key`
3. Variables are automatically encrypted and injected at runtime

## Step 6: Deploy Your Application

1. Click "Deploy" in the top-right corner
2. Choose your deployment method:
   - **Deploy Latest Commit**: Deploy the latest commit from your branch
   - **Manual Deploy**: Specify a commit SHA
3. Click "Start Deployment"

Containr will:
1. Pull your code from Git
2. Build a Docker image using Nixpacks
3. Start the container
4. Assign a public URL

## Step 7: Monitor Your Deployment

While deploying, you can:

- **View Build Logs**: See the build process in real-time
- **Check Status**: Monitor deployment progress
- **Get Notifications**: Receive alerts on success or failure

Once deployed, you'll see:

- **Public URL**: Your application is live at `https://your-service-name.containr.app`
- **Status**: Green checkmark if running successfully
- **Metrics**: CPU, memory, and network usage

## Step 8: Add a Database (Optional)

Most applications need a database:

1. Click "Add Service" → "Add Database"
2. Choose your database type:
   - **PostgreSQL**: For relational data
   - **Redis**: For caching and sessions
   - **MySQL**: For MySQL compatibility
3. Configure:
   - Database name
   - Version
   - Size allocation
4. Click "Create Database"

### Connect Your Application

Once the database is created:

1. Go to your service's "Variables" tab
2. Add the database connection URL:
   ```
   DATABASE_URL=postgresql://username:password@hostname:port/database_name
   ```
3. Redeploy your application

## Step 9: Set Up Preview Environments

Enable automatic preview environments for pull requests:

1. Go to project settings
2. Enable "Preview Environments"
3. Configure:
   - Automatic cleanup (e.g., 7 days)
   - Branch patterns (e.g., `feature/*`, `fix/*`)
4. Save settings

Now when you create a pull request:
- A preview environment is automatically created
- You get a unique URL for testing
- Environment is cleaned up after merging

## Step 10: Configure Custom Domain (Optional)

To use your own domain:

1. Go to your service's "Settings" tab
2. Click "Add Custom Domain"
3. Enter your domain (e.g., `app.yourdomain.com`)
4. Configure DNS:
   ```
   CNAME app.yourdomain.com -> your-service-name.containr.app
   ```
5. Wait for SSL certificate provisioning

## Troubleshooting Common Issues

### Build Failures

**Problem**: Build fails during deployment

**Solutions**:
1. Check build logs for specific error messages
2. Verify your `package.json`, `go.mod`, or `requirements.txt` is valid
3. Ensure all dependencies are properly declared
4. Check for syntax errors in your code

### Runtime Errors

**Problem**: Application starts but crashes

**Solutions**:
1. Check runtime logs in the "Logs" tab
2. Verify environment variables are correctly set
3. Ensure your application listens on the correct port (default: `$PORT`)
4. Check database connection strings

### Port Issues

**Problem**: Application can't be accessed

**Solutions**:
1. Ensure your application listens on the `$PORT` environment variable
2. Don't hardcode ports in your application
3. Example for Node.js:
   ```javascript
   const port = process.env.PORT || 3000;
   app.listen(port, () => {
     console.log(`Server running on port ${port}`);
   });
   ```

## Best Practices

### Security

1. **Never commit secrets** to your repository
2. **Use environment variables** for all sensitive data
3. **Enable HTTPS** (automatic on Containr)
4. **Keep dependencies updated**

### Performance

1. **Optimize Docker images** by using `.dockerignore`
2. **Enable caching** for faster builds
3. **Monitor resource usage** and scale as needed
4. **Use CDN** for static assets

### Development Workflow

1. **Use feature branches** for new features
2. **Enable preview environments** for testing
3. **Write tests** and run them in CI/CD
4. **Monitor deployments** and set up alerts

## Next Steps

Now that you have your first application deployed:

- Explore the [Advanced Configuration](./advanced-configuration.md) guide
- Learn about [Scaling and Load Balancing](./scaling.md)
- Set up [Monitoring and Alerts](./monitoring.md)
- Join our [Community](https://github.com/your-org/containr/discussions)

## Need Help?

- **Documentation**: [containr.dev/docs](https://containr.dev/docs)
- **Community**: [GitHub Discussions](https://github.com/your-org/containr/discussions)
- **Support**: support@containr.dev
- **Status**: [status.containr.dev](https://status.containr.dev)

Happy deploying! 🚀
