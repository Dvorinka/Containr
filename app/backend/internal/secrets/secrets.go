package secrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"sync"
)

// Prefix marks AES-GCM-encrypted values in environment_variables.value.
// Plaintext rows keep working — Decrypt returns them unchanged, so the
// rollout is transparent encrypt-on-write / decrypt-on-read.
const Prefix = "enc:v1:"

var (
	keyOnce sync.Once
	key     []byte
	enabled bool
)

// Configure derives the AES-256 key. SECRETS_KEY wins; JWT_SECRET is the
// fallback so existing installs need no new config. With neither, encrypt
// degrades to plaintext with a single warning.
func Configure(secretsKey, jwtSecret string) {
	keyOnce.Do(func() {
		seed := secretsKey
		if seed == "" {
			seed = jwtSecret
		}
		if seed == "" {
			log.Printf("secrets: no SECRETS_KEY or JWT_SECRET — secret variables stay plaintext")
			return
		}
		sum := sha256.Sum256([]byte("containr-env-secrets:" + seed))
		key = sum[:]
		enabled = true
	})
}

func IsEncrypted(value string) bool {
	return strings.HasPrefix(value, Prefix)
}

// Encrypt returns value unchanged if disabled or already encrypted.
func Encrypt(value string) string {
	if !enabled || IsEncrypted(value) {
		return value
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return value
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return value
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return value
	}
	sealed := gcm.Seal(nonce, nonce, []byte(value), nil)
	return Prefix + base64.StdEncoding.EncodeToString(sealed)
}

// Decrypt returns plaintext for enc:v1 values, the input otherwise.
// Corrupt ciphertext fails soft to the stored value rather than erroring
// the deploy path — an unreadable secret is no worse than a plaintext one.
func Decrypt(value string) string {
	if !enabled || !IsEncrypted(value) {
		return value
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, Prefix))
	if err != nil {
		return value
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return value
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return value
	}
	if len(raw) < gcm.NonceSize() {
		return value
	}
	plain, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], nil)
	if err != nil {
		log.Printf("secrets: decrypt failed (%v) — check SECRETS_KEY/JWT_SECRET rotation", fmt.Errorf("%w", err))
		return value
	}
	return string(plain)
}
