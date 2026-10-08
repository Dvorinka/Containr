package api

import "testing"

func TestParseCPUReserveShares(t *testing.T) {
	cases := map[string]int64{
		"":      0,
		"0":     0,
		"-1":    0,
		"abc":   0,
		"0.25":  256,
		"1":     1024,
		"2.5":   2560,
		" 0.5 ": 512,
	}
	for in, want := range cases {
		if got := parseCPUReserveShares(in); got != want {
			t.Errorf("parseCPUReserveShares(%q) = %d, want %d", in, got, want)
		}
	}
}

func TestValidateResourceSpecs(t *testing.T) {
	if err := validateCPUSpec(""); err != nil {
		t.Error("empty cpu should pass")
	}
	if err := validateCPUSpec("0.5"); err != nil {
		t.Error("0.5 should be valid cpu")
	}
	if err := validateCPUSpec("512mb"); err == nil {
		t.Error("512mb should fail cpu validation")
	}
	if err := validateMemorySpec(""); err != nil {
		t.Error("empty memory should pass")
	}
	if err := validateMemorySpec("512Mi"); err != nil {
		t.Error("512Mi should be valid memory")
	}
	if err := validateMemorySpec("1g"); err != nil {
		t.Error("1g should be valid memory")
	}
	if err := validateMemorySpec("0.5"); err == nil {
		t.Error("0.5 should fail memory validation (parses to <1 byte)")
	}
	if err := validateMemorySpec("lots"); err == nil {
		t.Error("'lots' should fail memory validation")
	}
}
