package commands

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

var (
	activitySeverity string
	activityCategory string
	activityResource string
	activityProject  string
	activityLimit    int
)

// ActivityCmd shows the enriched activity feed (audit events with
// severity/category/label).
var ActivityCmd = &cobra.Command{
	Use:   "activity",
	Short: "Activity feed — enriched audit events",
	RunE: func(cmd *cobra.Command, args []string) error {
		c, err := client()
		if err != nil {
			return err
		}
		params := []string{fmt.Sprintf("limit=%d", activityLimit)}
		if activitySeverity != "" {
			params = append(params, "severity="+activitySeverity)
		}
		if activityCategory != "" {
			params = append(params, "category="+activityCategory)
		}
		if activityResource != "" {
			params = append(params, "resource="+activityResource)
		}
		if activityProject != "" {
			params = append(params, "project_id="+activityProject)
		}
		data, err := c.Do("GET", "/activity?"+strings.Join(params, "&"), nil)
		if err != nil {
			return err
		}
		items, err := unwrapList(data, "activity")
		if err != nil {
			return err
		}
		rows := make([][]string, 0, len(items))
		for _, e := range items {
			rows = append(rows, []string{
				str(e, "severity"), str(e, "category"), str(e, "label"),
				str(e, "user_email"), relTime(e, "created_at"),
			})
		}
		printRows(data, []string{"SEVERITY", "CATEGORY", "EVENT", "ACTOR", "WHEN"}, rows)
		return nil
	},
}

func init() {
	ActivityCmd.Flags().StringVar(&activitySeverity, "severity", "", "filter: info|success|warning|error")
	ActivityCmd.Flags().StringVar(&activityCategory, "category", "", "filter by category")
	ActivityCmd.Flags().StringVar(&activityResource, "resource", "", "filter by resource type")
	ActivityCmd.Flags().StringVar(&activityProject, "project", "", "filter by project id")
	ActivityCmd.Flags().IntVar(&activityLimit, "limit", 50, "max events")
}
