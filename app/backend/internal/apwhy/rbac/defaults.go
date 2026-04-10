package rbac

type PermissionSeed struct {
	Code        string
	Name        string
	Description string
}

var PermissionSeeds = []PermissionSeed{
	{Code: "services.read", Name: "Read Services", Description: "View service routing and status."},
	{Code: "services.write", Name: "Manage Services", Description: "Create and modify protected services."},
	{Code: "databases.read", Name: "Read Databases", Description: "View database connectors."},
	{Code: "databases.write", Name: "Manage Databases", Description: "Create and modify database connectors."},
	{Code: "keys.read", Name: "Read API Keys", Description: "View API keys and plans."},
	{Code: "keys.write", Name: "Manage API Keys", Description: "Create and modify API keys."},
	{Code: "users.read", Name: "Read Users", Description: "View users and login status."},
	{Code: "users.write", Name: "Manage Users", Description: "Create and modify user accounts."},
	{Code: "roles.read", Name: "Read Roles", Description: "View roles and permissions."},
	{Code: "roles.write", Name: "Manage Roles", Description: "Create and modify roles and permissions."},
	{Code: "analytics.read", Name: "Read Analytics", Description: "View ops and traffic analytics."},
	{Code: "settings.write", Name: "Manage Settings", Description: "Modify system settings and integrations."},
}

var OwnerPermissionCodes = []string{
	"services.read", "services.write",
	"databases.read", "databases.write",
	"keys.read", "keys.write",
	"users.read", "users.write",
	"roles.read", "roles.write",
	"analytics.read", "settings.write",
}

var AdminPermissionCodes = []string{
	"services.read", "services.write",
	"databases.read", "databases.write",
	"keys.read", "keys.write",
	"users.read", "users.write",
	"roles.read",
	"analytics.read",
}

var ViewerPermissionCodes = []string{
	"services.read",
	"databases.read",
	"keys.read",
	"users.read",
	"roles.read",
	"analytics.read",
}
