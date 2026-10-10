package api

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"containr/internal/database"
	"containr/internal/database/sqlcdb"
	"containr/internal/source"

	"github.com/google/uuid"
)

// resolveGitCloneSpec turns a service's git_repo (clone URL, ssh remote, or
// owner/repo) into a source.Spec with the project owner's provider token.
// Public repos get no token — the clone proceeds anonymously. github_app
// providers store the installation id, not a usable token; a fresh
// installation token is minted per deploy.
func resolveGitCloneSpec(db *database.DB, ownerID, gitRepo, branch, commit, buildPath string) (source.Spec, error) {
	raw := strings.TrimSpace(gitRepo)
	cloneURL, err := source.NormalizeCloneURL(raw)
	if err != nil {
		return source.Spec{}, err
	}

	spec := source.Spec{Branch: branch, Commit: commit, BuildPath: buildPath}
	q := sqlcdb.New(db.DB)
	ctx := context.Background()

	ownerUUID, _ := uuid.Parse(ownerID)
	var providerID uuid.UUID
	if !strings.Contains(cloneURL, "://") {
		// Bare owner/repo — the connected repository row knows the host.
		row, err := q.GetGitRepoCloneByFullName(ctx, sqlcdb.GetGitRepoCloneByFullNameParams{
			FullName: cloneURL,
			UserID:   ownerUUID,
		})
		if err != nil {
			return source.Spec{}, fmt.Errorf("repository %s is not connected — connect it under Git settings or store a clone URL", raw)
		}
		cloneURL = row.CloneUrl
		providerID = row.ProviderID
	} else {
		// URL form — match a connected repo for its provider when possible;
		// an unmatched public URL still clones, just without credentials.
		if pid, err := q.GetGitRepoProviderByCloneURL(ctx, sqlcdb.GetGitRepoProviderByCloneURLParams{
			CloneUrl: cloneURL,
			UserID:   ownerUUID,
		}); err == nil {
			providerID = pid
		}
	}

	if err := source.ValidateRemoteURL(cloneURL); err != nil {
		return source.Spec{}, err
	}
	spec.CloneURL = cloneURL

	if providerID == uuid.Nil {
		return spec, nil
	}
	prov, err := q.GetGitProviderForFetch(ctx, sqlcdb.GetGitProviderForFetchParams{
		ID:     providerID,
		UserID: ownerUUID,
	})
	if err != nil {
		return spec, nil // provider row gone — anonymous clone still works for public repos
	}
	name, apiURL, token := prov.Name, prov.ApiUrl, prov.AccessToken

	switch strings.ToLower(name) {
	case "github_app":
		installationID, err := strconv.ParseInt(strings.TrimSpace(token), 10, 64)
		if err == nil && installationID > 0 {
			if minted, err := getGitHubAppInstallationToken(apiURL, installationID); err == nil {
				spec.Token = minted
				spec.User = "x-access-token"
			}
		}
	case "gitlab":
		spec.Token = token
		spec.User = "oauth2"
	case "bitbucket":
		spec.Token = token
		spec.User = "x-token-auth"
	default:
		spec.Token = token
		spec.User = "x-access-token"
	}
	return spec, nil
}
