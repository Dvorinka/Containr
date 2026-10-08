package api

import (
	"context"
	"database/sql"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"containr/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ServiceDomain is one hostname routed to a service. services.domain stays
// the derived default; this table is the source of truth for the full set.
type ServiceDomain struct {
	ID            uuid.UUID  `json:"id"`
	ServiceID     uuid.UUID  `json:"service_id"`
	Domain        string     `json:"domain"`
	IsDefault     bool       `json:"is_default"`
	CertType      string     `json:"cert_type"`
	CertStatus    string     `json:"cert_status"`
	LastCheckedAt *time.Time `json:"last_checked_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// BasicAuthCred is a plaintext credential the server encodes to htpasswd.
type BasicAuthCred struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

var hostnameRE = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$`)

func validHostname(d string) bool {
	return len(d) <= 253 && hostnameRE.MatchString(d)
}

func loadServiceDomains(db *database.DB, serviceID uuid.UUID) []ServiceDomain {
	rows, err := db.Query(
		`SELECT id, service_id, domain, is_default, cert_type, cert_status, last_checked_at, created_at
		 FROM service_domains WHERE service_id = $1 ORDER BY is_default DESC, created_at ASC`, serviceID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	out := []ServiceDomain{}
	for rows.Next() {
		var d ServiceDomain
		if err := rows.Scan(&d.ID, &d.ServiceID, &d.Domain, &d.IsDefault, &d.CertType, &d.CertStatus, &d.LastCheckedAt, &d.CreatedAt); err == nil {
			out = append(out, d)
		}
	}
	return out
}

func serviceDomainNames(db *database.DB, serviceID uuid.UUID, fallback string) []string {
	domains := loadServiceDomains(db, serviceID)
	out := make([]string, 0, len(domains))
	for _, d := range domains {
		out = append(out, d.Domain)
	}
	if len(out) == 0 && fallback != "" {
		out = []string{fallback}
	}
	return out
}

// syncDefaultDomain writes the is_default row back to services.domain so
// legacy reads (CLI tables, public_url) keep working.
func syncDefaultDomain(db *database.DB, serviceID uuid.UUID) {
	var domain string
	err := db.QueryRow(
		`SELECT domain FROM service_domains WHERE service_id = $1 AND is_default`, serviceID).Scan(&domain)
	if err == sql.ErrNoRows {
		err = db.QueryRow(
			`SELECT domain FROM service_domains WHERE service_id = $1 ORDER BY created_at ASC LIMIT 1`, serviceID).Scan(&domain)
	}
	if err == sql.ErrNoRows {
		domain = ""
	}
	_, _ = db.Exec(`UPDATE services SET domain = $1 WHERE id = $2`, domain, serviceID)
}

// serviceAccess loads the maintenance/basic-auth columns for the runtime spec.
func serviceAccess(db *database.DB, serviceID uuid.UUID) (maintenance bool, basicAuth string) {
	_ = db.QueryRow(`SELECT maintenance_mode, basic_auth_users FROM services WHERE id = $1`, serviceID).
		Scan(&maintenance, &basicAuth)
	return maintenance, basicAuth
}

// maintenanceURL is the redirect target for maintenance mode — the public
// base URL of this API plus the maintenance page path.
func maintenanceURL(db *database.DB) string {
	base := strings.TrimRight(settingValue(db, "base_url", "BASE_URL", ""), "/")
	if base == "" {
		return ""
	}
	return base + "/api/v1/maintenance"
}

// encodeBasicAuth turns plaintext creds into Traefik's htpasswd format
// (user:bcrypt hash, comma-separated). Bcrypt is what Traefik expects.
func encodeBasicAuth(creds []BasicAuthCred) (string, error) {
	pairs := make([]string, 0, len(creds))
	for _, cred := range creds {
		if cred.Username == "" || cred.Password == "" {
			continue
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(cred.Password), bcrypt.DefaultCost)
		if err != nil {
			return "", err
		}
		pairs = append(pairs, cred.Username+":"+string(hash))
	}
	return strings.Join(pairs, ","), nil
}

// basicAuthUsernames returns just the usernames for API responses — never
// the hashes.
func basicAuthUsernames(encoded string) []string {
	var out []string
	for _, pair := range strings.Split(encoded, ",") {
		if u, _, ok := strings.Cut(pair, ":"); ok && u != "" {
			out = append(out, u)
		}
	}
	return out
}

// serviceWriteAccess mirrors the service update handler's access check.
func serviceWriteAccess(c *gin.Context, db *database.DB, serviceID uuid.UUID) bool {
	userID, _ := c.Get("user_id")
	var ok bool
	err := db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM services s JOIN projects p ON s.project_id = p.id
			WHERE s.id = $1 AND (p.owner_id = $2 OR $3::bool))`,
		serviceID, userID, contextIsAdmin(c)).Scan(&ok)
	return err == nil && ok
}

func handleListServiceDomains(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Database connection not available")
		return
	}
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid service ID")
		return
	}
	c.JSON(http.StatusOK, gin.H{"domains": loadServiceDomains(db.(*database.DB), serviceID)})
}

func handleAddServiceDomain(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Database connection not available")
		return
	}
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid service ID")
		return
	}
	if !serviceWriteAccess(c, db.(*database.DB), serviceID) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Service not found")
		return
	}
	var req struct {
		Domain    string `json:"domain" binding:"required"`
		IsDefault bool   `json:"is_default"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", err.Error())
		return
	}
	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	if !validHostname(domain) {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid hostname")
		return
	}

	// First domain on a service becomes the default automatically.
	var count int
	_ = db.(*database.DB).QueryRow(`SELECT COUNT(*) FROM service_domains WHERE service_id = $1`, serviceID).Scan(&count)
	makeDefault := req.IsDefault || count == 0

	tx, err := db.(*database.DB).Begin()
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Failed to add domain")
		return
	}
	defer tx.Rollback()
	if makeDefault {
		if _, err := tx.Exec(`UPDATE service_domains SET is_default = false WHERE service_id = $1`, serviceID); err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL", "Failed to add domain")
			return
		}
	}
	var inserted ServiceDomain
	err = tx.QueryRow(
		`INSERT INTO service_domains (service_id, domain, is_default)
		 VALUES ($1, $2, $3)
		 RETURNING id, service_id, domain, is_default, cert_type, cert_status, created_at`,
		serviceID, domain, makeDefault).
		Scan(&inserted.ID, &inserted.ServiceID, &inserted.Domain, &inserted.IsDefault, &inserted.CertType, &inserted.CertStatus, &inserted.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			respondError(c, http.StatusConflict, "CONFLICT", "Domain already attached to this service")
			return
		}
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Failed to add domain")
		return
	}
	if err := tx.Commit(); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Failed to add domain")
		return
	}
	syncDefaultDomain(db.(*database.DB), serviceID)
	c.JSON(http.StatusCreated, gin.H{"domain": inserted})
}

