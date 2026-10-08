package commands

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/spf13/viper"
)

// JSONMode reports whether --json was passed. In JSON mode every command
// prints the raw API response and nothing else — safe for agents and pipes.
func JSONMode() bool {
	return viper.GetBool("json")
}

// PrintResult renders data: pretty JSON in --json mode, otherwise the
// default JSON rendering is used unless a command prints its own table
// first (commands that render a table should check JSONMode() themselves).
func PrintJSON(v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(data))
	return nil
}

// PrintRaw prints raw response bytes as pretty JSON when they decode as
// JSON, else verbatim.
func PrintRaw(data []byte) {
	var v interface{}
	if json.Unmarshal(data, &v) == nil {
		out, _ := json.MarshalIndent(v, "", "  ")
		fmt.Println(string(out))
		return
	}
	fmt.Println(string(data))
}

// PrintTable renders rows under headers with tabwriter alignment.
// Skipped entirely in JSON mode.
func PrintTable(headers []string, rows [][]string) {
	if JSONMode() {
		return
	}
	w := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, strings.Join(headers, "\t"))
	for _, row := range rows {
		fmt.Fprintln(w, strings.Join(row, "\t"))
	}
	w.Flush()
}

// Confirm asks the user to confirm a destructive action. Returns true
// immediately when --yes/--force was passed or stdin is not a TTY and
// --yes was given. In non-interactive contexts without --yes it refuses.
func Confirm(prompt string) bool {
	if viper.GetBool("yes") {
		return true
	}
	if !isTerminal() {
		return false
	}
	fmt.Fprintf(os.Stderr, "%s [y/N] ", prompt)
	reader := bufio.NewReader(os.Stdin)
	answer, err := reader.ReadString('\n')
	if err != nil {
		return false
	}
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "y" || answer == "yes"
}

func isTerminal() bool {
	info, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
}

// ExitCode inspects an error and returns the process exit code.
func ExitCode(err error) int {
	if err == nil {
		return ExitOK
	}
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.ExitCode
	}
	return ExitError
}
