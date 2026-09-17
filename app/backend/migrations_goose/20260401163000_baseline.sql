-- +goose Up
-- Consolidated baseline schema for Containr.
-- Replaces the legacy filename-tracked migrations/ directory. Idempotent by
-- construction so it is safe on databases that partially applied legacy files.
--
-- PostgreSQL database dump
--


-- Dumped from database version 15.19
-- Dumped by pg_dump version 15.19

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: cleanup_old_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.cleanup_old_metrics() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM database_metrics 
    WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$;
-- +goose StatementEnd


--
-- Name: complete_backup(character varying, boolean); Type: FUNCTION; Schema: public; Owner: -
--

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.complete_backup(backup_id_param character varying, success_param boolean) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    db_id VARCHAR(255);
BEGIN
    -- Get database_id from backup
    SELECT database_id INTO db_id FROM database_backups WHERE id = backup_id_param;
    
    IF db_id IS NOT NULL THEN
        -- Update backup completion time if successful
        IF success_param THEN
            UPDATE database_backups 
            SET status = 'completed', completed_at = NOW()
            WHERE id = backup_id_param;
            
            -- Update last_backup_time in settings
            UPDATE database_settings 
            SET last_backup_time = NOW()
            WHERE database_id = db_id;
            
            -- Schedule next backup
            PERFORM schedule_next_backup(db_id);
        ELSE
            UPDATE database_backups 
            SET status = 'failed'
            WHERE id = backup_id_param;
        END IF;
    END IF;
END;
$$;
-- +goose StatementEnd


--
-- Name: get_project_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.get_project_stats(project_uuid uuid) RETURNS TABLE(service_count bigint, deployment_count bigint, running_services bigint, last_deployment timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT s.id),
        COUNT(DISTINCT d.id),
        COUNT(DISTINCT CASE WHEN s.status = 'running' THEN s.id END),
        MAX(d.created_at)
    FROM services s
    LEFT JOIN deployments d ON s.id = d.service_id
    WHERE s.project_id = project_uuid;
END;
$$;
-- +goose StatementEnd


--
-- Name: FUNCTION get_project_stats(project_uuid uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_project_stats(project_uuid uuid) IS 'Returns deployment and service summary for a single project';


--
-- Name: schedule_next_backup(character varying); Type: FUNCTION; Schema: public; Owner: -
--

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.schedule_next_backup(database_id_param character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE database_settings 
    SET next_backup_time = NOW() + INTERVAL '24 hours'
    WHERE database_id = database_id_param;
END;
$$;
-- +goose StatementEnd


--
-- Name: update_preview_environments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.update_preview_environments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
-- +goose StatementEnd


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
-- +goose StatementEnd


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.agent_commands (
    id character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    node_agent_id character varying(255) NOT NULL,
    container_id character varying(255),
    payload jsonb,
    status character varying(50) DEFAULT 'pending'::character varying,
    result text,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: TABLE agent_commands; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.agent_commands IS 'Commands sent to node agents for execution';


--
-- Name: agent_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.agent_heartbeats (
    id character varying(255) NOT NULL,
    node_agent_id character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(50) DEFAULT 'unknown'::character varying NOT NULL,
    resources jsonb DEFAULT '{}'::jsonb NOT NULL,
    container_count integer DEFAULT 0 NOT NULL,
    system_load jsonb DEFAULT '{}'::jsonb NOT NULL,
    uptime bigint DEFAULT 0 NOT NULL,
    version character varying(50) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alert_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.alert_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid NOT NULL,
    metric_type character varying(50) NOT NULL,
    metric_field character varying(100) NOT NULL,
    current_value numeric(15,4) NOT NULL,
    threshold numeric(15,4) NOT NULL,
    severity character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'firing'::character varying,
    started_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    duration interval,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.alert_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    metric_type character varying(50) NOT NULL,
    metric_field character varying(100) NOT NULL,
    condition character varying(20) NOT NULL,
    threshold numeric(15,4) NOT NULL,
    duration interval DEFAULT '00:05:00'::interval,
    severity character varying(20) DEFAULT 'warning'::character varying,
    enabled boolean DEFAULT true,
    filters jsonb DEFAULT '{}'::jsonb,
    notification_channels jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: anonymized_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.anonymized_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_id uuid NOT NULL,
    anonymized_id character varying(255) NOT NULL,
    data_type character varying(100) NOT NULL,
    anonymized_at timestamp with time zone DEFAULT now() NOT NULL,
    retained_data text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE anonymized_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.anonymized_data IS 'Anonymized user data for privacy compliance';


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    allowed_service_ids text DEFAULT '[]'::text NOT NULL,
    enabled integer DEFAULT 1 NOT NULL,
    rpm_limit integer DEFAULT 60,
    monthly_quota integer DEFAULT 1000,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_used_at timestamp without time zone
);


--
-- Name: api_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.api_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    upstream_url text NOT NULL,
    route_prefix text NOT NULL,
    health_path text DEFAULT '/health'::text NOT NULL,
    upstream_auth_header text,
    upstream_auth_value text,
    internal_token text,
    enabled integer DEFAULT 1 NOT NULL,
    rpm_limit integer,
    monthly_quota integer,
    request_timeout_ms integer DEFAULT 8000,
    last_validation_at timestamp without time zone,
    last_validation_status text,
    last_validation_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    action character varying(100) NOT NULL,
    resource character varying(100) NOT NULL,
    resource_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    success boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_logs IS 'Security audit trail for all sensitive operations';


--
-- Name: builds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.builds (
    id character varying(255) NOT NULL,
    project_id character varying(255),
    service_id character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    image_name character varying(500) DEFAULT ''::character varying NOT NULL,
    image_tag character varying(200) DEFAULT ''::character varying NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    error text,
    log text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT builds_progress_range CHECK (((progress >= 0) AND (progress <= 100)))
);


--
-- Name: cluster_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.cluster_agents (
    cluster_id character varying(255) NOT NULL,
    agent_id character varying(255) NOT NULL,
    added_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE cluster_agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cluster_agents IS 'Many-to-many relationship between clusters and agents';


--
-- Name: compliance_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.compliance_controls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    framework_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    requirement text,
    test_procedure text,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    last_assessed timestamp with time zone,
    evidence text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_controls_status_check CHECK (((status)::text = ANY ((ARRAY['compliant'::character varying, 'non_compliant'::character varying, 'not_applicable'::character varying, 'pending'::character varying])::text[])))
);


--
-- Name: TABLE compliance_controls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compliance_controls IS 'Individual controls within compliance frameworks';


--
-- Name: compliance_frameworks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.compliance_frameworks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    version character varying(20) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE compliance_frameworks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compliance_frameworks IS 'Compliance frameworks like GDPR, SOC2, etc.';


--
-- Name: compliance_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.compliance_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    framework_id uuid NOT NULL,
    assessment_date timestamp with time zone DEFAULT now() NOT NULL,
    assessor character varying(255),
    overall_status character varying(50) NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_reports_overall_status_check CHECK (((overall_status)::text = ANY ((ARRAY['compliant'::character varying, 'partially_compliant'::character varying, 'non_compliant'::character varying, 'in_progress'::character varying])::text[]))),
    CONSTRAINT compliance_reports_score_check CHECK (((score >= 0) AND (score <= 100)))
);


--
-- Name: TABLE compliance_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compliance_reports IS 'Compliance assessment reports';


--
-- Name: compliance_risks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.compliance_risks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    control_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    impact character varying(20) NOT NULL,
    likelihood character varying(20) NOT NULL,
    mitigation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_risks_impact_check CHECK (((impact)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT compliance_risks_likelihood_check CHECK (((likelihood)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[])))
);


--
-- Name: TABLE compliance_risks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.compliance_risks IS 'Risk assessments for compliance gaps';


--
-- Name: container_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.container_instances (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    image character varying(255) NOT NULL,
    project_id character varying(255) NOT NULL,
    service_id character varying(255) NOT NULL,
    node_agent_id character varying(255) NOT NULL,
    status jsonb,
    resources jsonb,
    ports jsonb,
    environment jsonb,
    volumes jsonb,
    networks jsonb,
    restart_policy jsonb,
    health_check jsonb,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE container_instances; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.container_instances IS 'Container instances running on node agents';


--
-- Name: container_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.container_metrics (
    id integer NOT NULL,
    container_id character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    cpu_usage numeric(5,2),
    cpu_usage_percent numeric(5,2),
    memory_usage bigint,
    memory_usage_percent numeric(5,2),
    memory_limit bigint,
    network_rx_bytes bigint,
    network_tx_bytes bigint,
    network_rx_packets bigint,
    network_tx_packets bigint,
    block_read_bytes bigint,
    block_write_bytes bigint,
    pids_current integer,
    pids_limit integer
);


--
-- Name: TABLE container_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.container_metrics IS 'Metrics collected from running containers';


--
-- Name: container_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.container_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: container_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.container_metrics_id_seq OWNED BY public.container_metrics.id;


--
-- Name: cron_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.cron_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cron_job_id uuid NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    output text,
    error text
);


--
-- Name: cron_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.cron_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    service_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    schedule character varying(100) NOT NULL,
    command text NOT NULL,
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    enabled boolean DEFAULT true,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    last_status character varying(50),
    last_output text,
    retention integer DEFAULT 30,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: data_retention_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    data_type character varying(100) NOT NULL,
    retention_period interval NOT NULL,
    action character varying(50) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT data_retention_policies_action_check CHECK (((action)::text = ANY ((ARRAY['delete'::character varying, 'anonymize'::character varying, 'archive'::character varying])::text[])))
);


--
-- Name: TABLE data_retention_policies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.data_retention_policies IS 'Data retention and deletion policies';


--
-- Name: database_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.database_backups (
    id character varying(255) NOT NULL,
    database_id character varying(255) NOT NULL,
    size character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'in_progress'::character varying NOT NULL,
    backup_path text,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT database_backups_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'failed'::character varying, 'in_progress'::character varying])::text[])))
);


