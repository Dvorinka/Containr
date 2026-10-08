package secrets

import (
	"sync"
	"testing"
)

// resetForTest restores the package state so Configure can be re-run.
func resetForTest() {
	keyOnce = sync.Once{}
	key = nil
	enabled = false
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	resetForTest()
	Configure("test-secrets-key", "")

	enc := Encrypt("super-secret-value")
	if !IsEncrypted(enc) {
		t.Fatalf("expected encrypted prefix, got %q", enc)
	}
	if enc == "super-secret-value" {
		t.Fatal("value stored as plaintext")
	}
	if got := Decrypt(enc); got != "super-secret-value" {
		t.Fatalf("decrypt = %q", got)
	}
}

func TestPlaintextPassThrough(t *testing.T) {
	resetForTest()
	Configure("test-secrets-key", "")
	if got := Decrypt("legacy-plaintext"); got != "legacy-plaintext" {
		t.Fatalf("legacy plaintext changed: %q", got)
	}
}

func TestEncryptIsIdempotent(t *testing.T) {
	resetForTest()
	Configure("test-secrets-key", "")
	enc := Encrypt("v")
	if got := Encrypt(enc); got != enc {
		t.Fatal("double-encrypt changed the value")
	}
}

func TestDecryptFailsSoftOnCorruption(t *testing.T) {
	resetForTest()
	Configure("test-secrets-key", "")
	corrupt := Prefix + "not-valid-base64!!!"
	if got := Decrypt(corrupt); got != corrupt {
		t.Fatal("corrupt ciphertext should pass through unchanged")
	}
}

func TestDisabledWithoutKey(t *testing.T) {
	resetForTest()
	Configure("", "")
	if got := Encrypt("v"); got != "v" {
		t.Fatal("encrypt should pass through when no key configured")
	}
}
