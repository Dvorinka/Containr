package api

import (
	"fmt"
	"strconv"
	"strings"

	"containr/internal/database"
	"containr/internal/source"
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

	var providerID string
	if !strings.Contains(cloneURL, "://") {
		// Bare owner/repo — the connected repository row knows the host.
		err = db.QueryRow(
			`SELECT clone_url, provider_id FROM git_repositories
			 WHERE full_name = $1 AND user_id = $2 LIMIT 1`,
			cloneURL, ownerID,
		).Scan(&cloneURL, &providerID)
		if err != nil {
			return source.Spec{}, fmt.Errorf("repository %s is not connected — connect it under Git settings or store a clone URL", raw)
		}
	} else {
		// URL form — match a connected repo for its provider when possible;
		// an unmatched public URL still clones, just without credentials.
		_ = db.QueryRow(
			`SELECT provider_id FROM git_repositories
			 WHERE clone_url = $1 AND user_id = $2 LIMIT 1`,
			cloneURL, ownerID,
		).Scan(&providerID)
	}

	if err := source.ValidateRemoteURL(cloneURL); err != nil {
		return source.Spec{}, err
	}
	spec.CloneURL = cloneURL

	if providerID == "" {
		return spec, nil
	}
	var name, apiURL, token string
	if err := db.QueryRow(
		`SELECT name, api_url, access_token FROM git_providers
		 WHERE id = $1 AND user_id = $2`,
		providerID, ownerID,
	).Scan(&name, &apiURL, &token); err != nil {
		return spec, nil // provider row gone — anonymous clone still works for public repos
	}

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
