-- name: UpsertNodeMetrics :exec
INSERT INTO node_metrics (
    node_id, timestamp, cpu_usage, cpu_cores, load_avg_1, load_avg_5, load_avg_15,
    memory_total, memory_used, memory_available, memory_usage_percent,
    storage_total, storage_used, storage_available, storage_usage_percent,
    network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
    network_connections_in, network_connections_out, network_errors_in, network_errors_out,
    uptime, processes, os, kernel, architecture
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
    $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
)
ON CONFLICT (node_id, timestamp) DO UPDATE SET
    cpu_usage = EXCLUDED.cpu_usage,
    cpu_cores = EXCLUDED.cpu_cores,
    load_avg_1 = EXCLUDED.load_avg_1,
    load_avg_5 = EXCLUDED.load_avg_5,
    load_avg_15 = EXCLUDED.load_avg_15,
    memory_total = EXCLUDED.memory_total,
    memory_used = EXCLUDED.memory_used,
    memory_available = EXCLUDED.memory_available,
    memory_usage_percent = EXCLUDED.memory_usage_percent,
    storage_total = EXCLUDED.storage_total,
    storage_used = EXCLUDED.storage_used,
    storage_available = EXCLUDED.storage_available,
    storage_usage_percent = EXCLUDED.storage_usage_percent,
    network_bytes_in = EXCLUDED.network_bytes_in,
    network_bytes_out = EXCLUDED.network_bytes_out,
    network_packets_in = EXCLUDED.network_packets_in,
    network_packets_out = EXCLUDED.network_packets_out,
    network_connections_in = EXCLUDED.network_connections_in,
    network_connections_out = EXCLUDED.network_connections_out,
    network_errors_in = EXCLUDED.network_errors_in,
    network_errors_out = EXCLUDED.network_errors_out,
    uptime = EXCLUDED.uptime,
    processes = EXCLUDED.processes,
    os = EXCLUDED.os,
    kernel = EXCLUDED.kernel,
    architecture = EXCLUDED.architecture;

-- name: UpsertServiceMetrics :exec
INSERT INTO service_metrics (
    service_id, service_name, project_id, timestamp,
    requests_total, requests_success, requests_errors, requests_avg_latency,
    requests_p95_latency, requests_p99_latency, requests_throughput,
    errors_total, errors_rate, performance_response_time, performance_throughput,
    performance_concurrency, performance_saturation, performance_utilization,
    resource_cpu_usage, resource_memory_usage, resource_storage_usage,
    resource_network_usage, resource_score
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
    $16, $17, $18, $19, $20, $21, $22, $23
)
ON CONFLICT (service_id, timestamp) DO UPDATE SET
    requests_total = EXCLUDED.requests_total,
    requests_success = EXCLUDED.requests_success,
    requests_errors = EXCLUDED.requests_errors,
    requests_avg_latency = EXCLUDED.requests_avg_latency,
    requests_p95_latency = EXCLUDED.requests_p95_latency,
    requests_p99_latency = EXCLUDED.requests_p99_latency,
    requests_throughput = EXCLUDED.requests_throughput,
    errors_total = EXCLUDED.errors_total,
    errors_rate = EXCLUDED.errors_rate,
    performance_response_time = EXCLUDED.performance_response_time,
    performance_throughput = EXCLUDED.performance_throughput,
    performance_concurrency = EXCLUDED.performance_concurrency,
    performance_saturation = EXCLUDED.performance_saturation,
    performance_utilization = EXCLUDED.performance_utilization,
    resource_cpu_usage = EXCLUDED.resource_cpu_usage,
    resource_memory_usage = EXCLUDED.resource_memory_usage,
    resource_storage_usage = EXCLUDED.resource_storage_usage,
    resource_network_usage = EXCLUDED.resource_network_usage,
    resource_score = EXCLUDED.resource_score;

-- name: UpsertInstanceMetrics :exec
INSERT INTO instance_metrics (
    service_id, timestamp, instance_id, node_id, status, cpu, memory,
    network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
    network_connections_in, network_connections_out, network_errors_in, network_errors_out,
    start_time, last_seen, health_status, health_last_check, health_check_count, health_failure_count
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
    $16, $17, $18, $19, $20, $21
)
ON CONFLICT (service_id, timestamp, instance_id) DO UPDATE SET
    node_id = EXCLUDED.node_id,
    status = EXCLUDED.status,
    cpu = EXCLUDED.cpu,
    memory = EXCLUDED.memory,
    network_bytes_in = EXCLUDED.network_bytes_in,
    network_bytes_out = EXCLUDED.network_bytes_out,
    network_packets_in = EXCLUDED.network_packets_in,
    network_packets_out = EXCLUDED.network_packets_out,
    network_connections_in = EXCLUDED.network_connections_in,
    network_connections_out = EXCLUDED.network_connections_out,
    network_errors_in = EXCLUDED.network_errors_in,
    network_errors_out = EXCLUDED.network_errors_out,
    start_time = EXCLUDED.start_time,
    last_seen = EXCLUDED.last_seen,
    health_status = EXCLUDED.health_status,
    health_last_check = EXCLUDED.health_last_check,
    health_check_count = EXCLUDED.health_check_count,
    health_failure_count = EXCLUDED.health_failure_count;

-- name: ListNodeMetrics :many
SELECT node_id, timestamp, cpu_usage, cpu_cores, load_avg_1, load_avg_5, load_avg_15,
       memory_total, memory_used, memory_available, memory_usage_percent,
       storage_total, storage_used, storage_available, storage_usage_percent,
       network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
       network_connections_in, network_connections_out, network_errors_in, network_errors_out,
       coalesce(extract(epoch from uptime), 0)::bigint AS uptime_seconds,
       processes, os, kernel, architecture
FROM node_metrics
WHERE node_id = $1 AND timestamp BETWEEN $2 AND $3
ORDER BY timestamp ASC;

-- name: ListServiceMetrics :many
SELECT service_id, service_name, project_id, timestamp,
       requests_total, requests_success, requests_errors, requests_avg_latency,
       requests_p95_latency, requests_p99_latency, requests_throughput,
       errors_total, errors_rate, performance_response_time, performance_throughput,
       performance_concurrency, performance_saturation, performance_utilization,
       resource_cpu_usage, resource_memory_usage, resource_storage_usage,
       resource_network_usage, resource_score
FROM service_metrics
WHERE service_id = $1 AND timestamp BETWEEN $2 AND $3
ORDER BY timestamp ASC;

-- name: ListInstanceMetrics :many
SELECT instance_id, node_id, status, cpu, memory,
       network_bytes_in, network_bytes_out, network_packets_in, network_packets_out,
       network_connections_in, network_connections_out, network_errors_in, network_errors_out,
       start_time, last_seen, health_status, health_last_check, health_check_count, health_failure_count
FROM instance_metrics
WHERE service_id = $1 AND timestamp = $2;

-- name: AggregateNodeMetrics :many
-- Portable bucket bucketing (no TimescaleDB): floor epoch seconds into
-- bucket-sized buckets, then back to timestamptz.
SELECT date_bin($1::interval, timestamp, '2000-01-01'::timestamptz) AS bucket,
       AVG(cpu_usage)::float8 AS avg_cpu,
       AVG(memory_usage_percent)::float8 AS avg_memory,
       AVG(storage_usage_percent)::float8 AS avg_storage
FROM node_metrics
WHERE node_id = $2 AND timestamp BETWEEN $3 AND $4
GROUP BY bucket
ORDER BY bucket ASC;
