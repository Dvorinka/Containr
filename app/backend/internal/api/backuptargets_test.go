package api

import (
	"archive/tar"
	"bytes"
	"io"
	"testing"
)

func TestNormalizeBackupTargetRequest(t *testing.T) {
	req := backupTargetRequest{
		Name:     " garage ",
		Endpoint: "https://garage.local:3900/",
		Bucket:   " backups ",
		Prefix:   " /prod/dbs/ ",
	}
	if err := normalizeBackupTargetRequest(&req); err != nil {
		t.Fatalf("normalize failed: %v", err)
	}
	if req.Endpoint != "garage.local:3900" {
		t.Fatalf("endpoint not normalized: %q", req.Endpoint)
	}
	if req.Bucket != "backups" || req.Prefix != "prod/dbs" {
		t.Fatalf("bucket/prefix not trimmed: %q %q", req.Bucket, req.Prefix)
	}

	for i, bad := range []backupTargetRequest{
		{Endpoint: "e", Bucket: "b"}, // no name
		{Name: "n", Bucket: "b"},     // no endpoint
		{Name: "n", Endpoint: "e"},   // no bucket
	} {
		if err := normalizeBackupTargetRequest(&bad); err == nil {
			t.Fatalf("case %d: expected error", i)
		}
	}
}

func TestArchiveReaderUnwrapsTar(t *testing.T) {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	payload := []byte("backup-bytes")
	if err := tw.WriteHeader(&tar.Header{Name: "b.tar.gz", Mode: 0o644, Size: int64(len(payload))}); err != nil {
		t.Fatal(err)
	}
	if _, err := tw.Write(payload); err != nil {
		t.Fatal(err)
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}

	r := &archiveReader{tar: io.NopCloser(&buf)}
	got, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatalf("payload mismatch: %q", got)
	}
}
