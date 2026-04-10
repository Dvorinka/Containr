package commands

import (
	"bytes"
	"containr/internal/pkg/utils"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// Project represents a Containr project
type Project struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	OwnerID     string `json:"owner_id"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// ProjectsCmd represents the projects command
var ProjectsCmd = &cobra.Command{
	Use:   "projects",
	Short: "Manage projects",
	Long: `Manage your Containr projects.
You can list, create, update, and delete projects.`,
}

// listProjectsCmd represents the list command
var listProjectsCmd = &cobra.Command{
	Use:   "list",
	Short: "List all projects",
	Long:  `List all your Containr projects.`,
	RunE:  runListProjects,
}

// createProjectCmd represents the create command
var createProjectCmd = &cobra.Command{
	Use:   "create [name]",
	Short: "Create a new project",
	Long: `Create a new Containr project.
Provide a name and optional description.`,
	Args: cobra.ExactArgs(1),
	RunE: runCreateProject,
}

// deleteProjectCmd represents the delete command
var deleteProjectCmd = &cobra.Command{
	Use:   "delete [project-id]",
	Short: "Delete a project",
	Long:  `Delete a Containr project by ID.`,
	Args:  cobra.ExactArgs(1),
	RunE:  runDeleteProject,
}

var projectDescription string

// getAPIURL constructs the full API URL for a given endpoint
func getAPIURL(endpoint string) string {
	baseURL := viper.GetString("api-url")
	if baseURL == "" {
		baseURL = "http://localhost:8080/api/v1" // Default for development
	}

	// Ensure baseURL doesn't end with / and endpoint starts with /
	baseURL = strings.TrimSuffix(baseURL, "/")
	if !strings.HasPrefix(endpoint, "/") {
		endpoint = "/" + endpoint
	}

	return baseURL + endpoint
}

func init() {
	ProjectsCmd.AddCommand(listProjectsCmd)
	ProjectsCmd.AddCommand(createProjectCmd)
	ProjectsCmd.AddCommand(deleteProjectCmd)

	// Add flags
	createProjectCmd.Flags().StringVarP(&projectDescription, "description", "d", "", "Project description")
}

func runListProjects(cmd *cobra.Command, args []string) error {
	apiURL := getAPIURL("/projects")

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+viper.GetString("token"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API request failed: %s - %s", resp.Status, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	var projects []Project
	if err := json.Unmarshal(body, &projects); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if len(projects) == 0 {
		fmt.Println("No projects found")
		return nil
	}

	fmt.Println("Your Projects:")
	fmt.Println()
	for _, project := range projects {
		fmt.Printf("📦 %s (%s)\n", project.Name, project.ID)
		if project.Description != "" {
			fmt.Printf("   %s\n", project.Description)
		}
		fmt.Printf("   Created: %s\n", utils.FormatTime(project.CreatedAt))
		fmt.Println()
	}

	return nil
}

func runCreateProject(cmd *cobra.Command, args []string) error {
	name := args[0]

	projectData := map[string]interface{}{
		"name": name,
	}

	if projectDescription != "" {
		projectData["description"] = projectDescription
	}

	jsonData, err := json.Marshal(projectData)
	if err != nil {
		return fmt.Errorf("failed to marshal project data: %w", err)
	}

	apiURL := getAPIURL("/projects")

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+viper.GetString("token"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API request failed: %s - %s", resp.Status, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	var project Project
	if err := json.Unmarshal(body, &project); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	fmt.Printf("✓ Project '%s' created successfully!\n", project.Name)
	fmt.Printf("ID: %s\n", project.ID)
	return nil
}

func runDeleteProject(cmd *cobra.Command, args []string) error {
	projectID := args[0]

	apiURL := getAPIURL("/projects/" + projectID)

	req, err := http.NewRequest("DELETE", apiURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+viper.GetString("token"))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API request failed: %s - %s", resp.Status, string(body))
	}

	fmt.Printf("✓ Project '%s' deleted successfully!\n", projectID)
	return nil
}
