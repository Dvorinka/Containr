package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"
)

// EncryptionManager handles data encryption and decryption
type EncryptionManager struct {
	gcm cipher.AEAD
}

// NewEncryptionManager creates a new encryption manager
func NewEncryptionManager(key string) (*EncryptionManager, error) {
	// Convert key to 32 bytes for AES-256
	keyHash := sha256.Sum256([]byte(key))

	block, err := aes.NewCipher(keyHash[:])
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	return &EncryptionManager{gcm: gcm}, nil
}

// Encrypt encrypts data using AES-256 GCM
func (em *EncryptionManager) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	nonce := make([]byte, em.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := em.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts data using AES-256 GCM
func (em *EncryptionManager) Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	nonceSize := em.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext_bytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := em.gcm.Open(nil, nonce, ciphertext_bytes, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// EncryptSensitiveData encrypts sensitive data fields
func (em *EncryptionManager) EncryptSensitiveData(data map[string]interface{}) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	for key, value := range data {
		if em.isSensitiveField(key) {
			strValue, ok := value.(string)
			if ok {
				encrypted, err := em.Encrypt(strValue)
				if err != nil {
					return nil, fmt.Errorf("failed to encrypt field %s: %w", key, err)
				}
				result[key] = encrypted
			} else {
				result[key] = value
			}
		} else {
			result[key] = value
		}
	}

	return result, nil
}

// DecryptSensitiveData decrypts sensitive data fields
func (em *EncryptionManager) DecryptSensitiveData(data map[string]interface{}) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	for key, value := range data {
		if em.isSensitiveField(key) {
			strValue, ok := value.(string)
			if ok {
				decrypted, err := em.Decrypt(strValue)
				if err != nil {
					return nil, fmt.Errorf("failed to decrypt field %s: %w", key, err)
				}
				result[key] = decrypted
			} else {
				result[key] = value
			}
		} else {
			result[key] = value
		}
	}

	return result, nil
}

// isSensitiveField determines if a field contains sensitive data
func (em *EncryptionManager) isSensitiveField(fieldName string) bool {
	sensitiveFields := []string{
		"password", "secret", "token", "key", "api_key", "private_key",
		"database_url", "connection_string", "credit_card", "ssn",
		"social_security", "bank_account", "auth_token", "jwt_secret",
		"encryption_key", "webhook_secret", "oauth_secret", "access_token",
		"refresh_token", "client_secret", "private", "confidential",
	}

	fieldName = strings.ToLower(fieldName)
	for _, sensitive := range sensitiveFields {
		if strings.Contains(fieldName, sensitive) {
			return true
		}
	}
	return false
}

// DataRetentionManager handles data retention policies
type DataRetentionManager struct {
	encryptionManager *EncryptionManager
}

// NewDataRetentionManager creates a new data retention manager
func NewDataRetentionManager(encryptionManager *EncryptionManager) *DataRetentionManager {
	return &DataRetentionManager{
		encryptionManager: encryptionManager,
	}
}

// RetentionPolicy defines data retention rules
type RetentionPolicy struct {
	ID              string        `json:"id"`
	Name            string        `json:"name"`
	DataType        string        `json:"data_type"`
	RetentionPeriod time.Duration `json:"retention_period"`
	Action          string        `json:"action"` // "delete", "anonymize", "archive"
	Enabled         bool          `json:"enabled"`
	CreatedAt       time.Time     `json:"created_at"`
}

// AnonymizedData represents anonymized user data
type AnonymizedData struct {
	OriginalID   string    `json:"original_id"`
	AnonymizedID string    `json:"anonymized_id"`
	DataType     string    `json:"data_type"`
	AnonymizedAt time.Time `json:"anonymized_at"`
	RetainedData string    `json:"retained_data"` // Encrypted non-sensitive data
}

