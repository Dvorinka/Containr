package commands

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/viper"
)

// ActiveProfile resolves which profile applies: --profile flag >
// CONTAINR_PROFILE env > current_profile in config > "default".
func ActiveProfile() string {
	if p := viper.GetString("profile"); p != "" {
		return p
	}
	if p := os.Getenv("CONTAINR_PROFILE"); p != "" {
		return p
	}
	if p := viper.GetString("current_profile"); p != "" {
		return p
	}
	return "default"
}

// ResolveAPIURL returns the effective API base URL:
// --api-url flag > CONTAINR_API_URL env > profile.api_url > localhost default.
func ResolveAPIURL() string {
	if u := viper.GetString("api-url"); u != "" {
		return normalizeBase(u)
	}
	if u := os.Getenv("CONTAINR_API_URL"); u != "" {
		return normalizeBase(u)
	}
	if u := viper.GetString("profiles." + ActiveProfile() + ".api_url"); u != "" {
		return normalizeBase(u)
	}
	return "http://localhost:8080/api/v1"
}

// ResolveToken returns the effective auth token:
// --token flag > CONTAINR_TOKEN env > profile.token.
func ResolveToken() string {
	if t := viper.GetString("token"); t != "" {
		return t
	}
	if t := os.Getenv("CONTAINR_TOKEN"); t != "" {
		return t
	}
	return viper.GetString("profiles." + ActiveProfile() + ".token")
}

func normalizeBase(u string) string {
	u = strings.TrimSuffix(strings.TrimSpace(u), "/")
	// Accept the bare host too — append the API prefix when missing.
	if u != "" && !strings.HasSuffix(u, "/api/v1") {
		u += "/api/v1"
	}
	return u
}

// SaveProfile persists api_url/token under a named profile and makes it
// current. Creates the config file if none exists.
func SaveProfile(name, apiURL, token string) error {
	base := "profiles." + name
	if apiURL != "" {
		viper.Set(base+".api_url", apiURL)
	}
	if token != "" {
		viper.Set(base+".token", token)
	}
	viper.Set("current_profile", name)
	return writeConfig()
}

// ClearProfileToken removes only the token from the active profile.
func ClearProfileToken(name string) error {
	viper.Set("profiles."+name+".token", "")
	return writeConfig()
}

// ListProfiles returns profile name → api_url for `auth status --all`.
func ListProfiles() map[string]string {
	out := map[string]string{}
	profiles := viper.GetStringMap("profiles")
	for name := range profiles {
		if u := viper.GetString("profiles." + name + ".api_url"); u != "" {
			out[name] = u
		} else {
			out[name] = "(no url)"
		}
	}
	return out
}

func writeConfig() error {
	if err := viper.WriteConfig(); err != nil {
		// No config file yet — create one.
		home, herr := os.UserHomeDir()
		if herr != nil {
			return fmt.Errorf("cannot locate home directory: %w", herr)
		}
		return viper.WriteConfigAs(home + "/.containr.yaml")
	}
	return nil
}
