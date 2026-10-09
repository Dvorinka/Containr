package api

import (
	"archive/tar"
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"containr/internal/database/sqlcdb"
	"containr/internal/docker"
	"containr/internal/secrets"

	"github.com/docker/docker/api/types/mount"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// BackupTarget is an S3-compatible archive destination. Secret keys are
// stored encrypted and never serialized — has_credentials signals presence.
type BackupTarget struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Endpoint       string    `json:"endpoint"`
	Bucket         string    `json:"bucket"`
	Region         string    `json:"region,omitempty"`
	Prefix         string    `json:"prefix,omitempty"`
	HasCredentials bool      `json:"has_credentials"`
	UseTLS         bool      `json:"use_tls"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	accessKey string `json:"-"`
	secretKey string `json:"-"`
}

type backupTargetRequest struct {
	Name      string `json:"name"`
	Endpoint  string `json:"endpoint" binding:"required"`
	Bucket    string `json:"bucket" binding:"required"`
	Region    string `json:"region"`
	Prefix    string `json:"prefix"`
	AccessKey string `json:"access_key"`
	SecretKey string `json:"secret_key"`
	UseTLS    *bool  `json:"use_tls"`
}

func mapBackupTargetRow(row sqlcdb.BackupTarget) BackupTarget {
	return BackupTarget{
		ID:             row.ID,
		Name:           row.Name,
		Endpoint:       row.Endpoint,
		Bucket:         row.Bucket,
		Region:         row.Region,
		Prefix:         row.Prefix,
		HasCredentials: row.SecretKey != "",
		UseTLS:         row.UseTls,
		CreatedAt:      databaseNullTime(row.CreatedAt),
		UpdatedAt:      databaseNullTime(row.UpdatedAt),
		accessKey:      secrets.Decrypt(row.AccessKey),
		secretKey:      secrets.Decrypt(row.SecretKey),
	}
}

// s3Client builds a client for the target. Endpoint is a bare host[:port] —
// scheme comes from use_tls, matching MinIO/Garage/AWS conventions.
func (t BackupTarget) s3Client() (*minio.Client, error) {
	opts := &minio.Options{Secure: t.UseTLS, Region: t.Region}
	if t.accessKey != "" || t.secretKey != "" {
		opts.Creds = credentials.NewStaticV4(t.accessKey, t.secretKey, "")
	} else {
		opts.Creds = credentials.NewIAM("")
	}
	return minio.New(t.Endpoint, opts)
}

func normalizeBackupTargetRequest(req *backupTargetRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	req.Endpoint = strings.TrimSpace(req.Endpoint)
	req.Endpoint = strings.TrimPrefix(strings.TrimPrefix(req.Endpoint, "https://"), "http://")
	req.Endpoint = strings.TrimSuffix(req.Endpoint, "/")
	req.Bucket = strings.TrimSpace(req.Bucket)
	req.Prefix = strings.Trim(strings.TrimSpace(req.Prefix), "/")
	if req.Name == "" {
		return errors.New("name is required")
	}
	if req.Endpoint == "" || req.Bucket == "" {
		return errors.New("endpoint and bucket are required")
	}
	return nil
}

// probeBackupTarget verifies credentials and bucket access.
func probeBackupTarget(ctx context.Context, t BackupTarget) (time.Duration, error) {
	client, err := t.s3Client()
	if err != nil {
		return 0, err
	}
	start := time.Now()
	exists, err := client.BucketExists(ctx, t.Bucket)
	if err != nil {
		return 0, err
	}
	if !exists {
		return 0, fmt.Errorf("bucket %q not found or not accessible", t.Bucket)
	}
	return time.Since(start), nil
}

func (h *DatabaseHandler) ListBackupTargets(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	rows, err := h.queries.ListBackupTargetsByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list backup targets"})
		return
	}
	targets := make([]BackupTarget, 0, len(rows))
	for _, row := range rows {
		t := mapBackupTargetRow(row)
		t.accessKey, t.secretKey = "", ""
		targets = append(targets, t)
	}
	c.JSON(http.StatusOK, gin.H{"backup_targets": targets})
}

func (h *DatabaseHandler) CreateBackupTarget(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	var req backupTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}
	if err := normalizeBackupTargetRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}

	useTLS := true
	if req.UseTLS != nil {
		useTLS = *req.UseTLS
	}
	target := BackupTarget{
		ID:        "bt_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:12],
		Name:      req.Name,
		Endpoint:  req.Endpoint,
		Bucket:    req.Bucket,
		Region:    req.Region,
		Prefix:    req.Prefix,
		UseTLS:    useTLS,
		accessKey: req.AccessKey,
		secretKey: req.SecretKey,
	}

	probeCtx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	if _, err := probeBackupTarget(probeCtx, target); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Connection check failed: %v", err), "code": "DEPENDENCY_UNAVAILABLE"})
		return
	}

	enc := func(v string) string {
		if v == "" {
			return ""
		}
		return secrets.Encrypt(v)
	}
	now := sql.NullTime{Time: time.Now(), Valid: true}
	if err := h.queries.CreateBackupTarget(c.Request.Context(), sqlcdb.CreateBackupTargetParams{
		ID:        target.ID,
		UserID:    userID,
		Name:      target.Name,
		Endpoint:  target.Endpoint,
		Bucket:    target.Bucket,
		Region:    target.Region,
		Prefix:    target.Prefix,
		AccessKey: enc(req.AccessKey),
		SecretKey: enc(req.SecretKey),
		UseTls:    useTLS,
		CreatedAt: now,
		UpdatedAt: now,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create backup target"})
		return
	}
	LogAudit(userID, "backup_target", target.ID, "create", map[string]interface{}{"name": req.Name, "endpoint": req.Endpoint, "bucket": req.Bucket})
	target.accessKey, target.secretKey = "", ""
	target.HasCredentials = req.SecretKey != ""
	target.CreatedAt, target.UpdatedAt = now.Time, now.Time
	c.JSON(http.StatusCreated, gin.H{"backup_target": target})
}

func (h *DatabaseHandler) UpdateBackupTarget(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	targetID := c.Param("id")
	row, err := h.queries.GetBackupTargetByIDAndUser(c.Request.Context(), sqlcdb.GetBackupTargetByIDAndUserParams{ID: targetID, UserID: userID})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup target not found", "code": "NOT_FOUND"})
		return
	}
	var req backupTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}
	if err := normalizeBackupTargetRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "VALIDATION"})
		return
	}
	useTLS := row.UseTls
	if req.UseTLS != nil {
		useTLS = *req.UseTLS
	}
	// Empty credentials keep the stored pair.
	accessKey := row.AccessKey
	secretKey := row.SecretKey
	if req.AccessKey != "" || req.SecretKey != "" {
		accessKey = secrets.Encrypt(req.AccessKey)
		secretKey = secrets.Encrypt(req.SecretKey)
	}

	target := BackupTarget{
		Endpoint:  req.Endpoint,
		Bucket:    req.Bucket,
		Region:    req.Region,
		Prefix:    req.Prefix,
		UseTLS:    useTLS,
		accessKey: secrets.Decrypt(accessKey),
		secretKey: secrets.Decrypt(secretKey),
	}
	probeCtx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	if _, err := probeBackupTarget(probeCtx, target); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Connection check failed: %v", err), "code": "DEPENDENCY_UNAVAILABLE"})
		return
	}

	if err := h.queries.UpdateBackupTargetByIDAndUser(c.Request.Context(), sqlcdb.UpdateBackupTargetByIDAndUserParams{
		Name:      req.Name,
		Endpoint:  req.Endpoint,
		Bucket:    req.Bucket,
		Region:    req.Region,
		Prefix:    req.Prefix,
		AccessKey: accessKey,
		SecretKey: secretKey,
		UseTls:    useTLS,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
		ID:        targetID,
		UserID:    userID,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update backup target"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Backup target updated"})
}

func (h *DatabaseHandler) DeleteBackupTarget(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	targetID := c.Param("id")
	count, err := h.queries.CountDatabasesUsingBackupTarget(c.Request.Context(), sql.NullString{String: targetID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check target usage"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("%d database(s) still back up to this target", count), "code": "CONFLICT"})
		return
	}
	if err := h.queries.DeleteBackupTargetByIDAndUser(c.Request.Context(), sqlcdb.DeleteBackupTargetByIDAndUserParams{ID: targetID, UserID: userID}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete backup target"})
		return
	}
	LogAudit(userID, "backup_target", targetID, "delete", nil)
	c.JSON(http.StatusOK, gin.H{"message": "Backup target deleted"})
}

func (h *DatabaseHandler) TestBackupTarget(c *gin.Context) {
	userID, ok := requireAuthenticatedUserID(c)
	if !ok {
		return
	}
	targetID := c.Param("id")
	row, err := h.queries.GetBackupTargetByIDAndUser(c.Request.Context(), sqlcdb.GetBackupTargetByIDAndUserParams{ID: targetID, UserID: userID})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup target not found", "code": "NOT_FOUND"})
		return
	}
	target := mapBackupTargetRow(row)
	probeCtx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	latency, probeErr := probeBackupTarget(probeCtx, target)
	if probeErr != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": probeErr.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "latency_ms": latency.Milliseconds()})
}

// uploadBackupToTarget copies the archive out of the backup volume and puts
// it in the configured S3 target. Returns the object key, or "" when no
// target is configured.
func (h *DatabaseHandler) uploadBackupToTarget(ctx context.Context, db sqlcdb.DatabaseService, archivePath, backupID string) (string, error) {
	if !db.BackupTargetID.Valid || db.BackupTargetID.String == "" {
		return "", nil
	}
	targetRow, err := h.queries.GetBackupTargetByID(ctx, db.BackupTargetID.String)
	if err != nil {
		return "", fmt.Errorf("backup target lookup failed: %w", err)
	}
	target := mapBackupTargetRow(targetRow)

	archive, err := h.readBackupArchive(ctx, archivePath)
	if err != nil {
		return "", fmt.Errorf("read archive: %w", err)
	}
	defer func() {
		_, _ = io.Copy(io.Discard, archive)
		_ = archive.Close()
	}()

	client, err := target.s3Client()
	if err != nil {
		return "", err
	}
	key := target.Prefix
	if key != "" {
		key += "/"
	}
	key += "databases/" + db.ID + "/" + sanitizeBackupArchivePath(archivePath)
	_, err = client.PutObject(ctx, target.Bucket, key, archive, -1, minio.PutObjectOptions{ContentType: "application/gzip"})
	if err != nil {
		return "", fmt.Errorf("s3 upload: %w", err)
	}
	_ = h.queries.SetDatabaseBackupRemoteKeyByID(ctx, sqlcdb.SetDatabaseBackupRemoteKeyByIDParams{
		RemoteKey: sql.NullString{String: key, Valid: true},
		ID:        backupID,
	})
	return key, nil
}

// readBackupArchive streams an archive out of the shared backup volume via a
// stopped holder container — the volume has no direct host path.
func (h *DatabaseHandler) readBackupArchive(ctx context.Context, archivePath string) (io.ReadCloser, error) {
	holderID, err := h.createBackupVolumeHolder(ctx)
	if err != nil {
		return nil, err
	}
	reader, err := h.dockerClient.CopyFromContainer(ctx, holderID, "/backup/"+sanitizeBackupArchivePath(archivePath))
	if err != nil {
		_ = h.dockerClient.RemoveContainer(context.Background(), holderID, true)
		return nil, err
	}
	// The holder must outlive the stream — deleting the source container while
	// dockerd serves the archive stalls the read without an error.
	return &archiveReader{tar: reader, cleanup: func() {
		_ = h.dockerClient.RemoveContainer(context.Background(), holderID, true)
	}}, nil
}

// downloadBackupToVolume fetches a remote archive back into the backup volume
// so the normal restore path can run unchanged.
func (h *DatabaseHandler) downloadBackupToVolume(ctx context.Context, db sqlcdb.DatabaseService, remoteKey, archivePath string) error {
	targetRow, err := h.queries.GetBackupTargetByID(ctx, db.BackupTargetID.String)
	if err != nil {
		return fmt.Errorf("backup target lookup failed: %w", err)
	}
	target := mapBackupTargetRow(targetRow)
	client, err := target.s3Client()
	if err != nil {
		return err
	}
	obj, err := client.GetObject(ctx, target.Bucket, remoteKey, minio.GetObjectOptions{})
	if err != nil {
		return err
	}
	defer obj.Close()

	archive := sanitizeBackupArchivePath(archivePath)
	if archive == "" {
		return errors.New("backup path is required")
	}

	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	data, err := io.ReadAll(obj)
	if err != nil {
		return fmt.Errorf("s3 download: %w", err)
	}
	if err := tw.WriteHeader(&tar.Header{Name: archive, Mode: 0o644, Size: int64(len(data))}); err != nil {
		return err
	}
	if _, err := tw.Write(data); err != nil {
		return err
	}
	if err := tw.Close(); err != nil {
		return err
	}

	holderID, err := h.createBackupVolumeHolder(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = h.dockerClient.RemoveContainer(context.Background(), holderID, true) }()
	return h.dockerClient.CopyToContainer(ctx, holderID, "/backup", &buf)
}

// backupArchiveExists reports whether the archive is still in the local
// backup volume — a copy attempt on a holder container is the cheapest check.
func (h *DatabaseHandler) backupArchiveExists(ctx context.Context, archivePath string) (bool, error) {
	holderID, err := h.createBackupVolumeHolder(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = h.dockerClient.RemoveContainer(context.Background(), holderID, true) }()
	reader, err := h.dockerClient.CopyFromContainer(ctx, holderID, "/backup/"+sanitizeBackupArchivePath(archivePath))
	if err != nil {
		return false, nil
	}
	_ = reader.Close()
	return true, nil
}

// createBackupVolumeHolder creates a container mounting the backup volume so
// archives can be copied in and out. It must be started — docker cp/archive
// only resolves volume mounts on containers that have run at least once.
func (h *DatabaseHandler) createBackupVolumeHolder(ctx context.Context) (string, error) {
	if err := h.ensureImage(ctx, managedDatabaseBackupImage); err != nil {
		return "", err
	}
	holderID, err := h.dockerClient.CreateContainer(ctx, docker.ContainerConfig{
		Image:         managedDatabaseBackupImage,
		Cmd:           []string{"true"},
		RestartPolicy: "no",
		Mounts:        []mount.Mount{{Type: mount.TypeVolume, Source: managedDatabaseBackupVolume, Target: "/backup"}},
		Labels:        map[string]string{"containr.managed": "true", "containr.utility": "backup-io"},
		NetworkMode:   "none",
	})
	if err != nil {
		return "", err
	}
	if err := h.dockerClient.StartContainer(ctx, holderID); err != nil {
		_ = h.dockerClient.RemoveContainer(context.Background(), holderID, true)
		return "", fmt.Errorf("failed to start backup holder: %w", err)
	}
	return holderID, nil
}

// archiveReader unwraps the tar stream CopyFromContainer returns.
type archiveReader struct {
	tar     io.ReadCloser
	tr      *tar.Reader
	err     error
	cleanup func()
}

func (r *archiveReader) Read(p []byte) (int, error) {
	if r.err != nil {
		return 0, r.err
	}
	if r.tr == nil {
		r.tr = tar.NewReader(r.tar)
		// Skip to the first regular file entry.
		for {
			hdr, err := r.tr.Next()
			if err != nil {
				r.err = err
				return 0, err
			}
			if hdr.Typeflag == tar.TypeReg {
				break
			}
		}
	}
	n, err := r.tr.Read(p)
	if err != nil {
		r.err = err
	}
	return n, err
}

func (r *archiveReader) Close() error {
	err := r.tar.Close()
	if r.cleanup != nil {
		r.cleanup()
		r.cleanup = nil
	}
	return err
}