func handleDeleteServiceDomain(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Database connection not available")
		return
	}
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid service ID")
		return
	}
	if !serviceWriteAccess(c, db.(*database.DB), serviceID) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Service not found")
		return
	}
	domainID, err := uuid.Parse(c.Param("domain_id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid domain ID")
		return
	}
	res, err := db.(*database.DB).Exec(
		`DELETE FROM service_domains WHERE id = $1 AND service_id = $2`, domainID, serviceID)
	affected, _ := res.RowsAffected()
	if err != nil || affected == 0 {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Domain not found")
		return
	}
	syncDefaultDomain(db.(*database.DB), serviceID)
	c.JSON(http.StatusOK, gin.H{"deleted": domainID})
}

func handleSetDefaultDomain(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Database connection not available")
		return
	}
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid service ID")
		return
	}
	if !serviceWriteAccess(c, db.(*database.DB), serviceID) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Service not found")
		return
	}
	domainID, err := uuid.Parse(c.Param("domain_id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid domain ID")
		return
	}
	res, err := db.(*database.DB).Exec(
		`UPDATE service_domains SET is_default = (id = $1) WHERE service_id = $2`,
		domainID, serviceID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Failed to set default domain")
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Domain not found")
		return
	}
	syncDefaultDomain(db.(*database.DB), serviceID)
	c.JSON(http.StatusOK, gin.H{"domains": loadServiceDomains(db.(*database.DB), serviceID)})
}

// handleCheckServiceDomains resolves each domain's DNS and compares it to
// the configured expected target (app_settings.public_ip / PUBLIC_IP, or the
// base_url host). Statuses: ok | wrong-target | pending.
func handleCheckServiceDomains(c *gin.Context) {
	db, exists := c.Get("db")
	if !exists {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Database connection not available")
		return
	}
	dbh := db.(*database.DB)
	serviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION", "Invalid service ID")
		return
	}

	expectedIP := settingValue(dbh, "public_ip", "PUBLIC_IP", "")
	expectedHost := ""
	if base := settingValue(dbh, "base_url", "BASE_URL", ""); base != "" {
		if u := strings.TrimPrefix(strings.TrimPrefix(base, "https://"), "http://"); u != "" {
			expectedHost, _, _ = strings.Cut(u, "/")
			expectedHost, _, _ = strings.Cut(expectedHost, ":")
		}
	}

	type result struct {
		Domain   string   `json:"domain"`
		Status   string   `json:"status"` // ok | wrong-target | pending
		Resolved []string `json:"resolved"`
	}
	results := []result{}
	resolver := net.DefaultResolver
	for _, d := range loadServiceDomains(dbh, serviceID) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 4*time.Second)
		addrs, _ := resolver.LookupHost(ctx, d.Domain)
		cname, _ := resolver.LookupCNAME(ctx, d.Domain)
		cancel()

		r := result{Domain: d.Domain, Resolved: addrs}
		cname = strings.TrimSuffix(cname, ".")
		switch {
		case len(addrs) == 0:
			r.Status = "pending"
		case expectedIP != "":
			r.Status = "wrong-target"
			for _, a := range addrs {
				if a == expectedIP {
					r.Status = "ok"
				}
			}
		case expectedHost != "":
			r.Status = "ok" // resolves; CNAME match is advisory only
			if cname != "" && cname != d.Domain && cname != expectedHost {
				r.Status = "wrong-target"
			}
		default:
			r.Status = "ok"
		}
		results = append(results, r)
		_, _ = dbh.Exec(`UPDATE service_domains SET last_checked_at = NOW() WHERE id = $1`, d.ID)
	}
	c.JSON(http.StatusOK, gin.H{"domains": results})
}

// handleMaintenancePage serves the maintenance-mode landing page. Public:
// browsers hit it via the Traefik redirect before any auth.
func handleMaintenancePage(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maintenance</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0e14;color:#e6e8ee;font-family:system-ui,sans-serif}
.card{text-align:center;padding:2rem}.title{font-size:1.4rem;font-weight:600;margin-bottom:.5rem}
.sub{color:#9aa3b2;font-size:.95rem}.brand{margin-top:2rem;color:#5b6472;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase}
</style></head><body><div class="card">
<div class="title">This service is under maintenance</div>
<div class="sub">Please check back shortly.</div>
<div class="brand">Containr</div>
</div></body></html>`))
}
