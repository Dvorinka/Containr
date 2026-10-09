package api

import (
	"database/sql"
	"net/http"
	"time"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Instance-wide announcement banners. Admins manage them under
// /admin/banners; every signed-in user reads the active set at
// /banners/active so the UI (and CLI) can surface announcements.

var bannerLevels = map[string]bool{"info": true, "success": true, "warning": true, "error": true}

// bannerJSON flattens sqlc nullable wrappers into plain API values.
type bannerJSON struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	Level       string     `json:"level"`
	Active      bool       `json:"active"`
	Dismissible bool       `json:"dismissible"`
	StartsAt    *time.Time `json:"starts_at,omitempty"`
	EndsAt      *time.Time `json:"ends_at,omitempty"`
	CreatedAt   *time.Time `json:"created_at,omitempty"`
}

func toBannerJSON(b sqlcdb.Banner) bannerJSON {
	out := bannerJSON{
		ID:          b.ID.String(),
		Title:       b.Title,
		Body:        b.Body,
		Level:       b.Level,
		Active:      b.Active,
		Dismissible: b.Dismissible,
	}
	if b.StartsAt.Valid {
		out.StartsAt = &b.StartsAt.Time
	}
	if b.EndsAt.Valid {
		out.EndsAt = &b.EndsAt.Time
	}
	if b.CreatedAt.Valid {
		out.CreatedAt = &b.CreatedAt.Time
	}
	return out
}

func toBannerList(banners []sqlcdb.Banner) []bannerJSON {
	out := make([]bannerJSON, 0, len(banners))
	for _, b := range banners {
		out = append(out, toBannerJSON(b))
	}
	return out
}

type bannerRequest struct {
	Title       *string    `json:"title"`
	Body        *string    `json:"body"`
	Level       *string    `json:"level"`
	Active      *bool      `json:"active"`
	Dismissible *bool      `json:"dismissible"`
	StartsAt    *time.Time `json:"starts_at"`
	EndsAt      *time.Time `json:"ends_at"`
}

func bannerQueries(c *gin.Context) *sqlcdb.Queries {
	db := c.MustGet("db").(*database.DB)
	return sqlcdb.New(db.DB)
}

func parseBannerID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_ID", "invalid banner id")
		return uuid.Nil, false
	}
	return id, true
}

func validBannerLevel(level string) bool { return bannerLevels[level] }

func handleListActiveBanners(c *gin.Context) {
	banners, err := bannerQueries(c).ListActiveBanners(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to list banners")
		return
	}
	c.JSON(http.StatusOK, gin.H{"banners": toBannerList(banners)})
}

func handleAdminListBanners(c *gin.Context) {
	banners, err := bannerQueries(c).ListBanners(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to list banners")
		return
	}
	c.JSON(http.StatusOK, gin.H{"banners": toBannerList(banners)})
}

func handleAdminCreateBanner(c *gin.Context) {
	var req bannerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if req.Title == nil || *req.Title == "" {
		respondError(c, http.StatusBadRequest, "VALIDATION", "title is required")
		return
	}
	level := "info"
	if req.Level != nil {
		if !validBannerLevel(*req.Level) {
			respondError(c, http.StatusBadRequest, "VALIDATION", "level must be info, success, warning or error")
			return
		}
		level = *req.Level
	}
	userID, _ := requireAuthenticatedUserUUID(c)
	params := sqlcdb.CreateBannerParams{
		Title:       *req.Title,
		Level:       level,
		Active:      true,
		Dismissible: true,
		CreatedBy:   uuid.NullUUID{UUID: userID, Valid: true},
	}
	if req.Body != nil {
		params.Body = *req.Body
	}
	if req.Active != nil {
		params.Active = *req.Active
	}
	if req.Dismissible != nil {
		params.Dismissible = *req.Dismissible
	}
	if req.StartsAt != nil {
		params.StartsAt = sql.NullTime{Time: *req.StartsAt, Valid: true}
	}
	if req.EndsAt != nil {
		params.EndsAt = sql.NullTime{Time: *req.EndsAt, Valid: true}
	}
	banner, err := bannerQueries(c).CreateBanner(c.Request.Context(), params)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to create banner")
		return
	}
	c.JSON(http.StatusCreated, toBannerJSON(banner))
}

func handleAdminUpdateBanner(c *gin.Context) {
	id, ok := parseBannerID(c)
	if !ok {
		return
	}
	q := bannerQueries(c)
	banner, err := q.GetBannerByID(c.Request.Context(), id)
	if err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "banner not found")
		return
	}
	var req bannerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	params := sqlcdb.UpdateBannerParams{
		ID:          id,
		Title:       banner.Title,
		Body:        banner.Body,
		Level:       banner.Level,
		Active:      banner.Active,
		Dismissible: banner.Dismissible,
		StartsAt:    banner.StartsAt,
		EndsAt:      banner.EndsAt,
	}
	if req.Title != nil {
		params.Title = *req.Title
	}
	if req.Body != nil {
		params.Body = *req.Body
	}
	if req.Level != nil {
		if !validBannerLevel(*req.Level) {
			respondError(c, http.StatusBadRequest, "VALIDATION", "level must be info, success, warning or error")
			return
		}
		params.Level = *req.Level
	}
	if req.Active != nil {
		params.Active = *req.Active
	}
	if req.Dismissible != nil {
		params.Dismissible = *req.Dismissible
	}
	if req.StartsAt != nil {
		params.StartsAt = sql.NullTime{Time: *req.StartsAt, Valid: true}
	}
	if req.EndsAt != nil {
		params.EndsAt = sql.NullTime{Time: *req.EndsAt, Valid: true}
	}
	updated, err := q.UpdateBanner(c.Request.Context(), params)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to update banner")
		return
	}
	c.JSON(http.StatusOK, toBannerJSON(updated))
}

func handleAdminDeleteBanner(c *gin.Context) {
	id, ok := parseBannerID(c)
	if !ok {
		return
	}
	if err := bannerQueries(c).DeleteBanner(c.Request.Context(), id); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL", "failed to delete banner")
		return
	}
	c.Status(http.StatusNoContent)
}
