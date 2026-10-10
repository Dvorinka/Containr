package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

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
	rows, err := sqlcdb.New(db.DB).ListServiceDomains(context.Background(), serviceID)
	if err != nil {
		return nil
	}
	out := make([]ServiceDomain, 0, len(rows))
	for _, r := range rows {
		d := ServiceDomain{
			ID:         r.ID,
			ServiceID:  r.ServiceID,
			Domain:     r.Domain,
			IsDefault:  r.IsDefault,
			CertType:   r.CertType,
			CertStatus: r.CertStatus,
			CreatedAt:  r.CreatedAt,
		}
		if r.LastCheckedAt.Valid {
			t := r.LastCheckedAt.Time
			d.LastCheckedAt = &t
		}
		out = append(out, d)
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
	if len(out) == 0 {
		out = serviceAutoDomains(db, serviceID)
	}
	return out
}

// dnsLabel normalizes a service name into a DNS label: lowercase alnum
// plus single dashes, never leading/trailing, ≤63 chars.
func dnsLabel(name string) string {
	var b strings.Builder
	lastWasSep := false
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastWasSep = false
			continue
		}
		if !lastWasSep && b.Len() > 0 {
			b.WriteByte('-')
			lastWasSep = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 63 {
		out = strings.Trim(out[:63], "-")
	}
	return out
}

// serviceAutoDomains generates <service>.<node-default-domain> hostnames
// for services with no explicit domains. Pinned services take their node's
// base domain; spread services union every eligible node's base domain.
// Local services get nothing — there is no instance-level base domain yet.
func serviceAutoDomains(db *database.DB, serviceID uuid.UUID) []string {
	ctx := context.Background()
	q := sqlcdb.New(db.DB)
	brief, err := q.GetServicePlacementBrief(ctx, serviceID)
	if err != nil {
		return nil
	}
	label := dnsLabel(brief.Name)
	if label == "" {
		return nil
	}

	var bases []string
	nodeID := brief.NodeID
	spread := brief.Spread
	switch {
	case nodeID.Valid && nodeID.String != "":
		if a, err := q.GetAgent(ctx, nodeID.String); err == nil && a.DefaultDomain != "" {
			bases = []string{a.DefaultDomain}
		}
	case spread:
		var err error
		bases, err = q.ListSchedulableAgentDomains(ctx, json.RawMessage(tagsJSON(servicePlacementTags(db, serviceID))))
		if err != nil {
			bases = nil
		}
	}
	out := make([]string, 0, len(bases))
	for _, base := range bases {
		out = append(out, label+"."+base)
	}
	return out
}

// syncDefaultDomain writes the is_default row back to services.domain so
// legacy reads (CLI tables, public_url) keep working.
func syncDefaultDomain(db *database.DB, serviceID uuid.UUID) {
	ctx := context.Background()
	q := sqlcdb.New(db.DB)
	domain, err := q.GetServiceDomainDefault(ctx, serviceID)
	if err == sql.ErrNoRows {
		domain, err = q.GetServiceDomainFirst(ctx, serviceID)
	}
	if err == sql.ErrNoRows {
		domain = ""
	}
	_ = q.SetServiceLegacyDomain(ctx, sqlcdb.SetServiceLegacyDomainParams{Domain: domain, ID: serviceID})
}

// serviceAccess loads the maintenance/basic-auth columns for the runtime spec.
func serviceAccess(db *database.DB, serviceID uuid.UUID) (maintenance bool, basicAuth string) {
	row, err := sqlcdb.New(db.DB).GetServiceAccess(context.Background(), serviceID)
	if err != nil {
		return false, ""
	}
	return row.MaintenanceMode, row.BasicAuthUsers
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
	uid, _ := uuid.Parse(fmt.Sprint(userID))
	ok, err := sqlcdb.New(db.DB).ServiceWriteAccess(context.Background(), sqlcdb.ServiceWriteAccessParams{
		ID:      serviceID,
		OwnerID: uid,
		Column3: contextIsAdmin(c),
	})
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

	ctx := c.Request.Context()
	q := sqlcdb.New(db.(*database.DB).DB)

	// First domain on a service becomes the default automatically.
	count, _ := q.CountServiceDomains(ctx, serviceID)
	makeDefault := req.IsDefault || count == 0

	tx, err := db.(*database.DB).Begin()
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Failed to add domain")
		return
	}
	defer tx.Rollback()
	qtx := q.WithTx(tx)
	if makeDefault {
		if err := qtx.ClearServiceDomainDefault(ctx, serviceID); err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL", "Failed to add domain")
			return
		}
	}
	row, err := qtx.CreateServiceDomain(ctx, sqlcdb.CreateServiceDomainParams{
		ServiceID: serviceID,
		Domain:    domain,
		IsDefault: makeDefault,
	})
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
	c.JSON(http.StatusCreated, gin.H{"domain": ServiceDomain{
		ID:         row.ID,
		ServiceID:  row.ServiceID,
		Domain:     row.Domain,
		IsDefault:  row.IsDefault,
		CertType:   row.CertType,
		CertStatus: row.CertStatus,
		CreatedAt:  row.CreatedAt,
	}})
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
	affected, err := sqlcdb.New(db.(*database.DB).DB).DeleteServiceDomain(
		c.Request.Context(), sqlcdb.DeleteServiceDomainParams{ID: domainID, ServiceID: serviceID})
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
	affected, err := sqlcdb.New(db.(*database.DB).DB).SetServiceDomainDefault(
		c.Request.Context(), sqlcdb.SetServiceDomainDefaultParams{ID: domainID, ServiceID: serviceID})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "Failed to set default domain")
		return
	}
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
		_ = sqlcdb.New(dbh.DB).TouchServiceDomainChecked(c.Request.Context(), d.ID)
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