// AnonymizeUserData anonymizes user data for GDPR compliance
func (drm *DataRetentionManager) AnonymizeUserData(userData map[string]interface{}) (*AnonymizedData, error) {
	anonymizedID := fmt.Sprintf("anon_%d", time.Now().UnixNano())

	// Separate sensitive and non-sensitive data
	sensitiveData := make(map[string]interface{})
	nonSensitiveData := make(map[string]interface{})

	for key, value := range userData {
		if drm.isPersonalData(key) {
			sensitiveData[key] = value
		} else {
			nonSensitiveData[key] = value
		}
	}

	// Encrypt non-sensitive data for retention
	nonSensitiveJSON, _ := json.Marshal(nonSensitiveData)
	encryptedRetainedData, err := drm.encryptionManager.Encrypt(string(nonSensitiveJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt retained data: %w", err)
	}

	// Create anonymized record
	anonymized := &AnonymizedData{
		OriginalID:   fmt.Sprintf("%v", userData["id"]),
		AnonymizedID: anonymizedID,
		DataType:     "user",
		AnonymizedAt: time.Now(),
		RetainedData: encryptedRetainedData,
	}

	return anonymized, nil
}

// isPersonalData determines if data is personal information under GDPR
func (drm *DataRetentionManager) isPersonalData(fieldName string) bool {
	personalDataFields := []string{
		"name", "email", "phone", "address", "birthdate", "gender",
		"ip_address", "user_agent", "location", "biometric", "health",
		"political", "religious", "sexual", "criminal", "financial",
		"education", "employment", "family", "social", "behavioral",
		"identifier", "cookie", "tracking", "profile", "preferences",
	}

	fieldName = strings.ToLower(fieldName)
	for _, personal := range personalDataFields {
		if strings.Contains(fieldName, personal) {
			return true
		}
	}
	return false
}

// ApplyRetentionPolicy applies retention policies to data
func (drm *DataRetentionManager) ApplyRetentionPolicy(dataType string, dataTimestamp time.Time, policy RetentionPolicy) string {
	if !policy.Enabled {
		return "retain"
	}

	expiryDate := dataTimestamp.Add(policy.RetentionPeriod)
	if time.Now().Before(expiryDate) {
		return "retain"
	}

	return policy.Action
}

// GenerateDataSubjectReport generates a report of all data held about a user
func (drm *DataRetentionManager) GenerateDataSubjectReport(userID string, userData map[string]interface{}) (map[string]interface{}, error) {
	report := map[string]interface{}{
		"user_id":            userID,
		"report_generated":   time.Now(),
		"data_categories":    drm.categorizeUserData(userData),
		"retention_policies": drm.getApplicablePolicies(userData),
		"data_sources":       []string{"database", "logs", "analytics"},
	}

	return report, nil
}

// categorizeUserData categorizes user data by type
func (drm *DataRetentionManager) categorizeUserData(userData map[string]interface{}) map[string][]string {
	categories := map[string][]string{
		"identity":    {},
		"contact":     {},
		"technical":   {},
		"behavioral":  {},
		"preferences": {},
	}

	for key := range userData {
		lowerKey := strings.ToLower(key)

		switch {
		case strings.Contains(lowerKey, "name") || strings.Contains(lowerKey, "id"):
			categories["identity"] = append(categories["identity"], key)
		case strings.Contains(lowerKey, "email") || strings.Contains(lowerKey, "phone"):
			categories["contact"] = append(categories["contact"], key)
		case strings.Contains(lowerKey, "ip") || strings.Contains(lowerKey, "agent"):
			categories["technical"] = append(categories["technical"], key)
		case strings.Contains(lowerKey, "activity") || strings.Contains(lowerKey, "behavior"):
			categories["behavioral"] = append(categories["behavioral"], key)
		case strings.Contains(lowerKey, "preference") || strings.Contains(lowerKey, "setting"):
			categories["preferences"] = append(categories["preferences"], key)
		}
	}

	return categories
}

// getApplicablePolicies returns applicable retention policies
func (drm *DataRetentionManager) getApplicablePolicies(userData map[string]interface{}) []string {
	policies := []string{
		"user_data_2_years",
		"analytics_data_6_months",
		"logs_data_90_days",
		"deleted_users_30_days",
	}

	return policies
}

// AuditLogger handles security audit logging
type AuditLogger struct {
	encryptionManager *EncryptionManager
}

// NewAuditLogger creates a new audit logger
func NewAuditLogger(encryptionManager *EncryptionManager) *AuditLogger {
	return &AuditLogger{
		encryptionManager: encryptionManager,
	}
}

// AuditEvent represents a security audit event
type AuditEvent struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"timestamp"`
	UserID    string                 `json:"user_id,omitempty"`
	Action    string                 `json:"action"`
	Resource  string                 `json:"resource"`
	Details   map[string]interface{} `json:"details"`
	IPAddress string                 `json:"ip_address"`
	UserAgent string                 `json:"user_agent"`
	Success   bool                   `json:"success"`
}

// LogAuditEvent logs a security audit event
func (al *AuditLogger) LogAuditEvent(event AuditEvent) error {
	event.ID = fmt.Sprintf("audit_%d", time.Now().UnixNano())
	event.Timestamp = time.Now()

	// Encrypt sensitive details
	if event.Details != nil {
		encryptedDetails, err := al.encryptionManager.EncryptSensitiveData(event.Details)
		if err != nil {
			return fmt.Errorf("failed to encrypt audit details: %w", err)
		}
		event.Details = encryptedDetails
	}

	// In a real implementation, this would be stored in a secure audit database
	// For now, we'll just return success
	return nil
}

// LogSecurityEvent logs security-related events
func (al *AuditLogger) LogSecurityEvent(userID, action, resource string, details map[string]interface{}, ipAddress, userAgent string, success bool) error {
	event := AuditEvent{
		UserID:    userID,
		Action:    action,
		Resource:  resource,
		Details:   details,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Success:   success,
	}

	return al.LogAuditEvent(event)
}
