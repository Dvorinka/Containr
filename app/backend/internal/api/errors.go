package api

import (
	"github.com/gin-gonic/gin"
)

// Stable machine-readable error codes for agent clients. The "error" field
// stays human-readable; "code" is the contract the CLI/MCP rely on.
const (
	CodeUnauthorized       = "UNAUTHENTICATED"
	CodeInvalidToken       = "INVALID_TOKEN"
	CodeForbidden          = "FORBIDDEN"
	CodeAdminRequired      = "ADMIN_REQUIRED"
	CodeScopeInsufficient  = "SCOPE_INSUFFICIENT"
	CodeNotFound           = "NOT_FOUND"
	CodeValidation         = "VALIDATION"
	CodeConflict           = "CONFLICT"
	CodeInternal           = "INTERNAL"
	CodeUnavailable        = "DEPENDENCY_UNAVAILABLE"
	CodeIdempotencyRunning = "IDEMPOTENCY_IN_PROGRESS"
)

// respondError emits the standard error envelope. Existing handlers return
// bare {"error": msg} — this adds the stable code for new and
// agent-facing paths.
func respondError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": message, "code": code})
	c.Abort()
}
