package api

import (
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// pageWindow parses pagination from either ?page=&limit= (legacy) or
// ?cursor=&limit= (agent-friendly). The cursor is an opaque base64 offset —
// cheap to implement over the existing offset queries while the public
// contract stays cursor-shaped for clients.
func pageWindow(c *gin.Context, defaultLimit, maxLimit int) (offset, limit int) {
	limit = defaultLimit
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= maxLimit {
			limit = n
		}
	}
	if cur := c.Query("cursor"); cur != "" {
		if raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(cur, "o_")); err == nil {
			if n, err := strconv.Atoi(string(raw)); err == nil && n >= 0 {
				return n, limit
			}
		}
		return 0, limit // invalid cursor → first page, fail soft
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	return (page - 1) * limit, limit
}

// paginationMeta renders the standard envelope: legacy page fields plus
// next_cursor when another page exists.
func paginationMeta(offset, limit, total int) gin.H {
	page := offset/limit + 1
	meta := gin.H{
		"page":  page,
		"limit": limit,
		"total": total,
		"pages": (total + limit - 1) / limit,
	}
	if offset+limit < total {
		meta["next_cursor"] = "o_" + base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprint(offset+limit)))
	}
	return meta
}