--
-- Name: database_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.database_metrics (
    id integer NOT NULL,
    database_id character varying(255) NOT NULL,
    cpu_usage numeric(5,2),
    memory_usage numeric(5,2),
    storage_usage numeric(5,2),
    active_connections integer,
    read_iops integer,
    write_iops integer,
    network_in_mbps numeric(8,2),
    network_out_mbps numeric(8,2),
    recorded_at timestamp with time zone DEFAULT now()
);


--
-- Name: database_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.database_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: database_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.database_metrics_id_seq OWNED BY public.database_metrics.id;


--
-- Name: database_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.database_services (
    id character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'building'::character varying NOT NULL,
    version character varying(50) NOT NULL,
    plan character varying(50) NOT NULL,
    region character varying(50) NOT NULL,
    connection_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT database_services_plan_check CHECK (((plan)::text = ANY ((ARRAY['hobby'::character varying, 'starter'::character varying, 'standard'::character varying, 'business'::character varying])::text[]))),
    CONSTRAINT database_services_status_check CHECK (((status)::text = ANY ((ARRAY['running'::character varying, 'stopped'::character varying, 'building'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT database_services_type_check CHECK (((type)::text = ANY ((ARRAY['postgresql'::character varying, 'redis'::character varying, 'mysql'::character varying, 'mariadb'::character varying, 'mongodb'::character varying, 'clickhouse'::character varying, 'dragonfly'::character varying])::text[])))
);


--
-- Name: database_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.database_settings (
    database_id character varying(255) NOT NULL,
    max_connections integer DEFAULT 100,
    timeout integer DEFAULT 30,
    ssl_enabled boolean DEFAULT true,
    logging_enabled boolean DEFAULT true,
    retention_days integer DEFAULT 30,
    backup_enabled boolean DEFAULT true,
    next_backup_time timestamp with time zone,
    last_backup_time timestamp with time zone
);


--
-- Name: database_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.database_stats AS
 SELECT ds.id,
    ds.name,
    ds.type,
    ds.status,
    ds.plan,
    ds.region,
    ds.created_at,
    ds.updated_at,
    count(db.id) AS backup_count,
    max(db.created_at) AS last_backup_time,
    latest_dm.cpu_usage AS latest_cpu,
    latest_dm.memory_usage AS latest_memory,
    latest_dm.storage_usage AS latest_storage,
    latest_dm.active_connections AS latest_connections,
    latest_dm.recorded_at AS metrics_updated_at
   FROM ((public.database_services ds
     LEFT JOIN public.database_backups db ON ((((ds.id)::text = (db.database_id)::text) AND ((db.status)::text = 'completed'::text))))
     LEFT JOIN LATERAL ( SELECT database_metrics.cpu_usage,
            database_metrics.memory_usage,
            database_metrics.storage_usage,
            database_metrics.active_connections,
            database_metrics.recorded_at
           FROM public.database_metrics
          WHERE ((database_metrics.database_id)::text = (ds.id)::text)
          ORDER BY database_metrics.recorded_at DESC
         LIMIT 1) latest_dm ON (true))
  GROUP BY ds.id, ds.name, ds.type, ds.status, ds.plan, ds.region, ds.created_at, ds.updated_at, latest_dm.cpu_usage, latest_dm.memory_usage, latest_dm.storage_usage, latest_dm.active_connections, latest_dm.recorded_at;


--
-- Name: deployments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.deployments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    version character varying(100) NOT NULL,
    commit_hash character varying(100),
    image_digest character varying(500),
    status character varying(50) DEFAULT 'created'::character varying,
    build_log text,
    deployment_log text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    image_name character varying(500),
    image_tag character varying(100),
    runtime_log text,
    error text
);


--
-- Name: dns_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.dns_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(10) NOT NULL,
    ttl integer DEFAULT 300,
    records jsonb NOT NULL,
    priority integer,
    weight integer,
    port integer,
    service_id character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: environment_variables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.environment_variables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    key character varying(255) NOT NULL,
    value text,
    is_secret boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: environments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.environments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    project_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: git_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.git_branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repo_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    last_commit_hash character varying(100),
    last_commit_message text,
    last_commit_author character varying(255),
    last_commit_date timestamp with time zone,
    is_protected boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: git_deployment_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.git_deployment_triggers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_id uuid NOT NULL,
    service_id uuid NOT NULL,
    branch character varying(255) NOT NULL,
    environment character varying(50) NOT NULL,
    auto_deploy boolean DEFAULT false,
    build_command text,
    start_command text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: git_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.git_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    display_name character varying(255) NOT NULL,
    api_url character varying(500) NOT NULL,
    webhook_url character varying(500) NOT NULL,
    access_token text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: git_repositories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.git_repositories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    full_name character varying(500) NOT NULL,
    description text,
    clone_url character varying(500) NOT NULL,
    webhook_url character varying(500),
    default_branch character varying(100) DEFAULT 'main'::character varying,
    is_private boolean DEFAULT false,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: git_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.git_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repo_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    events text NOT NULL,
    webhook_secret text NOT NULL,
    remote_webhook_id character varying(255),
    active boolean DEFAULT true,
    branch_filter character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: incident_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.incident_events (
    id integer NOT NULL,
    service_id uuid,
    api_key_id uuid,
    code text NOT NULL,
    message text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    http_status integer,
    count integer DEFAULT 1 NOT NULL,
    occurred_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: incident_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.incident_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incident_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incident_events_id_seq OWNED BY public.incident_events.id;


--
-- Name: instance_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.instance_metrics (
    service_id character varying(255) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    instance_id character varying(255) NOT NULL,
    node_id character varying(255),
    status character varying(50),
    cpu numeric(5,2),
    memory bigint,
    network_bytes_in bigint,
    network_bytes_out bigint,
    network_packets_in bigint,
    network_packets_out bigint,
    network_connections_in integer,
    network_connections_out integer,
    network_errors_in bigint,
    network_errors_out bigint,
    start_time timestamp with time zone,
    last_seen timestamp with time zone,
    health_status character varying(20),
    health_last_check timestamp with time zone,
    health_check_count integer DEFAULT 0,
    health_failure_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: metrics_aggregation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.metrics_aggregation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    metric_type character varying(50) NOT NULL,
    aggregation_function character varying(50) NOT NULL,
    "interval" interval NOT NULL,
    retention_period interval DEFAULT '30 days'::interval,
    fields jsonb NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: metrics_timeseries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.metrics_timeseries (
    id integer NOT NULL,
    metric text NOT NULL,
    value real NOT NULL,
    labels_json text,
    occurred_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: metrics_timeseries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.metrics_timeseries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metrics_timeseries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metrics_timeseries_id_seq OWNED BY public.metrics_timeseries.id;


--
-- Name: node_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.node_agents (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    hostname character varying(255) NOT NULL,
    ip_address character varying(45) NOT NULL,
    port integer NOT NULL,
    status character varying(50) DEFAULT 'offline'::character varying,
    version character varying(50),
    capabilities jsonb,
    resources jsonb,
    last_heartbeat timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb
);


--
-- Name: TABLE node_agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.node_agents IS 'Container orchestration agents that manage containers on nodes';


--
-- Name: node_clusters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.node_clusters (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'active'::character varying,
    total_resources jsonb,
    used_resources jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE node_clusters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.node_clusters IS 'Clusters of node agents for resource pooling';


--
-- Name: node_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.node_metrics (
    node_id character varying(255) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    cpu_usage numeric(5,2),
    cpu_cores numeric(10,2),
    load_avg_1 numeric(5,2),
    load_avg_5 numeric(5,2),
    load_avg_15 numeric(5,2),
    memory_total bigint,
    memory_used bigint,
    memory_available bigint,
    memory_usage_percent numeric(5,2),
    storage_total bigint,
    storage_used bigint,
    storage_available bigint,
    storage_usage_percent numeric(5,2),
    network_bytes_in bigint,
    network_bytes_out bigint,
    network_packets_in bigint,
    network_packets_out bigint,
    network_connections_in integer,
    network_connections_out integer,
    network_errors_in bigint,
    network_errors_out bigint,
    uptime interval,
    processes integer,
    os character varying(50),
    kernel character varying(50),
    architecture character varying(20),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: node_metrics_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.node_metrics_summary AS
 SELECT node_metrics.node_id,
    node_metrics."timestamp",
    node_metrics.cpu_usage,
    node_metrics.memory_usage_percent,
    node_metrics.storage_usage_percent,
    (node_metrics.network_bytes_in + node_metrics.network_bytes_out) AS total_network_bytes,
    node_metrics.load_avg_1,
    node_metrics.uptime
   FROM public.node_metrics
  ORDER BY node_metrics."timestamp" DESC;


--
-- Name: preview_environments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.preview_environments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    service_id uuid NOT NULL,
    branch_name character varying(255) NOT NULL,
    pr_number integer,
    environment character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'building'::character varying NOT NULL,
    url text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT preview_environments_status_check CHECK (((status)::text = ANY ((ARRAY['building'::character varying, 'running'::character varying, 'failed'::character varying, 'stopped'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: TABLE preview_environments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.preview_environments IS 'Preview environments for branch-based deployments';


--
-- Name: COLUMN preview_environments.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.id IS 'Unique identifier for the preview environment';


--
-- Name: COLUMN preview_environments.project_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.project_id IS 'Reference to the project';


--
-- Name: COLUMN preview_environments.service_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.service_id IS 'Reference to the service';


--
-- Name: COLUMN preview_environments.branch_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.branch_name IS 'Git branch name';


--
-- Name: COLUMN preview_environments.pr_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.pr_number IS 'Pull request number (optional)';


--
-- Name: COLUMN preview_environments.environment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.environment IS 'Environment name (e.g., preview-feature-branch-20240101-120000)';


--
-- Name: COLUMN preview_environments.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.status IS 'Current status of the preview environment';


--
-- Name: COLUMN preview_environments.url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.url IS 'URL where the preview environment is accessible';


--
-- Name: COLUMN preview_environments.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.expires_at IS 'When the preview environment expires';


--
-- Name: COLUMN preview_environments.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.created_at IS 'When the preview environment was created';


--
-- Name: COLUMN preview_environments.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.preview_environments.updated_at IS 'When the preview environment was last updated';


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'developer'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    project_id uuid NOT NULL,
    environment_id uuid NOT NULL,
    service_type character varying(50) NOT NULL,
    source_type character varying(50) NOT NULL,
    source_url character varying(500),
    image_name character varying(500),
    build_command text,
    start_command text,
    cpu_limit integer,
    memory_limit integer,
    public_url character varying(500),
    health_check_url character varying(500),
    status character varying(50) DEFAULT 'created'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    type character varying(50),
    image character varying(500),
    command text,
    environment character varying(50),
    git_repo character varying(500),
    git_branch character varying(100),
    build_path character varying(500),
    cpu character varying(50),
    memory character varying(50)
);


--
-- Name: project_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.project_stats AS
 SELECT p.id,
    p.name,
    p.description,
    p.owner_id,
    p.created_at,
    p.updated_at,
    count(DISTINCT s.id) AS service_count,
    count(DISTINCT d.id) AS deployment_count,
    count(DISTINCT
        CASE
            WHEN ((s.status)::text = 'running'::text) THEN s.id
            ELSE NULL::uuid
        END) AS running_services,
    max(d.created_at) AS last_deployment
   FROM ((public.projects p
     LEFT JOIN public.services s ON ((p.id = s.project_id)))
     LEFT JOIN public.deployments d ON ((s.id = d.service_id)))
  GROUP BY p.id, p.name, p.description, p.owner_id, p.created_at, p.updated_at;


--
-- Name: VIEW project_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.project_stats IS 'Aggregated project-level statistics for dashboards';


--
-- Name: scheduling_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.scheduling_rules (
    id character varying(255) NOT NULL,
    cluster_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    selector jsonb,
    weight integer DEFAULT 1,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE scheduling_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scheduling_rules IS 'Rules for scheduling containers on agents';


--
-- Name: security_scans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.security_scans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    service_id uuid,
    scan_type character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'running'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    summary jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT security_scans_scan_type_check CHECK (((scan_type)::text = ANY ((ARRAY['dependency'::character varying, 'configuration'::character varying, 'comprehensive'::character varying])::text[]))),
    CONSTRAINT security_scans_status_check CHECK (((status)::text = ANY ((ARRAY['running'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: TABLE security_scans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.security_scans IS 'Security scan records for vulnerability assessment';


--
-- Name: service_dependencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_dependencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    depends_on_service_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT service_dependencies_check CHECK ((service_id <> depends_on_service_id))
);


--
-- Name: service_discovery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_discovery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id character varying(255) NOT NULL,
    service_name character varying(255) NOT NULL,
    project_id character varying(255) NOT NULL,
    instance_id character varying(255) NOT NULL,
    node_id character varying(255),
    ip_address inet NOT NULL,
    port integer,
    status character varying(50) DEFAULT 'unknown'::character varying,
    health_status character varying(20) DEFAULT 'unknown'::character varying,
    labels jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_seen timestamp with time zone DEFAULT now()
);


--
-- Name: service_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_metrics (
    service_id character varying(255) NOT NULL,
    service_name character varying(255) NOT NULL,
    project_id character varying(255) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    requests_total bigint DEFAULT 0,
    requests_success bigint DEFAULT 0,
    requests_errors bigint DEFAULT 0,
    requests_avg_latency numeric(10,3),
    requests_p95_latency numeric(10,3),
    requests_p99_latency numeric(10,3),
    requests_throughput numeric(10,3),
    errors_total bigint DEFAULT 0,
    errors_rate numeric(5,4),
    performance_response_time numeric(10,3),
    performance_throughput numeric(10,3),
    performance_concurrency bigint,
    performance_saturation numeric(5,2),
    performance_utilization numeric(5,2),
    resource_cpu_usage numeric(5,2),
    resource_memory_usage bigint,
    resource_storage_usage bigint,
    resource_network_usage bigint,
    resource_score numeric(5,2),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_metrics_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.service_metrics_summary AS
 SELECT service_metrics.service_id,
    service_metrics.service_name,
    service_metrics.project_id,
    service_metrics."timestamp",
    service_metrics.requests_total,
    service_metrics.requests_success,
    service_metrics.requests_errors,
        CASE
            WHEN (service_metrics.requests_total > 0) THEN ((service_metrics.requests_errors)::numeric / (service_metrics.requests_total)::numeric)
            ELSE (0)::numeric
        END AS error_rate,
    service_metrics.requests_avg_latency,
    service_metrics.requests_p95_latency,
    service_metrics.requests_throughput,
    service_metrics.resource_cpu_usage,
    service_metrics.resource_memory_usage
   FROM public.service_metrics
  ORDER BY service_metrics."timestamp" DESC;


--
-- Name: service_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.service_templates (
    id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    logo character varying(500),
    config jsonb NOT NULL,
    variables jsonb DEFAULT '[]'::jsonb,
    is_official boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: usage_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.usage_counters (
    id integer NOT NULL,
    api_key_id uuid NOT NULL,
    service_id uuid NOT NULL,
    period_month text NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: usage_counters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.usage_counters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usage_counters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usage_counters_id_seq OWNED BY public.usage_counters.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    avatar_url character varying(500),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vulnerabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.vulnerabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    service_id uuid,
    project_id uuid NOT NULL,
    status character varying(50) DEFAULT 'open'::character varying NOT NULL,
    found_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vulnerabilities_severity_check CHECK (((severity)::text = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT vulnerabilities_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'resolved'::character varying, 'ignored'::character varying])::text[]))),
    CONSTRAINT vulnerabilities_type_check CHECK (((type)::text = ANY ((ARRAY['dependency'::character varying, 'configuration'::character varying, 'code'::character varying])::text[])))
);


--
-- Name: TABLE vulnerabilities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vulnerabilities IS 'Security vulnerabilities found during scans';


--
-- Name: container_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_commands_pkey') THEN
        ALTER TABLE ONLY public.container_metrics ALTER COLUMN id SET DEFAULT nextval('public.container_metrics_id_seq'::regclass);


--
-- Name: database_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.database_metrics ALTER COLUMN id SET DEFAULT nextval('public.database_metrics_id_seq'::regclass);


--
-- Name: incident_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incident_events ALTER COLUMN id SET DEFAULT nextval('public.incident_events_id_seq'::regclass);


--
-- Name: metrics_timeseries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metrics_timeseries ALTER COLUMN id SET DEFAULT nextval('public.metrics_timeseries_id_seq'::regclass);


--
-- Name: usage_counters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_counters ALTER COLUMN id SET DEFAULT nextval('public.usage_counters_id_seq'::regclass);


--
-- Name: agent_commands agent_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commands
    ADD CONSTRAINT agent_commands_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: agent_heartbeats agent_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_heartbeats_pkey') THEN
        ALTER TABLE ONLY public.agent_heartbeats
    ADD CONSTRAINT agent_heartbeats_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: alert_incidents alert_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_incidents_pkey') THEN
        ALTER TABLE ONLY public.alert_incidents
    ADD CONSTRAINT alert_incidents_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_rules_pkey') THEN
        ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: anonymized_data anonymized_data_anonymized_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anonymized_data_anonymized_id_key') THEN
        ALTER TABLE ONLY public.anonymized_data
    ADD CONSTRAINT anonymized_data_anonymized_id_key UNIQUE (anonymized_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: anonymized_data anonymized_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anonymized_data_pkey') THEN
        ALTER TABLE ONLY public.anonymized_data
    ADD CONSTRAINT anonymized_data_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_key_hash_key') THEN
        ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_pkey') THEN
        ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: api_services api_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_services_pkey') THEN
        ALTER TABLE ONLY public.api_services
    ADD CONSTRAINT api_services_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: api_services api_services_route_prefix_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_services_route_prefix_key') THEN
        ALTER TABLE ONLY public.api_services
    ADD CONSTRAINT api_services_route_prefix_key UNIQUE (route_prefix);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: api_services api_services_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_services_slug_key') THEN
        ALTER TABLE ONLY public.api_services
    ADD CONSTRAINT api_services_slug_key UNIQUE (slug);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_pkey') THEN
        ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: builds builds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'builds_pkey') THEN
        ALTER TABLE ONLY public.builds
    ADD CONSTRAINT builds_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: cluster_agents cluster_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cluster_agents_pkey') THEN
        ALTER TABLE ONLY public.cluster_agents
    ADD CONSTRAINT cluster_agents_pkey PRIMARY KEY (cluster_id, agent_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_controls compliance_controls_framework_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_controls_framework_id_code_key') THEN
        ALTER TABLE ONLY public.compliance_controls
    ADD CONSTRAINT compliance_controls_framework_id_code_key UNIQUE (framework_id, code);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_controls compliance_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_controls_pkey') THEN
        ALTER TABLE ONLY public.compliance_controls
    ADD CONSTRAINT compliance_controls_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_frameworks compliance_frameworks_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_frameworks_name_key') THEN
        ALTER TABLE ONLY public.compliance_frameworks
    ADD CONSTRAINT compliance_frameworks_name_key UNIQUE (name);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_frameworks compliance_frameworks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_frameworks_pkey') THEN
        ALTER TABLE ONLY public.compliance_frameworks
    ADD CONSTRAINT compliance_frameworks_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_reports compliance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_reports_pkey') THEN
        ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_risks compliance_risks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_risks_pkey') THEN
        ALTER TABLE ONLY public.compliance_risks
    ADD CONSTRAINT compliance_risks_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: container_instances container_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'container_instances_pkey') THEN
        ALTER TABLE ONLY public.container_instances
    ADD CONSTRAINT container_instances_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: container_metrics container_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'container_metrics_pkey') THEN
        ALTER TABLE ONLY public.container_metrics
    ADD CONSTRAINT container_metrics_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: cron_executions cron_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cron_executions_pkey') THEN
        ALTER TABLE ONLY public.cron_executions
    ADD CONSTRAINT cron_executions_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: cron_jobs cron_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cron_jobs_pkey') THEN
        ALTER TABLE ONLY public.cron_jobs
    ADD CONSTRAINT cron_jobs_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: data_retention_policies data_retention_policies_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_retention_policies_name_key') THEN
        ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_name_key UNIQUE (name);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: data_retention_policies data_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_retention_policies_pkey') THEN
        ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_backups database_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'database_backups_pkey') THEN
        ALTER TABLE ONLY public.database_backups
    ADD CONSTRAINT database_backups_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_metrics database_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'database_metrics_pkey') THEN
        ALTER TABLE ONLY public.database_metrics
    ADD CONSTRAINT database_metrics_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_services database_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'database_services_pkey') THEN
        ALTER TABLE ONLY public.database_services
    ADD CONSTRAINT database_services_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_settings database_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'database_settings_pkey') THEN
        ALTER TABLE ONLY public.database_settings
    ADD CONSTRAINT database_settings_pkey PRIMARY KEY (database_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: deployments deployments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deployments_pkey') THEN
        ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: dns_records dns_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dns_records_pkey') THEN
        ALTER TABLE ONLY public.dns_records
    ADD CONSTRAINT dns_records_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: environment_variables environment_variables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'environment_variables_pkey') THEN
        ALTER TABLE ONLY public.environment_variables
    ADD CONSTRAINT environment_variables_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: environment_variables environment_variables_service_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'environment_variables_service_id_key_key') THEN
        ALTER TABLE ONLY public.environment_variables
    ADD CONSTRAINT environment_variables_service_id_key_key UNIQUE (service_id, key);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: environments environments_name_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'environments_name_project_id_key') THEN
        ALTER TABLE ONLY public.environments
    ADD CONSTRAINT environments_name_project_id_key UNIQUE (name, project_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: environments environments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'environments_pkey') THEN
        ALTER TABLE ONLY public.environments
    ADD CONSTRAINT environments_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_branches git_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_branches_pkey') THEN
        ALTER TABLE ONLY public.git_branches
    ADD CONSTRAINT git_branches_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_branches git_branches_repo_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_branches_repo_id_name_key') THEN
        ALTER TABLE ONLY public.git_branches
    ADD CONSTRAINT git_branches_repo_id_name_key UNIQUE (repo_id, name);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_deployment_triggers git_deployment_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_deployment_triggers_pkey') THEN
        ALTER TABLE ONLY public.git_deployment_triggers
    ADD CONSTRAINT git_deployment_triggers_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_deployment_triggers git_deployment_triggers_webhook_id_service_id_branch_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_deployment_triggers_webhook_id_service_id_branch_key') THEN
        ALTER TABLE ONLY public.git_deployment_triggers
    ADD CONSTRAINT git_deployment_triggers_webhook_id_service_id_branch_key UNIQUE (webhook_id, service_id, branch);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_providers git_providers_name_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_providers_name_user_id_key') THEN
        ALTER TABLE ONLY public.git_providers
    ADD CONSTRAINT git_providers_name_user_id_key UNIQUE (name, user_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_providers git_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_providers_pkey') THEN
        ALTER TABLE ONLY public.git_providers
    ADD CONSTRAINT git_providers_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_repositories git_repositories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_repositories_pkey') THEN
        ALTER TABLE ONLY public.git_repositories
    ADD CONSTRAINT git_repositories_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_repositories git_repositories_provider_id_full_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_repositories_provider_id_full_name_key') THEN
        ALTER TABLE ONLY public.git_repositories
    ADD CONSTRAINT git_repositories_provider_id_full_name_key UNIQUE (provider_id, full_name);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_webhooks git_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_webhooks_pkey') THEN
        ALTER TABLE ONLY public.git_webhooks
    ADD CONSTRAINT git_webhooks_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_webhooks git_webhooks_repo_id_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_webhooks_repo_id_provider_id_key') THEN
        ALTER TABLE ONLY public.git_webhooks
    ADD CONSTRAINT git_webhooks_repo_id_provider_id_key UNIQUE (repo_id, provider_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: incident_events incident_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_events_pkey') THEN
        ALTER TABLE ONLY public.incident_events
    ADD CONSTRAINT incident_events_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: instance_metrics instance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instance_metrics_pkey') THEN
        ALTER TABLE ONLY public.instance_metrics
    ADD CONSTRAINT instance_metrics_pkey PRIMARY KEY (service_id, "timestamp", instance_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: metrics_aggregation_rules metrics_aggregation_rules_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metrics_aggregation_rules_name_key') THEN
        ALTER TABLE ONLY public.metrics_aggregation_rules
    ADD CONSTRAINT metrics_aggregation_rules_name_key UNIQUE (name);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: metrics_aggregation_rules metrics_aggregation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metrics_aggregation_rules_pkey') THEN
        ALTER TABLE ONLY public.metrics_aggregation_rules
    ADD CONSTRAINT metrics_aggregation_rules_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: metrics_timeseries metrics_timeseries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metrics_timeseries_pkey') THEN
        ALTER TABLE ONLY public.metrics_timeseries
    ADD CONSTRAINT metrics_timeseries_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: node_agents node_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'node_agents_pkey') THEN
        ALTER TABLE ONLY public.node_agents
    ADD CONSTRAINT node_agents_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: node_clusters node_clusters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'node_clusters_pkey') THEN
        ALTER TABLE ONLY public.node_clusters
    ADD CONSTRAINT node_clusters_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: node_metrics node_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'node_metrics_pkey') THEN
        ALTER TABLE ONLY public.node_metrics
    ADD CONSTRAINT node_metrics_pkey PRIMARY KEY (node_id, "timestamp");
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: preview_environments preview_environments_environment_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preview_environments_environment_key') THEN
        ALTER TABLE ONLY public.preview_environments
    ADD CONSTRAINT preview_environments_environment_key UNIQUE (environment);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: preview_environments preview_environments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preview_environments_pkey') THEN
        ALTER TABLE ONLY public.preview_environments
    ADD CONSTRAINT preview_environments_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_pkey') THEN
        ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_id_user_id_key') THEN
        ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_pkey') THEN
        ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: scheduling_rules scheduling_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduling_rules_pkey') THEN
        ALTER TABLE ONLY public.scheduling_rules
    ADD CONSTRAINT scheduling_rules_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: security_scans security_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'security_scans_pkey') THEN
        ALTER TABLE ONLY public.security_scans
    ADD CONSTRAINT security_scans_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: service_dependencies service_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_dependencies_pkey') THEN
        ALTER TABLE ONLY public.service_dependencies
    ADD CONSTRAINT service_dependencies_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: service_dependencies service_dependencies_service_id_depends_on_service_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_dependencies_service_id_depends_on_service_id_key') THEN
        ALTER TABLE ONLY public.service_dependencies
    ADD CONSTRAINT service_dependencies_service_id_depends_on_service_id_key UNIQUE (service_id, depends_on_service_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: service_discovery service_discovery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_discovery_pkey') THEN
        ALTER TABLE ONLY public.service_discovery
    ADD CONSTRAINT service_discovery_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: service_discovery service_discovery_service_id_instance_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_discovery_service_id_instance_id_key') THEN
        ALTER TABLE ONLY public.service_discovery
    ADD CONSTRAINT service_discovery_service_id_instance_id_key UNIQUE (service_id, instance_id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: service_metrics service_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_metrics_pkey') THEN
        ALTER TABLE ONLY public.service_metrics
    ADD CONSTRAINT service_metrics_pkey PRIMARY KEY (service_id, "timestamp");
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: service_templates service_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_templates_pkey') THEN
        ALTER TABLE ONLY public.service_templates
    ADD CONSTRAINT service_templates_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_pkey') THEN
        ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: usage_counters usage_counters_api_key_id_service_id_period_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_api_key_id_service_id_period_month_key') THEN
        ALTER TABLE ONLY public.usage_counters
    ADD CONSTRAINT usage_counters_api_key_id_service_id_period_month_key UNIQUE (api_key_id, service_id, period_month);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: usage_counters usage_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_pkey') THEN
        ALTER TABLE ONLY public.usage_counters
    ADD CONSTRAINT usage_counters_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
        ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey') THEN
        ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: vulnerabilities vulnerabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vulnerabilities_pkey') THEN
        ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_pkey PRIMARY KEY (id);
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: idx_active_deployments; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_active_deployments ON public.deployments USING btree (service_id, created_at DESC) WHERE ((status)::text = ANY ((ARRAY['running'::character varying, 'deploying'::character varying])::text[]));


--
-- Name: idx_agent_commands_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_commands_created_at ON public.agent_commands USING btree (created_at);


--
-- Name: idx_agent_commands_node_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_commands_node_agent_id ON public.agent_commands USING btree (node_agent_id);


--
-- Name: idx_agent_commands_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_commands_status ON public.agent_commands USING btree (status);


--
-- Name: idx_agent_commands_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_commands_type ON public.agent_commands USING btree (type);


--
-- Name: idx_agent_heartbeats_node_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_node_agent_id ON public.agent_heartbeats USING btree (node_agent_id);


--
-- Name: idx_agent_heartbeats_node_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_node_timestamp ON public.agent_heartbeats USING btree (node_agent_id, "timestamp" DESC);


--
-- Name: idx_agent_heartbeats_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_timestamp ON public.agent_heartbeats USING btree ("timestamp");


--
-- Name: idx_alert_incidents_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_alert_incidents_rule ON public.alert_incidents USING btree (rule_id);


--
-- Name: idx_alert_incidents_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_alert_incidents_started ON public.alert_incidents USING btree (started_at DESC);


--
-- Name: idx_alert_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_alert_incidents_status ON public.alert_incidents USING btree (status);


--
-- Name: idx_alert_rules_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON public.alert_rules USING btree (enabled);


--
-- Name: idx_alert_rules_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON public.alert_rules USING btree (metric_type);


--
-- Name: idx_anonymized_data_anonymized_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_anonymized_data_anonymized_id ON public.anonymized_data USING btree (anonymized_id);


--
-- Name: idx_anonymized_data_data_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_anonymized_data_data_type ON public.anonymized_data USING btree (data_type);


--
-- Name: idx_anonymized_data_original_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_anonymized_data_original_id ON public.anonymized_data USING btree (original_id);


--
-- Name: idx_api_keys_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON public.api_keys USING btree (enabled);


--
-- Name: idx_api_keys_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys USING btree (key_hash);


--
-- Name: idx_api_keys_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys USING btree (key_prefix);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs USING btree (resource);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_builds_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_builds_created_at_desc ON public.builds USING btree (created_at DESC);


--
-- Name: idx_builds_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_builds_project_id ON public.builds USING btree (project_id);


--
-- Name: idx_builds_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_builds_service_id ON public.builds USING btree (service_id);


--
-- Name: idx_builds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_builds_status ON public.builds USING btree (status);


--
-- Name: idx_compliance_controls_framework_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework_id ON public.compliance_controls USING btree (framework_id);


--
-- Name: idx_compliance_controls_last_assessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_controls_last_assessed ON public.compliance_controls USING btree (last_assessed);


--
-- Name: idx_compliance_controls_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_controls_status ON public.compliance_controls USING btree (status);


--
-- Name: idx_compliance_reports_assessment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_reports_assessment_date ON public.compliance_reports USING btree (assessment_date);


--
-- Name: idx_compliance_reports_framework_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_reports_framework_id ON public.compliance_reports USING btree (framework_id);


--
-- Name: idx_compliance_reports_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_reports_project_id ON public.compliance_reports USING btree (project_id);


--
-- Name: idx_compliance_risks_control_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_risks_control_id ON public.compliance_risks USING btree (control_id);


--
-- Name: idx_compliance_risks_report_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_compliance_risks_report_id ON public.compliance_risks USING btree (report_id);


--
-- Name: idx_container_instances_node_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_container_instances_node_agent_id ON public.container_instances USING btree (node_agent_id);


--
-- Name: idx_container_instances_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_container_instances_project_id ON public.container_instances USING btree (project_id);


--
-- Name: idx_container_instances_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_container_instances_service_id ON public.container_instances USING btree (service_id);


--
-- Name: idx_container_instances_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_container_instances_status ON public.container_instances USING gin (status);


--
-- Name: idx_container_metrics_container_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_container_metrics_container_id ON public.container_metrics USING btree (container_id);


--
-- Name: idx_container_metrics_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_container_metrics_timestamp ON public.container_metrics USING btree ("timestamp");


--
-- Name: idx_cron_executions_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cron_executions_job_id ON public.cron_executions USING btree (cron_job_id);


--
-- Name: idx_cron_jobs_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON public.cron_jobs USING btree (next_run_at) WHERE (enabled = true);


--
-- Name: idx_cron_jobs_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cron_jobs_project_id ON public.cron_jobs USING btree (project_id);


--
-- Name: idx_cron_jobs_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cron_jobs_service_id ON public.cron_jobs USING btree (service_id);


--
-- Name: idx_database_backups_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_backups_created_at ON public.database_backups USING btree (created_at);


--
-- Name: idx_database_backups_database_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_backups_database_id ON public.database_backups USING btree (database_id);


--
-- Name: idx_database_backups_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_backups_status ON public.database_backups USING btree (status);


--
-- Name: idx_database_metrics_database_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_metrics_database_id ON public.database_metrics USING btree (database_id);


--
-- Name: idx_database_metrics_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_metrics_recorded_at ON public.database_metrics USING btree (recorded_at);


--
-- Name: idx_database_services_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_services_created_at ON public.database_services USING btree (created_at);


--
-- Name: idx_database_services_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_services_status ON public.database_services USING btree (status);


--
-- Name: idx_database_services_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_services_type ON public.database_services USING btree (type);


--
-- Name: idx_database_services_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_database_services_user_id ON public.database_services USING btree (user_id);


--
-- Name: idx_deployments_image_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_deployments_image_name ON public.deployments USING btree (image_name);


--
-- Name: idx_deployments_service_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_deployments_service_created ON public.deployments USING btree (service_id, created_at DESC);


--
-- Name: idx_deployments_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_deployments_service_id ON public.deployments USING btree (service_id);


--
-- Name: idx_deployments_service_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_deployments_service_status_created ON public.deployments USING btree (service_id, status, created_at DESC);


--
-- Name: idx_deployments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_deployments_status ON public.deployments USING btree (status);


--
-- Name: idx_dns_records_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_dns_records_name ON public.dns_records USING btree (name);


--
-- Name: idx_dns_records_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_dns_records_service ON public.dns_records USING btree (service_id);


--
-- Name: idx_dns_records_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_dns_records_type ON public.dns_records USING btree (type);


--
-- Name: idx_env_vars_service_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_env_vars_service_key ON public.environment_variables USING btree (service_id, key);


--
-- Name: idx_environment_variables_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_environment_variables_service_id ON public.environment_variables USING btree (service_id);


--
-- Name: idx_git_branches_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_branches_name ON public.git_branches USING btree (name);


--
-- Name: idx_git_branches_repo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_branches_repo_id ON public.git_branches USING btree (repo_id);


--
-- Name: idx_git_deployment_triggers_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_deployment_triggers_branch ON public.git_deployment_triggers USING btree (branch);


--
-- Name: idx_git_deployment_triggers_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_deployment_triggers_service_id ON public.git_deployment_triggers USING btree (service_id);


--
-- Name: idx_git_deployment_triggers_webhook_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_deployment_triggers_webhook_id ON public.git_deployment_triggers USING btree (webhook_id);


--
-- Name: idx_git_providers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_providers_name ON public.git_providers USING btree (name);


--
-- Name: idx_git_providers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_providers_user_id ON public.git_providers USING btree (user_id);


--
-- Name: idx_git_repositories_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_repositories_full_name ON public.git_repositories USING btree (full_name);


--
-- Name: idx_git_repositories_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_repositories_provider_id ON public.git_repositories USING btree (provider_id);


--
-- Name: idx_git_repositories_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_repositories_user_id ON public.git_repositories USING btree (user_id);


--
-- Name: idx_git_webhooks_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_webhooks_active ON public.git_webhooks USING btree (active);


--
-- Name: idx_git_webhooks_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_webhooks_provider_id ON public.git_webhooks USING btree (provider_id);


--
-- Name: idx_git_webhooks_repo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_git_webhooks_repo_id ON public.git_webhooks USING btree (repo_id);


--
-- Name: idx_incident_events_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_incident_events_key ON public.incident_events USING btree (api_key_id);


--
-- Name: idx_incident_events_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_incident_events_occurred ON public.incident_events USING btree (occurred_at);


--
-- Name: idx_incident_events_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_incident_events_service ON public.incident_events USING btree (service_id);


--
-- Name: idx_metrics_aggregation_rules_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_metrics_aggregation_rules_type ON public.metrics_aggregation_rules USING btree (metric_type);


--
-- Name: idx_metrics_timeseries_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_metric ON public.metrics_timeseries USING btree (metric);


--
-- Name: idx_metrics_timeseries_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_occurred ON public.metrics_timeseries USING btree (occurred_at);


--
-- Name: idx_node_agents_hostname; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_node_agents_hostname ON public.node_agents USING btree (hostname);


--
-- Name: idx_node_agents_ip_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_node_agents_ip_address ON public.node_agents USING btree (ip_address);


--
-- Name: idx_node_agents_last_heartbeat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_node_agents_last_heartbeat ON public.node_agents USING btree (last_heartbeat);


--
-- Name: idx_node_agents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_node_agents_status ON public.node_agents USING btree (status);


--
-- Name: idx_node_metrics_node_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_node_metrics_node_timestamp ON public.node_metrics USING btree (node_id, "timestamp" DESC);


--
-- Name: idx_node_metrics_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_node_metrics_timestamp ON public.node_metrics USING btree ("timestamp" DESC);


--
-- Name: idx_preview_environments_branch_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_preview_environments_branch_name ON public.preview_environments USING btree (branch_name);


--
-- Name: idx_preview_environments_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_preview_environments_expires_at ON public.preview_environments USING btree (expires_at);


--
-- Name: idx_preview_environments_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_preview_environments_project_id ON public.preview_environments USING btree (project_id);


--
-- Name: idx_preview_environments_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_preview_environments_service_id ON public.preview_environments USING btree (service_id);


--
-- Name: idx_preview_environments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_preview_environments_status ON public.preview_environments USING btree (status);


--
-- Name: idx_preview_environments_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_preview_environments_unique_active ON public.preview_environments USING btree (service_id, branch_name) WHERE ((status)::text <> ALL ((ARRAY['expired'::character varying, 'stopped'::character varying])::text[]));


--
-- Name: idx_project_members_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members USING btree (project_id);


--
-- Name: idx_project_members_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_project_members_role ON public.project_members USING btree (project_id, role);


--
-- Name: idx_project_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members USING btree (user_id);


--
-- Name: idx_projects_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects USING btree (owner_id);


--
-- Name: idx_projects_owner_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_projects_owner_updated ON public.projects USING btree (owner_id, updated_at DESC);


--
-- Name: idx_running_services; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_running_services ON public.services USING btree (project_id, updated_at DESC) WHERE ((status)::text = 'running'::text);


--
-- Name: idx_security_scans_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_scans_project_id ON public.security_scans USING btree (project_id);


--
-- Name: idx_security_scans_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_scans_started_at ON public.security_scans USING btree (started_at);


--
-- Name: idx_security_scans_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_scans_status ON public.security_scans USING btree (status);


--
-- Name: idx_service_deps_depends_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_deps_depends_on ON public.service_dependencies USING btree (depends_on_service_id);


--
-- Name: idx_service_deps_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_deps_service ON public.service_dependencies USING btree (service_id);


--
-- Name: idx_service_discovery_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_discovery_ip ON public.service_discovery USING btree (ip_address);


--
-- Name: idx_service_discovery_labels; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_discovery_labels ON public.service_discovery USING gin (labels);


--
-- Name: idx_service_discovery_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_discovery_name ON public.service_discovery USING btree (service_name);


--
-- Name: idx_service_discovery_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_discovery_project ON public.service_discovery USING btree (project_id);


--
-- Name: idx_service_discovery_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_discovery_service ON public.service_discovery USING btree (service_id);


--
-- Name: idx_service_discovery_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_discovery_status ON public.service_discovery USING btree (status);


--
-- Name: idx_service_metrics_project_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_metrics_project_timestamp ON public.service_metrics USING btree (project_id, "timestamp" DESC);


--
-- Name: idx_service_metrics_service_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_metrics_service_timestamp ON public.service_metrics USING btree (service_id, "timestamp" DESC);


--
-- Name: idx_service_metrics_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_metrics_timestamp ON public.service_metrics USING btree ("timestamp" DESC);


--
-- Name: idx_service_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_service_templates_category ON public.service_templates USING btree (category);


--
-- Name: idx_services_environment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_services_environment_id ON public.services USING btree (environment_id);


--
-- Name: idx_services_project_env; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_services_project_env ON public.services USING btree (project_id, environment_id);


--
-- Name: idx_services_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_services_project_id ON public.services USING btree (project_id);


--
-- Name: idx_services_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_services_status ON public.services USING btree (status);


--
-- Name: idx_services_status_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_services_status_project ON public.services USING btree (status, project_id);


--
-- Name: idx_usage_counters_key_service_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_usage_counters_key_service_month ON public.usage_counters USING btree (api_key_id, service_id, period_month);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);


--
-- Name: idx_vulnerabilities_found_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_found_at ON public.vulnerabilities USING btree (found_at);


--
-- Name: idx_vulnerabilities_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_project_id ON public.vulnerabilities USING btree (project_id);


--
-- Name: idx_vulnerabilities_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_service_id ON public.vulnerabilities USING btree (service_id);


--
-- Name: idx_vulnerabilities_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON public.vulnerabilities USING btree (severity);


--
-- Name: idx_vulnerabilities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status ON public.vulnerabilities USING btree (status);


--
-- Name: preview_environments preview_environments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'preview_environments_updated_at') THEN
        CREATE TRIGGER preview_environments_updated_at BEFORE UPDATE ON public.preview_environments FOR EACH ROW EXECUTE FUNCTION public.update_preview_environments_updated_at();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: agent_commands update_agent_commands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_commands_updated_at') THEN
        CREATE TRIGGER update_agent_commands_updated_at BEFORE UPDATE ON public.agent_commands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: alert_rules update_alert_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_alert_rules_updated_at') THEN
        CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: builds update_builds_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_builds_updated_at') THEN
        CREATE TRIGGER update_builds_updated_at BEFORE UPDATE ON public.builds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_controls update_compliance_controls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_compliance_controls_updated_at') THEN
        CREATE TRIGGER update_compliance_controls_updated_at BEFORE UPDATE ON public.compliance_controls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_frameworks update_compliance_frameworks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_compliance_frameworks_updated_at') THEN
        CREATE TRIGGER update_compliance_frameworks_updated_at BEFORE UPDATE ON public.compliance_frameworks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_reports update_compliance_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_compliance_reports_updated_at') THEN
        CREATE TRIGGER update_compliance_reports_updated_at BEFORE UPDATE ON public.compliance_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_risks update_compliance_risks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_compliance_risks_updated_at') THEN
        CREATE TRIGGER update_compliance_risks_updated_at BEFORE UPDATE ON public.compliance_risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: container_instances update_container_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_container_instances_updated_at') THEN
        CREATE TRIGGER update_container_instances_updated_at BEFORE UPDATE ON public.container_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: cron_jobs update_cron_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cron_jobs_updated_at') THEN
        CREATE TRIGGER update_cron_jobs_updated_at BEFORE UPDATE ON public.cron_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: data_retention_policies update_data_retention_policies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_data_retention_policies_updated_at') THEN
        CREATE TRIGGER update_data_retention_policies_updated_at BEFORE UPDATE ON public.data_retention_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: database_services update_database_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_database_services_updated_at') THEN
        CREATE TRIGGER update_database_services_updated_at BEFORE UPDATE ON public.database_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: deployments update_deployments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_deployments_updated_at') THEN
        CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: dns_records update_dns_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_dns_records_updated_at') THEN
        CREATE TRIGGER update_dns_records_updated_at BEFORE UPDATE ON public.dns_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: environment_variables update_environment_variables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_environment_variables_updated_at') THEN
        CREATE TRIGGER update_environment_variables_updated_at BEFORE UPDATE ON public.environment_variables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: environments update_environments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_environments_updated_at') THEN
        CREATE TRIGGER update_environments_updated_at BEFORE UPDATE ON public.environments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: git_branches update_git_branches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_git_branches_updated_at') THEN
        CREATE TRIGGER update_git_branches_updated_at BEFORE UPDATE ON public.git_branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: git_deployment_triggers update_git_deployment_triggers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_git_deployment_triggers_updated_at') THEN
        CREATE TRIGGER update_git_deployment_triggers_updated_at BEFORE UPDATE ON public.git_deployment_triggers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: git_providers update_git_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_git_providers_updated_at') THEN
        CREATE TRIGGER update_git_providers_updated_at BEFORE UPDATE ON public.git_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: git_repositories update_git_repositories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_git_repositories_updated_at') THEN
        CREATE TRIGGER update_git_repositories_updated_at BEFORE UPDATE ON public.git_repositories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: git_webhooks update_git_webhooks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_git_webhooks_updated_at') THEN
        CREATE TRIGGER update_git_webhooks_updated_at BEFORE UPDATE ON public.git_webhooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: metrics_aggregation_rules update_metrics_aggregation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_metrics_aggregation_rules_updated_at') THEN
        CREATE TRIGGER update_metrics_aggregation_rules_updated_at BEFORE UPDATE ON public.metrics_aggregation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: node_agents update_node_agents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_node_agents_updated_at') THEN
        CREATE TRIGGER update_node_agents_updated_at BEFORE UPDATE ON public.node_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: node_clusters update_node_clusters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_node_clusters_updated_at') THEN
        CREATE TRIGGER update_node_clusters_updated_at BEFORE UPDATE ON public.node_clusters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at') THEN
        CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: scheduling_rules update_scheduling_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scheduling_rules_updated_at') THEN
        CREATE TRIGGER update_scheduling_rules_updated_at BEFORE UPDATE ON public.scheduling_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: security_scans update_security_scans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_security_scans_updated_at') THEN
        CREATE TRIGGER update_security_scans_updated_at BEFORE UPDATE ON public.security_scans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: service_discovery update_service_discovery_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_service_discovery_updated_at') THEN
        CREATE TRIGGER update_service_discovery_updated_at BEFORE UPDATE ON public.service_discovery FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: services update_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_services_updated_at') THEN
        CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: vulnerabilities update_vulnerabilities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_vulnerabilities_updated_at') THEN
        CREATE TRIGGER update_vulnerabilities_updated_at BEFORE UPDATE ON public.vulnerabilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
-- +goose StatementEnd


--
-- Name: agent_commands agent_commands_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_commands_container_id_fkey') THEN
        ALTER TABLE ONLY public.agent_commands
    ADD CONSTRAINT agent_commands_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.container_instances(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: agent_commands agent_commands_node_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_commands_node_agent_id_fkey') THEN
        ALTER TABLE ONLY public.agent_commands
    ADD CONSTRAINT agent_commands_node_agent_id_fkey FOREIGN KEY (node_agent_id) REFERENCES public.node_agents(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: agent_heartbeats agent_heartbeats_node_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_heartbeats_node_agent_id_fkey') THEN
        ALTER TABLE ONLY public.agent_heartbeats
    ADD CONSTRAINT agent_heartbeats_node_agent_id_fkey FOREIGN KEY (node_agent_id) REFERENCES public.node_agents(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: alert_incidents alert_incidents_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_incidents_rule_id_fkey') THEN
        ALTER TABLE ONLY public.alert_incidents
    ADD CONSTRAINT alert_incidents_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_fkey') THEN
        ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: cluster_agents cluster_agents_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cluster_agents_agent_id_fkey') THEN
        ALTER TABLE ONLY public.cluster_agents
    ADD CONSTRAINT cluster_agents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.node_agents(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: cluster_agents cluster_agents_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cluster_agents_cluster_id_fkey') THEN
        ALTER TABLE ONLY public.cluster_agents
    ADD CONSTRAINT cluster_agents_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.node_clusters(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_controls compliance_controls_framework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_controls_framework_id_fkey') THEN
        ALTER TABLE ONLY public.compliance_controls
    ADD CONSTRAINT compliance_controls_framework_id_fkey FOREIGN KEY (framework_id) REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_reports compliance_reports_framework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_reports_framework_id_fkey') THEN
        ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_framework_id_fkey FOREIGN KEY (framework_id) REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_reports compliance_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_reports_project_id_fkey') THEN
        ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_risks compliance_risks_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_risks_control_id_fkey') THEN
        ALTER TABLE ONLY public.compliance_risks
    ADD CONSTRAINT compliance_risks_control_id_fkey FOREIGN KEY (control_id) REFERENCES public.compliance_controls(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: compliance_risks compliance_risks_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compliance_risks_report_id_fkey') THEN
        ALTER TABLE ONLY public.compliance_risks
    ADD CONSTRAINT compliance_risks_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.compliance_reports(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: container_instances container_instances_node_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'container_instances_node_agent_id_fkey') THEN
        ALTER TABLE ONLY public.container_instances
    ADD CONSTRAINT container_instances_node_agent_id_fkey FOREIGN KEY (node_agent_id) REFERENCES public.node_agents(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: container_metrics container_metrics_container_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'container_metrics_container_id_fkey') THEN
        ALTER TABLE ONLY public.container_metrics
    ADD CONSTRAINT container_metrics_container_id_fkey FOREIGN KEY (container_id) REFERENCES public.container_instances(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: cron_executions cron_executions_cron_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cron_executions_cron_job_id_fkey') THEN
        ALTER TABLE ONLY public.cron_executions
    ADD CONSTRAINT cron_executions_cron_job_id_fkey FOREIGN KEY (cron_job_id) REFERENCES public.cron_jobs(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: cron_jobs cron_jobs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cron_jobs_project_id_fkey') THEN
        ALTER TABLE ONLY public.cron_jobs
    ADD CONSTRAINT cron_jobs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: cron_jobs cron_jobs_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cron_jobs_service_id_fkey') THEN
        ALTER TABLE ONLY public.cron_jobs
    ADD CONSTRAINT cron_jobs_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: deployments deployments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deployments_service_id_fkey') THEN
        ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT deployments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: environment_variables environment_variables_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'environment_variables_service_id_fkey') THEN
        ALTER TABLE ONLY public.environment_variables
    ADD CONSTRAINT environment_variables_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: environments environments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'environments_project_id_fkey') THEN
        ALTER TABLE ONLY public.environments
    ADD CONSTRAINT environments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_backups fk_backup_database; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_backup_database') THEN
        ALTER TABLE ONLY public.database_backups
    ADD CONSTRAINT fk_backup_database FOREIGN KEY (database_id) REFERENCES public.database_services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_services fk_database_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_database_user') THEN
        ALTER TABLE ONLY public.database_services
    ADD CONSTRAINT fk_database_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_metrics fk_metrics_database; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_metrics_database') THEN
        ALTER TABLE ONLY public.database_metrics
    ADD CONSTRAINT fk_metrics_database FOREIGN KEY (database_id) REFERENCES public.database_services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_settings fk_settings_database; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_settings_database') THEN
        ALTER TABLE ONLY public.database_settings
    ADD CONSTRAINT fk_settings_database FOREIGN KEY (database_id) REFERENCES public.database_services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_branches git_branches_repo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_branches_repo_id_fkey') THEN
        ALTER TABLE ONLY public.git_branches
    ADD CONSTRAINT git_branches_repo_id_fkey FOREIGN KEY (repo_id) REFERENCES public.git_repositories(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_deployment_triggers git_deployment_triggers_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_deployment_triggers_service_id_fkey') THEN
        ALTER TABLE ONLY public.git_deployment_triggers
    ADD CONSTRAINT git_deployment_triggers_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_deployment_triggers git_deployment_triggers_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_deployment_triggers_webhook_id_fkey') THEN
        ALTER TABLE ONLY public.git_deployment_triggers
    ADD CONSTRAINT git_deployment_triggers_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.git_webhooks(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_providers git_providers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_providers_user_id_fkey') THEN
        ALTER TABLE ONLY public.git_providers
    ADD CONSTRAINT git_providers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_repositories git_repositories_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_repositories_provider_id_fkey') THEN
        ALTER TABLE ONLY public.git_repositories
    ADD CONSTRAINT git_repositories_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.git_providers(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_repositories git_repositories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_repositories_user_id_fkey') THEN
        ALTER TABLE ONLY public.git_repositories
    ADD CONSTRAINT git_repositories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_webhooks git_webhooks_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_webhooks_provider_id_fkey') THEN
        ALTER TABLE ONLY public.git_webhooks
    ADD CONSTRAINT git_webhooks_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.git_providers(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: git_webhooks git_webhooks_repo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'git_webhooks_repo_id_fkey') THEN
        ALTER TABLE ONLY public.git_webhooks
    ADD CONSTRAINT git_webhooks_repo_id_fkey FOREIGN KEY (repo_id) REFERENCES public.git_repositories(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: incident_events incident_events_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_events_api_key_id_fkey') THEN
        ALTER TABLE ONLY public.incident_events
    ADD CONSTRAINT incident_events_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: incident_events incident_events_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_events_service_id_fkey') THEN
        ALTER TABLE ONLY public.incident_events
    ADD CONSTRAINT incident_events_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.api_services(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: instance_metrics instance_metrics_service_id_timestamp_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instance_metrics_service_id_timestamp_fkey') THEN
        ALTER TABLE ONLY public.instance_metrics
    ADD CONSTRAINT instance_metrics_service_id_timestamp_fkey FOREIGN KEY (service_id, "timestamp") REFERENCES public.service_metrics(service_id, "timestamp") ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: preview_environments preview_environments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preview_environments_project_id_fkey') THEN
        ALTER TABLE ONLY public.preview_environments
    ADD CONSTRAINT preview_environments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: preview_environments preview_environments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preview_environments_service_id_fkey') THEN
        ALTER TABLE ONLY public.preview_environments
    ADD CONSTRAINT preview_environments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_id_fkey') THEN
        ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_user_id_fkey') THEN
        ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_owner_id_fkey') THEN
        ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: scheduling_rules scheduling_rules_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduling_rules_cluster_id_fkey') THEN
        ALTER TABLE ONLY public.scheduling_rules
    ADD CONSTRAINT scheduling_rules_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.node_clusters(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: security_scans security_scans_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'security_scans_project_id_fkey') THEN
        ALTER TABLE ONLY public.security_scans
    ADD CONSTRAINT security_scans_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: security_scans security_scans_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'security_scans_service_id_fkey') THEN
        ALTER TABLE ONLY public.security_scans
    ADD CONSTRAINT security_scans_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: service_dependencies service_dependencies_depends_on_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_dependencies_depends_on_service_id_fkey') THEN
        ALTER TABLE ONLY public.service_dependencies
    ADD CONSTRAINT service_dependencies_depends_on_service_id_fkey FOREIGN KEY (depends_on_service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: service_dependencies service_dependencies_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_dependencies_service_id_fkey') THEN
        ALTER TABLE ONLY public.service_dependencies
    ADD CONSTRAINT service_dependencies_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: services services_environment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_environment_id_fkey') THEN
        ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_environment_id_fkey FOREIGN KEY (environment_id) REFERENCES public.environments(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: services services_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_project_id_fkey') THEN
        ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: usage_counters usage_counters_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_api_key_id_fkey') THEN
        ALTER TABLE ONLY public.usage_counters
    ADD CONSTRAINT usage_counters_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: usage_counters usage_counters_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_service_id_fkey') THEN
        ALTER TABLE ONLY public.usage_counters
    ADD CONSTRAINT usage_counters_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.api_services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: vulnerabilities vulnerabilities_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vulnerabilities_project_id_fkey') THEN
        ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: vulnerabilities vulnerabilities_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vulnerabilities_service_id_fkey') THEN
        ALTER TABLE ONLY public.vulnerabilities
    ADD CONSTRAINT vulnerabilities_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
    END IF;
EXCEPTION WHEN duplicate_object OR invalid_table_definition THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_services Users can delete their own database services; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete their own database services' AND polrelid = 'public.database_services'::regclass) THEN
        CREATE POLICY "Users can delete their own database services" ON public.database_services FOR DELETE USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_backups Users can insert backups for their own databases; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert backups for their own databases' AND polrelid = 'public.database_backups'::regclass) THEN
        CREATE POLICY "Users can insert backups for their own databases" ON public.database_backups FOR INSERT WITH CHECK (((database_id)::text IN ( SELECT database_services.id
   FROM public.database_services
  WHERE (database_services.user_id = (current_setting('app.current_user_id'::text, true))::uuid))));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_metrics Users can insert metrics for their own databases; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert metrics for their own databases' AND polrelid = 'public.database_metrics'::regclass) THEN
        CREATE POLICY "Users can insert metrics for their own databases" ON public.database_metrics FOR INSERT WITH CHECK (((database_id)::text IN ( SELECT database_services.id
   FROM public.database_services
  WHERE (database_services.user_id = (current_setting('app.current_user_id'::text, true))::uuid))));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_services Users can insert their own database services; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own database services' AND polrelid = 'public.database_services'::regclass) THEN
        CREATE POLICY "Users can insert their own database services" ON public.database_services FOR INSERT WITH CHECK ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_settings Users can update settings of their own databases; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update settings of their own databases' AND polrelid = 'public.database_settings'::regclass) THEN
        CREATE POLICY "Users can update settings of their own databases" ON public.database_settings FOR UPDATE USING (((database_id)::text IN ( SELECT database_services.id
   FROM public.database_services
  WHERE (database_services.user_id = (current_setting('app.current_user_id'::text, true))::uuid))));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_services Users can update their own database services; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own database services' AND polrelid = 'public.database_services'::regclass) THEN
        CREATE POLICY "Users can update their own database services" ON public.database_services FOR UPDATE USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_backups Users can view backups of their own databases; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view backups of their own databases' AND polrelid = 'public.database_backups'::regclass) THEN
        CREATE POLICY "Users can view backups of their own databases" ON public.database_backups FOR SELECT USING (((database_id)::text IN ( SELECT database_services.id
   FROM public.database_services
  WHERE (database_services.user_id = (current_setting('app.current_user_id'::text, true))::uuid))));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_metrics Users can view metrics of their own databases; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view metrics of their own databases' AND polrelid = 'public.database_metrics'::regclass) THEN
        CREATE POLICY "Users can view metrics of their own databases" ON public.database_metrics FOR SELECT USING (((database_id)::text IN ( SELECT database_services.id
   FROM public.database_services
  WHERE (database_services.user_id = (current_setting('app.current_user_id'::text, true))::uuid))));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_settings Users can view settings of their own databases; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view settings of their own databases' AND polrelid = 'public.database_settings'::regclass) THEN
        CREATE POLICY "Users can view settings of their own databases" ON public.database_settings FOR SELECT USING (((database_id)::text IN ( SELECT database_services.id
   FROM public.database_services
  WHERE (database_services.user_id = (current_setting('app.current_user_id'::text, true))::uuid))));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_services Users can view their own database services; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own database services' AND polrelid = 'public.database_services'::regclass) THEN
        CREATE POLICY "Users can view their own database services" ON public.database_services FOR SELECT USING ((user_id = (current_setting('app.current_user_id'::text, true))::uuid));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: anonymized_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.anonymized_data ENABLE ROW LEVEL SECURITY;

--
-- Name: anonymized_data anonymized_data_policy; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'anonymized_data_policy' AND polrelid = 'public.anonymized_data'::regclass) THEN
        CREATE POLICY anonymized_data_policy ON public.anonymized_data FOR SELECT USING ((current_setting('app.is_admin'::text, true))::boolean);
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert_policy; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_logs_insert_policy' AND polrelid = 'public.audit_logs'::regclass) THEN
        CREATE POLICY audit_logs_insert_policy ON public.audit_logs FOR INSERT WITH CHECK (false);
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: audit_logs audit_logs_update_policy; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_logs_update_policy' AND polrelid = 'public.audit_logs'::regclass) THEN
        CREATE POLICY audit_logs_update_policy ON public.audit_logs FOR UPDATE WITH CHECK (false);
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: audit_logs audit_logs_user_policy; Type: POLICY; Schema: public; Owner: -
--

-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_logs_user_policy' AND polrelid = 'public.audit_logs'::regclass) THEN
        CREATE POLICY audit_logs_user_policy ON public.audit_logs FOR SELECT USING ((user_id = (current_setting('app.current_user_id'::text))::uuid));
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
-- +goose StatementEnd


--
-- Name: database_backups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.database_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: database_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.database_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: database_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.database_services ENABLE ROW LEVEL SECURITY;

--
-- Name: database_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.database_settings ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



-- Seed the default node cluster (carried over from legacy migration 003).
INSERT INTO public.node_clusters (id, name, description, status, total_resources, used_resources)
VALUES (
    'default-cluster', 'Default Cluster', 'Default cluster for all node agents', 'active',
    '{}'::jsonb, '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- +goose Down
-- Full schema teardown for the baseline.
-- +goose StatementBegin
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
-- +goose StatementEnd
