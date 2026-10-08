package api

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func ctxWithQuery(q string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/x?"+q, nil)
	return c
}

func TestPageWindowDefaults(t *testing.T) {
	offset, limit := pageWindow(ctxWithQuery(""), 10, 100)
	if offset != 0 || limit != 10 {
		t.Fatalf("expected 0/10, got %d/%d", offset, limit)
	}
}

func TestPageWindowLegacyPage(t *testing.T) {
	offset, limit := pageWindow(ctxWithQuery("page=3&limit=20"), 10, 100)
	if offset != 40 || limit != 20 {
		t.Fatalf("expected 40/20, got %d/%d", offset, limit)
	}
}

func TestPageWindowCursor(t *testing.T) {
	// cursor for offset 50 produced by paginationMeta
	meta := paginationMeta(0, 50, 200)
	cursor := meta["next_cursor"].(string)
	offset, limit := pageWindow(ctxWithQuery("cursor="+cursor+"&limit=50"), 10, 100)
	if offset != 50 || limit != 50 {
		t.Fatalf("expected 50/50, got %d/%d", offset, limit)
	}
}

func TestPageWindowInvalidCursorFailsSoft(t *testing.T) {
	offset, _ := pageWindow(ctxWithQuery("cursor=garbage"), 10, 100)
	if offset != 0 {
		t.Fatalf("expected offset 0 on invalid cursor, got %d", offset)
	}
}

func TestPaginationMetaNextCursorOnlyWhenMore(t *testing.T) {
	if _, ok := paginationMeta(0, 10, 10)["next_cursor"]; ok {
		t.Fatal("no next page should omit next_cursor")
	}
	if _, ok := paginationMeta(0, 10, 25)["next_cursor"]; !ok {
		t.Fatal("expected next_cursor when more pages exist")
	}
}
