--
-- PostgreSQL database dump
--

-- Dumped from database version 11.2 (Debian 11.2-1.pgdg90+1)
-- Dumped by pg_dump version 11.2 (Debian 11.2-1.pgdg90+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: hdb_catalog; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA hdb_catalog;


ALTER SCHEMA hdb_catalog OWNER TO postgres;

--
-- Name: hdb_views; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA hdb_views;


ALTER SCHEMA hdb_views OWNER TO postgres;

--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA tiger;


ALTER SCHEMA tiger OWNER TO postgres;

--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA tiger_data;


ALTER SCHEMA tiger_data OWNER TO postgres;

--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA topology;


ALTER SCHEMA topology OWNER TO postgres;

--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry, geography, and raster spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: 
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: problem_statement_events; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.problem_statement_events AS ENUM (
    'CREATE',
    'UPDATE',
    'ADD_TASK',
    'DELETE_TASK'
);


ALTER TYPE public.problem_statement_events OWNER TO postgres;

--
-- Name: task_events; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_events AS ENUM (
    'CREATE',
    'UPDATE',
    'ADD_THREAD',
    'DELETE_THREAD'
);


ALTER TYPE public.task_events OWNER TO postgres;

--
-- Name: thread_events; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.thread_events AS ENUM (
    'CREATE',
    'SELECT_DATA',
    'SELECT_MODELS',
    'SELECT_PARAMETERS',
    'EXECUTE',
    'INGEST',
    'VISUALIZE',
    'UPDATE'
);


ALTER TYPE public.thread_events OWNER TO postgres;

--
-- Name: check_violation(text); Type: FUNCTION; Schema: hdb_catalog; Owner: postgres
--

CREATE FUNCTION hdb_catalog.check_violation(msg text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
  BEGIN
    RAISE check_violation USING message=msg;
  END;
$$;


ALTER FUNCTION hdb_catalog.check_violation(msg text) OWNER TO postgres;

--
-- Name: event_trigger_table_name_update(); Type: FUNCTION; Schema: hdb_catalog; Owner: postgres
--

CREATE FUNCTION hdb_catalog.event_trigger_table_name_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (NEW.table_schema, NEW.table_name) <> (OLD.table_schema, OLD.table_name)  THEN
    UPDATE hdb_catalog.event_triggers
    SET schema_name = NEW.table_schema, table_name = NEW.table_name
    WHERE (schema_name, table_name) = (OLD.table_schema, OLD.table_name);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION hdb_catalog.event_trigger_table_name_update() OWNER TO postgres;

--
-- Name: hdb_schema_update_event_notifier(); Type: FUNCTION; Schema: hdb_catalog; Owner: postgres
--

CREATE FUNCTION hdb_catalog.hdb_schema_update_event_notifier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  DECLARE
    instance_id uuid;
    occurred_at timestamptz;
    invalidations json;
    curr_rec record;
  BEGIN
    instance_id = NEW.instance_id;
    occurred_at = NEW.occurred_at;
    invalidations = NEW.invalidations;
    PERFORM pg_notify('hasura_schema_update', json_build_object(
      'instance_id', instance_id,
      'occurred_at', occurred_at,
      'invalidations', invalidations
      )::text);
    RETURN curr_rec;
  END;
$$;


ALTER FUNCTION hdb_catalog.hdb_schema_update_event_notifier() OWNER TO postgres;

--
-- Name: inject_table_defaults(text, text, text, text); Type: FUNCTION; Schema: hdb_catalog; Owner: postgres
--

CREATE FUNCTION hdb_catalog.inject_table_defaults(view_schema text, view_name text, tab_schema text, tab_name text) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
        r RECORD;
    BEGIN
      FOR r IN SELECT column_name, column_default FROM information_schema.columns WHERE table_schema = tab_schema AND table_name = tab_name AND column_default IS NOT NULL LOOP
          EXECUTE format('ALTER VIEW %I.%I ALTER COLUMN %I SET DEFAULT %s;', view_schema, view_name, r.column_name, r.column_default);
      END LOOP;
    END;
$$;


ALTER FUNCTION hdb_catalog.inject_table_defaults(view_schema text, view_name text, tab_schema text, tab_name text) OWNER TO postgres;

--
-- Name: insert_event_log(text, text, text, text, json); Type: FUNCTION; Schema: hdb_catalog; Owner: postgres
--

CREATE FUNCTION hdb_catalog.insert_event_log(schema_name text, table_name text, trigger_name text, op text, row_data json) RETURNS text
    LANGUAGE plpgsql
    AS $$
  DECLARE
    id text;
    payload json;
    session_variables json;
    server_version_num int;
    trace_context json;
  BEGIN
    id := gen_random_uuid();
    server_version_num := current_setting('server_version_num');
    IF server_version_num >= 90600 THEN
      session_variables := current_setting('hasura.user', 't');
      trace_context := current_setting('hasura.tracecontext', 't');
    ELSE
      BEGIN
        session_variables := current_setting('hasura.user');
      EXCEPTION WHEN OTHERS THEN
                  session_variables := NULL;
      END;
      BEGIN
        trace_context := current_setting('hasura.tracecontext');
      EXCEPTION WHEN OTHERS THEN
        trace_context := NULL;
      END;
    END IF;
    payload := json_build_object(
      'op', op,
      'data', row_data,
      'session_variables', session_variables,
      'trace_context', trace_context
    );
    INSERT INTO hdb_catalog.event_log
                (id, schema_name, table_name, trigger_name, payload)
    VALUES
    (id, schema_name, table_name, trigger_name, payload);
    RETURN id;
  END;
$$;


ALTER FUNCTION hdb_catalog.insert_event_log(schema_name text, table_name text, trigger_name text, op text, row_data json) OWNER TO postgres;

--
-- Name: show_create_table(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.show_create_table(table_name text, join_char text DEFAULT '
'::text) RETURNS text
    LANGUAGE sql STABLE
    AS $_$
SELECT 'CREATE TABLE ' || $1 || ' (' || $2 || '' || 
    string_agg(column_list.column_expr, ', ' || $2 || '') || 
    '' || $2 || ');'
FROM (
  SELECT '    ' || column_name || ' ' || data_type || 
       coalesce('(' || character_maximum_length || ')', '') || 
       case when is_nullable = 'YES' then '' else ' NOT NULL' end as column_expr
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = $1
  ORDER BY ordinal_position) column_list;
$_$;


ALTER FUNCTION public.show_create_table(table_name text, join_char text) OWNER TO postgres;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: event_invocation_logs; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.event_invocation_logs (
    id text DEFAULT public.gen_random_uuid() NOT NULL,
    event_id text,
    status integer,
    request json,
    response json,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE hdb_catalog.event_invocation_logs OWNER TO postgres;

--
-- Name: event_log; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.event_log (
    id text DEFAULT public.gen_random_uuid() NOT NULL,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    trigger_name text NOT NULL,
    payload jsonb NOT NULL,
    delivered boolean DEFAULT false NOT NULL,
    error boolean DEFAULT false NOT NULL,
    tries integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    locked boolean DEFAULT false NOT NULL,
    next_retry_at timestamp without time zone,
    archived boolean DEFAULT false NOT NULL
);


ALTER TABLE hdb_catalog.event_log OWNER TO postgres;

--
-- Name: event_triggers; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.event_triggers (
    name text NOT NULL,
    type text NOT NULL,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    configuration json,
    comment text
);


ALTER TABLE hdb_catalog.event_triggers OWNER TO postgres;

--
-- Name: hdb_action; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_action (
    action_name text NOT NULL,
    action_defn jsonb NOT NULL,
    comment text,
    is_system_defined boolean DEFAULT false
);


ALTER TABLE hdb_catalog.hdb_action OWNER TO postgres;

--
-- Name: hdb_action_log; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_action_log (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    action_name text,
    input_payload jsonb NOT NULL,
    request_headers jsonb NOT NULL,
    session_variables jsonb NOT NULL,
    response_payload jsonb,
    errors jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    response_received_at timestamp with time zone,
    status text NOT NULL,
    CONSTRAINT hdb_action_log_status_check CHECK ((status = ANY (ARRAY['created'::text, 'processing'::text, 'completed'::text, 'error'::text])))
);


ALTER TABLE hdb_catalog.hdb_action_log OWNER TO postgres;

--
-- Name: hdb_action_permission; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_action_permission (
    action_name text NOT NULL,
    role_name text NOT NULL,
    definition jsonb DEFAULT '{}'::jsonb NOT NULL,
    comment text
);


ALTER TABLE hdb_catalog.hdb_action_permission OWNER TO postgres;

--
-- Name: hdb_allowlist; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_allowlist (
    collection_name text
);


ALTER TABLE hdb_catalog.hdb_allowlist OWNER TO postgres;

--
-- Name: hdb_check_constraint; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_check_constraint AS
 SELECT (n.nspname)::text AS table_schema,
    (ct.relname)::text AS table_name,
    (r.conname)::text AS constraint_name,
    pg_get_constraintdef(r.oid, true) AS "check"
   FROM ((pg_constraint r
     JOIN pg_class ct ON ((r.conrelid = ct.oid)))
     JOIN pg_namespace n ON ((ct.relnamespace = n.oid)))
  WHERE (r.contype = 'c'::"char");


ALTER TABLE hdb_catalog.hdb_check_constraint OWNER TO postgres;

--
-- Name: hdb_computed_field; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_computed_field (
    table_schema text NOT NULL,
    table_name text NOT NULL,
    computed_field_name text NOT NULL,
    definition jsonb NOT NULL,
    comment text
);


ALTER TABLE hdb_catalog.hdb_computed_field OWNER TO postgres;

--
-- Name: hdb_computed_field_function; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_computed_field_function AS
 SELECT hdb_computed_field.table_schema,
    hdb_computed_field.table_name,
    hdb_computed_field.computed_field_name,
        CASE
            WHEN (((hdb_computed_field.definition -> 'function'::text) ->> 'name'::text) IS NULL) THEN (hdb_computed_field.definition ->> 'function'::text)
            ELSE ((hdb_computed_field.definition -> 'function'::text) ->> 'name'::text)
        END AS function_name,
        CASE
            WHEN (((hdb_computed_field.definition -> 'function'::text) ->> 'schema'::text) IS NULL) THEN 'public'::text
            ELSE ((hdb_computed_field.definition -> 'function'::text) ->> 'schema'::text)
        END AS function_schema
   FROM hdb_catalog.hdb_computed_field;


ALTER TABLE hdb_catalog.hdb_computed_field_function OWNER TO postgres;

--
-- Name: hdb_cron_event_invocation_logs; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_cron_event_invocation_logs (
    id text DEFAULT public.gen_random_uuid() NOT NULL,
    event_id text,
    status integer,
    request json,
    response json,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE hdb_catalog.hdb_cron_event_invocation_logs OWNER TO postgres;

--
-- Name: hdb_cron_events; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_cron_events (
    id text DEFAULT public.gen_random_uuid() NOT NULL,
    trigger_name text NOT NULL,
    scheduled_time timestamp with time zone NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    tries integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    next_retry_at timestamp with time zone,
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['scheduled'::text, 'locked'::text, 'delivered'::text, 'error'::text, 'dead'::text])))
);


ALTER TABLE hdb_catalog.hdb_cron_events OWNER TO postgres;

--
-- Name: hdb_cron_triggers; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_cron_triggers (
    name text NOT NULL,
    webhook_conf json NOT NULL,
    cron_schedule text NOT NULL,
    payload json,
    retry_conf json,
    header_conf json,
    include_in_metadata boolean DEFAULT false NOT NULL,
    comment text
);


ALTER TABLE hdb_catalog.hdb_cron_triggers OWNER TO postgres;

--
-- Name: hdb_cron_events_stats; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_cron_events_stats AS
 SELECT ct.name,
    COALESCE(ce.upcoming_events_count, (0)::bigint) AS upcoming_events_count,
    COALESCE(ce.max_scheduled_time, now()) AS max_scheduled_time
   FROM (hdb_catalog.hdb_cron_triggers ct
     LEFT JOIN ( SELECT hdb_cron_events.trigger_name,
            count(*) AS upcoming_events_count,
            max(hdb_cron_events.scheduled_time) AS max_scheduled_time
           FROM hdb_catalog.hdb_cron_events
          WHERE ((hdb_cron_events.tries = 0) AND (hdb_cron_events.status = 'scheduled'::text))
          GROUP BY hdb_cron_events.trigger_name) ce ON ((ct.name = ce.trigger_name)));


ALTER TABLE hdb_catalog.hdb_cron_events_stats OWNER TO postgres;

--
-- Name: hdb_custom_types; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_custom_types (
    custom_types jsonb NOT NULL
);


ALTER TABLE hdb_catalog.hdb_custom_types OWNER TO postgres;

--
-- Name: hdb_foreign_key_constraint; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_foreign_key_constraint AS
 SELECT (q.table_schema)::text AS table_schema,
    (q.table_name)::text AS table_name,
    (q.constraint_name)::text AS constraint_name,
    (min(q.constraint_oid))::integer AS constraint_oid,
    min((q.ref_table_table_schema)::text) AS ref_table_table_schema,
    min((q.ref_table)::text) AS ref_table,
    json_object_agg(ac.attname, afc.attname) AS column_mapping,
    min((q.confupdtype)::text) AS on_update,
    min((q.confdeltype)::text) AS on_delete,
    json_agg(ac.attname) AS columns,
    json_agg(afc.attname) AS ref_columns
   FROM ((( SELECT ctn.nspname AS table_schema,
            ct.relname AS table_name,
            r.conrelid AS table_id,
            r.conname AS constraint_name,
            r.oid AS constraint_oid,
            cftn.nspname AS ref_table_table_schema,
            cft.relname AS ref_table,
            r.confrelid AS ref_table_id,
            r.confupdtype,
            r.confdeltype,
            unnest(r.conkey) AS column_id,
            unnest(r.confkey) AS ref_column_id
           FROM ((((pg_constraint r
             JOIN pg_class ct ON ((r.conrelid = ct.oid)))
             JOIN pg_namespace ctn ON ((ct.relnamespace = ctn.oid)))
             JOIN pg_class cft ON ((r.confrelid = cft.oid)))
             JOIN pg_namespace cftn ON ((cft.relnamespace = cftn.oid)))
          WHERE (r.contype = 'f'::"char")) q
     JOIN pg_attribute ac ON (((q.column_id = ac.attnum) AND (q.table_id = ac.attrelid))))
     JOIN pg_attribute afc ON (((q.ref_column_id = afc.attnum) AND (q.ref_table_id = afc.attrelid))))
  GROUP BY q.table_schema, q.table_name, q.constraint_name;


ALTER TABLE hdb_catalog.hdb_foreign_key_constraint OWNER TO postgres;

--
-- Name: hdb_function; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_function (
    function_schema text NOT NULL,
    function_name text NOT NULL,
    configuration jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system_defined boolean DEFAULT false
);


ALTER TABLE hdb_catalog.hdb_function OWNER TO postgres;

--
-- Name: hdb_function_agg; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_function_agg AS
 SELECT (p.proname)::text AS function_name,
    (pn.nspname)::text AS function_schema,
    pd.description,
        CASE
            WHEN (p.provariadic = (0)::oid) THEN false
            ELSE true
        END AS has_variadic,
        CASE
            WHEN ((p.provolatile)::text = ('i'::character(1))::text) THEN 'IMMUTABLE'::text
            WHEN ((p.provolatile)::text = ('s'::character(1))::text) THEN 'STABLE'::text
            WHEN ((p.provolatile)::text = ('v'::character(1))::text) THEN 'VOLATILE'::text
            ELSE NULL::text
        END AS function_type,
    pg_get_functiondef(p.oid) AS function_definition,
    (rtn.nspname)::text AS return_type_schema,
    (rt.typname)::text AS return_type_name,
    (rt.typtype)::text AS return_type_type,
    p.proretset AS returns_set,
    ( SELECT COALESCE(json_agg(json_build_object('schema', q.schema, 'name', q.name, 'type', q.type)), '[]'::json) AS "coalesce"
           FROM ( SELECT pt.typname AS name,
                    pns.nspname AS schema,
                    pt.typtype AS type,
                    pat.ordinality
                   FROM ((unnest(COALESCE(p.proallargtypes, (p.proargtypes)::oid[])) WITH ORDINALITY pat(oid, ordinality)
                     LEFT JOIN pg_type pt ON ((pt.oid = pat.oid)))
                     LEFT JOIN pg_namespace pns ON ((pt.typnamespace = pns.oid)))
                  ORDER BY pat.ordinality) q) AS input_arg_types,
    to_json(COALESCE(p.proargnames, ARRAY[]::text[])) AS input_arg_names,
    p.pronargdefaults AS default_args,
    (p.oid)::integer AS function_oid
   FROM ((((pg_proc p
     JOIN pg_namespace pn ON ((pn.oid = p.pronamespace)))
     JOIN pg_type rt ON ((rt.oid = p.prorettype)))
     JOIN pg_namespace rtn ON ((rtn.oid = rt.typnamespace)))
     LEFT JOIN pg_description pd ON ((p.oid = pd.objoid)))
  WHERE (((pn.nspname)::text !~~ 'pg_%'::text) AND ((pn.nspname)::text <> ALL (ARRAY['information_schema'::text, 'hdb_catalog'::text, 'hdb_views'::text])) AND (NOT (EXISTS ( SELECT 1
           FROM pg_aggregate
          WHERE ((pg_aggregate.aggfnoid)::oid = p.oid)))));


ALTER TABLE hdb_catalog.hdb_function_agg OWNER TO postgres;

--
-- Name: hdb_function_info_agg; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_function_info_agg AS
 SELECT hdb_function_agg.function_name,
    hdb_function_agg.function_schema,
    row_to_json(( SELECT e.*::record AS e
           FROM ( SELECT hdb_function_agg.description,
                    hdb_function_agg.has_variadic,
                    hdb_function_agg.function_type,
                    hdb_function_agg.return_type_schema,
                    hdb_function_agg.return_type_name,
                    hdb_function_agg.return_type_type,
                    hdb_function_agg.returns_set,
                    hdb_function_agg.input_arg_types,
                    hdb_function_agg.input_arg_names,
                    hdb_function_agg.default_args,
                    ((EXISTS ( SELECT 1
                           FROM information_schema.tables
                          WHERE (((tables.table_schema)::text = hdb_function_agg.return_type_schema) AND ((tables.table_name)::text = hdb_function_agg.return_type_name)))) OR (EXISTS ( SELECT 1
                           FROM pg_matviews
                          WHERE (((pg_matviews.schemaname)::text = hdb_function_agg.return_type_schema) AND ((pg_matviews.matviewname)::text = hdb_function_agg.return_type_name))))) AS returns_table) e)) AS function_info
   FROM hdb_catalog.hdb_function_agg;


ALTER TABLE hdb_catalog.hdb_function_info_agg OWNER TO postgres;

--
-- Name: hdb_permission; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_permission (
    table_schema name NOT NULL,
    table_name name NOT NULL,
    role_name text NOT NULL,
    perm_type text NOT NULL,
    perm_def jsonb NOT NULL,
    comment text,
    is_system_defined boolean DEFAULT false,
    CONSTRAINT hdb_permission_perm_type_check CHECK ((perm_type = ANY (ARRAY['insert'::text, 'select'::text, 'update'::text, 'delete'::text])))
);


ALTER TABLE hdb_catalog.hdb_permission OWNER TO postgres;

--
-- Name: hdb_permission_agg; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_permission_agg AS
 SELECT hdb_permission.table_schema,
    hdb_permission.table_name,
    hdb_permission.role_name,
    json_object_agg(hdb_permission.perm_type, hdb_permission.perm_def) AS permissions
   FROM hdb_catalog.hdb_permission
  GROUP BY hdb_permission.table_schema, hdb_permission.table_name, hdb_permission.role_name;


ALTER TABLE hdb_catalog.hdb_permission_agg OWNER TO postgres;

--
-- Name: hdb_primary_key; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_primary_key AS
 SELECT tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    json_agg(constraint_column_usage.column_name) AS columns
   FROM (information_schema.table_constraints tc
     JOIN ( SELECT x.tblschema AS table_schema,
            x.tblname AS table_name,
            x.colname AS column_name,
            x.cstrname AS constraint_name
           FROM ( SELECT DISTINCT nr.nspname,
                    r.relname,
                    a.attname,
                    c.conname
                   FROM pg_namespace nr,
                    pg_class r,
                    pg_attribute a,
                    pg_depend d,
                    pg_namespace nc,
                    pg_constraint c
                  WHERE ((nr.oid = r.relnamespace) AND (r.oid = a.attrelid) AND (d.refclassid = ('pg_class'::regclass)::oid) AND (d.refobjid = r.oid) AND (d.refobjsubid = a.attnum) AND (d.classid = ('pg_constraint'::regclass)::oid) AND (d.objid = c.oid) AND (c.connamespace = nc.oid) AND (c.contype = 'c'::"char") AND (r.relkind = ANY (ARRAY['r'::"char", 'p'::"char"])) AND (NOT a.attisdropped))
                UNION ALL
                 SELECT nr.nspname,
                    r.relname,
                    a.attname,
                    c.conname
                   FROM pg_namespace nr,
                    pg_class r,
                    pg_attribute a,
                    pg_namespace nc,
                    pg_constraint c
                  WHERE ((nr.oid = r.relnamespace) AND (r.oid = a.attrelid) AND (nc.oid = c.connamespace) AND (r.oid =
                        CASE c.contype
                            WHEN 'f'::"char" THEN c.confrelid
                            ELSE c.conrelid
                        END) AND (a.attnum = ANY (
                        CASE c.contype
                            WHEN 'f'::"char" THEN c.confkey
                            ELSE c.conkey
                        END)) AND (NOT a.attisdropped) AND (c.contype = ANY (ARRAY['p'::"char", 'u'::"char", 'f'::"char"])) AND (r.relkind = ANY (ARRAY['r'::"char", 'p'::"char"])))) x(tblschema, tblname, colname, cstrname)) constraint_column_usage ON ((((tc.constraint_name)::text = (constraint_column_usage.constraint_name)::text) AND ((tc.table_schema)::text = (constraint_column_usage.table_schema)::text) AND ((tc.table_name)::text = (constraint_column_usage.table_name)::text))))
  WHERE ((tc.constraint_type)::text = 'PRIMARY KEY'::text)
  GROUP BY tc.table_schema, tc.table_name, tc.constraint_name;


ALTER TABLE hdb_catalog.hdb_primary_key OWNER TO postgres;

--
-- Name: hdb_query_collection; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_query_collection (
    collection_name text NOT NULL,
    collection_defn jsonb NOT NULL,
    comment text,
    is_system_defined boolean DEFAULT false
);


ALTER TABLE hdb_catalog.hdb_query_collection OWNER TO postgres;

--
-- Name: hdb_relationship; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_relationship (
    table_schema name NOT NULL,
    table_name name NOT NULL,
    rel_name text NOT NULL,
    rel_type text,
    rel_def jsonb NOT NULL,
    comment text,
    is_system_defined boolean DEFAULT false,
    CONSTRAINT hdb_relationship_rel_type_check CHECK ((rel_type = ANY (ARRAY['object'::text, 'array'::text])))
);


ALTER TABLE hdb_catalog.hdb_relationship OWNER TO postgres;

--
-- Name: hdb_remote_relationship; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_remote_relationship (
    remote_relationship_name text NOT NULL,
    table_schema name NOT NULL,
    table_name name NOT NULL,
    definition jsonb NOT NULL
);


ALTER TABLE hdb_catalog.hdb_remote_relationship OWNER TO postgres;

--
-- Name: hdb_role; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_role AS
 SELECT DISTINCT q.role_name
   FROM ( SELECT hdb_permission.role_name
           FROM hdb_catalog.hdb_permission
        UNION ALL
         SELECT hdb_action_permission.role_name
           FROM hdb_catalog.hdb_action_permission) q;


ALTER TABLE hdb_catalog.hdb_role OWNER TO postgres;

--
-- Name: hdb_scheduled_event_invocation_logs; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_scheduled_event_invocation_logs (
    id text DEFAULT public.gen_random_uuid() NOT NULL,
    event_id text,
    status integer,
    request json,
    response json,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE hdb_catalog.hdb_scheduled_event_invocation_logs OWNER TO postgres;

--
-- Name: hdb_scheduled_events; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_scheduled_events (
    id text DEFAULT public.gen_random_uuid() NOT NULL,
    webhook_conf json NOT NULL,
    scheduled_time timestamp with time zone NOT NULL,
    retry_conf json,
    payload json,
    header_conf json,
    status text DEFAULT 'scheduled'::text NOT NULL,
    tries integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    next_retry_at timestamp with time zone,
    comment text,
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['scheduled'::text, 'locked'::text, 'delivered'::text, 'error'::text, 'dead'::text])))
);


ALTER TABLE hdb_catalog.hdb_scheduled_events OWNER TO postgres;

--
-- Name: hdb_schema_update_event; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_schema_update_event (
    instance_id uuid NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    invalidations json NOT NULL
);


ALTER TABLE hdb_catalog.hdb_schema_update_event OWNER TO postgres;

--
-- Name: hdb_table; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_table (
    table_schema name NOT NULL,
    table_name name NOT NULL,
    configuration jsonb,
    is_system_defined boolean DEFAULT false,
    is_enum boolean DEFAULT false NOT NULL
);


ALTER TABLE hdb_catalog.hdb_table OWNER TO postgres;

--
-- Name: hdb_table_info_agg; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_table_info_agg AS
 SELECT schema.nspname AS table_schema,
    "table".relname AS table_name,
    jsonb_build_object('oid', ("table".oid)::integer, 'columns', COALESCE(columns.info, '[]'::jsonb), 'primary_key', primary_key.info, 'unique_constraints', COALESCE(unique_constraints.info, '[]'::jsonb), 'foreign_keys', COALESCE(foreign_key_constraints.info, '[]'::jsonb), 'view_info',
        CASE "table".relkind
            WHEN 'v'::"char" THEN jsonb_build_object('is_updatable', ((pg_relation_is_updatable(("table".oid)::regclass, true) & 4) = 4), 'is_insertable', ((pg_relation_is_updatable(("table".oid)::regclass, true) & 8) = 8), 'is_deletable', ((pg_relation_is_updatable(("table".oid)::regclass, true) & 16) = 16))
            ELSE NULL::jsonb
        END, 'description', description.description) AS info
   FROM ((((((pg_class "table"
     JOIN pg_namespace schema ON ((schema.oid = "table".relnamespace)))
     LEFT JOIN pg_description description ON (((description.classoid = ('pg_class'::regclass)::oid) AND (description.objoid = "table".oid) AND (description.objsubid = 0))))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('name', "column".attname, 'position', "column".attnum, 'type', COALESCE(base_type.typname, type.typname), 'is_nullable', (NOT "column".attnotnull), 'description', col_description("table".oid, ("column".attnum)::integer))) AS info
           FROM ((pg_attribute "column"
             LEFT JOIN pg_type type ON ((type.oid = "column".atttypid)))
             LEFT JOIN pg_type base_type ON (((type.typtype = 'd'::"char") AND (base_type.oid = type.typbasetype))))
          WHERE (("column".attrelid = "table".oid) AND ("column".attnum > 0) AND (NOT "column".attisdropped))) columns ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_build_object('constraint', jsonb_build_object('name', class.relname, 'oid', (class.oid)::integer), 'columns', COALESCE(columns_1.info, '[]'::jsonb)) AS info
           FROM ((pg_index index
             JOIN pg_class class ON ((class.oid = index.indexrelid)))
             LEFT JOIN LATERAL ( SELECT jsonb_agg("column".attname) AS info
                   FROM pg_attribute "column"
                  WHERE (("column".attrelid = "table".oid) AND ("column".attnum = ANY ((index.indkey)::smallint[])))) columns_1 ON (true))
          WHERE ((index.indrelid = "table".oid) AND index.indisprimary)) primary_key ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('name', class.relname, 'oid', (class.oid)::integer)) AS info
           FROM (pg_index index
             JOIN pg_class class ON ((class.oid = index.indexrelid)))
          WHERE ((index.indrelid = "table".oid) AND index.indisunique AND (NOT index.indisprimary))) unique_constraints ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('constraint', jsonb_build_object('name', foreign_key.constraint_name, 'oid', foreign_key.constraint_oid), 'columns', foreign_key.columns, 'foreign_table', jsonb_build_object('schema', foreign_key.ref_table_table_schema, 'name', foreign_key.ref_table), 'foreign_columns', foreign_key.ref_columns)) AS info
           FROM hdb_catalog.hdb_foreign_key_constraint foreign_key
          WHERE ((foreign_key.table_schema = (schema.nspname)::text) AND (foreign_key.table_name = ("table".relname)::text))) foreign_key_constraints ON (true))
  WHERE ("table".relkind = ANY (ARRAY['r'::"char", 't'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"]));


ALTER TABLE hdb_catalog.hdb_table_info_agg OWNER TO postgres;

--
-- Name: hdb_unique_constraint; Type: VIEW; Schema: hdb_catalog; Owner: postgres
--

CREATE VIEW hdb_catalog.hdb_unique_constraint AS
 SELECT tc.table_name,
    tc.constraint_schema AS table_schema,
    tc.constraint_name,
    json_agg(kcu.column_name) AS columns
   FROM (information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu USING (constraint_schema, constraint_name))
  WHERE ((tc.constraint_type)::text = 'UNIQUE'::text)
  GROUP BY tc.table_name, tc.constraint_schema, tc.constraint_name;


ALTER TABLE hdb_catalog.hdb_unique_constraint OWNER TO postgres;

--
-- Name: hdb_version; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.hdb_version (
    hasura_uuid uuid DEFAULT public.gen_random_uuid() NOT NULL,
    version text NOT NULL,
    upgraded_on timestamp with time zone NOT NULL,
    cli_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    console_state jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE hdb_catalog.hdb_version OWNER TO postgres;

--
-- Name: remote_schemas; Type: TABLE; Schema: hdb_catalog; Owner: postgres
--

CREATE TABLE hdb_catalog.remote_schemas (
    id bigint NOT NULL,
    name text,
    definition json,
    comment text
);


ALTER TABLE hdb_catalog.remote_schemas OWNER TO postgres;

--
-- Name: remote_schemas_id_seq; Type: SEQUENCE; Schema: hdb_catalog; Owner: postgres
--

CREATE SEQUENCE hdb_catalog.remote_schemas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE hdb_catalog.remote_schemas_id_seq OWNER TO postgres;

--
-- Name: remote_schemas_id_seq; Type: SEQUENCE OWNED BY; Schema: hdb_catalog; Owner: postgres
--

ALTER SEQUENCE hdb_catalog.remote_schemas_id_seq OWNED BY hdb_catalog.remote_schemas.id;


--
-- Name: dataset; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataset (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    categories text,
    datatype text,
    start_date date,
    end_date date,
    spatial_coverage public.geometry
);


ALTER TABLE public.dataset OWNER TO postgres;

--
-- Name: dataslice; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataslice (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    name text NOT NULL,
    dataset_id text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    region_id text NOT NULL,
    resource_count integer NOT NULL
);


ALTER TABLE public.dataslice OWNER TO postgres;

--
-- Name: dataslice_resource; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dataslice_resource (
    dataslice_id uuid NOT NULL,
    resource_id text NOT NULL,
    selected boolean NOT NULL
);


ALTER TABLE public.dataslice_resource OWNER TO postgres;

--
-- Name: execution; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execution (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    status text,
    execution_engine text,
    model_id text NOT NULL,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    run_progress double precision DEFAULT 0 NOT NULL,
    run_id text
);


ALTER TABLE public.execution OWNER TO postgres;

--
-- Name: execution_data_binding; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execution_data_binding (
    execution_id uuid NOT NULL,
    model_io_id text NOT NULL,
    resource_id text NOT NULL
);


ALTER TABLE public.execution_data_binding OWNER TO postgres;

--
-- Name: execution_parameter_binding; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execution_parameter_binding (
    execution_id uuid NOT NULL,
    model_parameter_id text NOT NULL,
    parameter_value text NOT NULL
);


ALTER TABLE public.execution_parameter_binding OWNER TO postgres;

--
-- Name: execution_result; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execution_result (
    execution_id uuid NOT NULL,
    model_io_id text NOT NULL,
    resource_id text NOT NULL
);


ALTER TABLE public.execution_result OWNER TO postgres;

--
-- Name: intervention; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.intervention (
    id text NOT NULL,
    name text,
    description text
);


ALTER TABLE public.intervention OWNER TO postgres;

--
-- Name: model; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    type text NOT NULL,
    model_version text NOT NULL,
    model_name text NOT NULL,
    region_name text,
    dimensionality text,
    parameter_assignment text,
    parameter_assignment_details text,
    calibration_target_variable text,
    spatial_grid_type text,
    spatial_grid_resolution text,
    usage_notes text,
    code_url text,
    output_time_interval text,
    model_configuration text NOT NULL,
    software_image text,
    user_id text
);


ALTER TABLE public.model OWNER TO postgres;

--
-- Name: model_input; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_input (
    model_id text NOT NULL,
    model_io_id text NOT NULL,
    "position" integer
);


ALTER TABLE public.model_input OWNER TO postgres;

--
-- Name: model_input_fixed_binding; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_input_fixed_binding (
    model_io_id text NOT NULL,
    resource_id text NOT NULL
);


ALTER TABLE public.model_input_fixed_binding OWNER TO postgres;

--
-- Name: model_io; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_io (
    id text NOT NULL,
    name text NOT NULL,
    type text,
    description text,
    format text
);


ALTER TABLE public.model_io OWNER TO postgres;

--
-- Name: model_io_variable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_io_variable (
    model_io_id text NOT NULL,
    variable_id text NOT NULL
);


ALTER TABLE public.model_io_variable OWNER TO postgres;

--
-- Name: model_output; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_output (
    model_id text NOT NULL,
    model_io_id text NOT NULL,
    "position" integer
);


ALTER TABLE public.model_output OWNER TO postgres;

--
-- Name: model_parameter; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.model_parameter (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "default" text,
    fixed_value text,
    unit text,
    min text,
    max text,
    accepted_values text,
    type text,
    adjustment_variable text,
    model_id text NOT NULL,
    "position" integer,
    datatype text
);


ALTER TABLE public.model_parameter OWNER TO postgres;

--
-- Name: problem_statement; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.problem_statement (
    id text NOT NULL,
    name text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    region_id text NOT NULL
);


ALTER TABLE public.problem_statement OWNER TO postgres;

--
-- Name: problem_statement_permission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.problem_statement_permission (
    problem_statement_id text NOT NULL,
    read boolean DEFAULT true NOT NULL,
    write boolean DEFAULT true NOT NULL,
    user_id text NOT NULL
);


ALTER TABLE public.problem_statement_permission OWNER TO postgres;

--
-- Name: problem_statement_provenance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.problem_statement_provenance (
    problem_statement_id text NOT NULL,
    userid text NOT NULL,
    notes text,
    event public.problem_statement_events NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.problem_statement_provenance OWNER TO postgres;

--
-- Name: profile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.profile OWNER TO postgres;

--
-- Name: region; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.region (
    id text NOT NULL,
    name text NOT NULL,
    parent_region_id text,
    category_id text,
    model_catalog_uri text
);


ALTER TABLE public.region OWNER TO postgres;

--
-- Name: region_category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.region_category (
    id text NOT NULL,
    name text NOT NULL,
    citation text
);


ALTER TABLE public.region_category OWNER TO postgres;

--
-- Name: region_category_tree; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.region_category_tree (
    region_category_id text NOT NULL,
    region_category_parent_id text NOT NULL
);


ALTER TABLE public.region_category_tree OWNER TO postgres;

--
-- Name: region_geometry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.region_geometry (
    id integer NOT NULL,
    region_id text NOT NULL,
    geometry public.geometry NOT NULL
);


ALTER TABLE public.region_geometry OWNER TO postgres;

--
-- Name: region_geometry_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.region_geometry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.region_geometry_id_seq OWNER TO postgres;

--
-- Name: region_geometry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.region_geometry_id_seq OWNED BY public.region_geometry.id;


--
-- Name: resource; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resource (
    id text NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    start_date date,
    end_date date,
    spatial_coverage public.geometry,
    dcid text
);


ALTER TABLE public.resource OWNER TO postgres;

--
-- Name: task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task (
    id text NOT NULL,
    name text NOT NULL,
    response_variable_id text NOT NULL,
    driving_variable_id text,
    problem_statement_id text NOT NULL,
    region_id text,
    start_date date NOT NULL,
    end_date date NOT NULL
);


ALTER TABLE public.task OWNER TO postgres;

--
-- Name: task_permission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_permission (
    task_id text NOT NULL,
    read boolean DEFAULT true NOT NULL,
    write boolean DEFAULT true NOT NULL,
    user_id text NOT NULL
);


ALTER TABLE public.task_permission OWNER TO postgres;

--
-- Name: task_provenance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_provenance (
    task_id text NOT NULL,
    event public.task_events NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    userid text NOT NULL,
    notes text
);


ALTER TABLE public.task_provenance OWNER TO postgres;

--
-- Name: thread; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread (
    id text NOT NULL,
    name text,
    response_variable_id text NOT NULL,
    driving_variable_id text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    region_id text,
    task_id text NOT NULL
);


ALTER TABLE public.thread OWNER TO postgres;

--
-- Name: thread_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread_data (
    thread_id text NOT NULL,
    dataslice_id uuid NOT NULL
);


ALTER TABLE public.thread_data OWNER TO postgres;

--
-- Name: thread_model; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread_model (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    thread_id text NOT NULL,
    model_id text NOT NULL
);


ALTER TABLE public.thread_model OWNER TO postgres;

--
-- Name: thread_model_execution; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread_model_execution (
    thread_model_id uuid NOT NULL,
    execution_id uuid NOT NULL
);


ALTER TABLE public.thread_model_execution OWNER TO postgres;

--
-- Name: thread_model_execution_summary; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread_model_execution_summary (
    submitted_for_execution boolean DEFAULT false NOT NULL,
    submitted_for_ingestion boolean DEFAULT false NOT NULL,
    submitted_for_publishing boolean DEFAULT false NOT NULL,
    submitted_for_registration boolean DEFAULT false NOT NULL,
    submission_time timestamp without time zone,
    ingestion_time timestamp without time zone,
    publishing_time timestamp without time zone,
    registration_time timestamp without time zone,
    total_runs integer DEFAULT 0 NOT NULL,
    submitted_runs integer DEFAULT 0 NOT NULL,
    successful_runs integer DEFAULT 0 NOT NULL,
    failed_runs integer DEFAULT 0 NOT NULL,
    ingested_runs integer DEFAULT 0 NOT NULL,
    registered_runs integer DEFAULT 0 NOT NULL,
    published_runs integer DEFAULT 0 NOT NULL,
    thread_model_id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    fetched_run_outputs integer DEFAULT 0 NOT NULL,
    workflow_name text
);


ALTER TABLE public.thread_model_execution_summary OWNER TO postgres;

--
-- Name: thread_model_io; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread_model_io (
    thread_model_id uuid NOT NULL,
    model_io_id text NOT NULL,
    dataslice_id uuid NOT NULL
);


ALTER TABLE public.thread_model_io OWNER TO postgres;

--
-- Name: thread_model_parameter; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread_model_parameter (
    thread_model_id uuid NOT NULL,
    model_parameter_id text NOT NULL,
    parameter_value text NOT NULL
);


ALTER TABLE public.thread_model_parameter OWNER TO postgres;

--
-- Name: thread_permission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread_permission (
    thread_id text NOT NULL,
    read boolean DEFAULT true NOT NULL,
    write boolean DEFAULT true NOT NULL,
    execute boolean DEFAULT true NOT NULL,
    user_id text NOT NULL
);


ALTER TABLE public.thread_permission OWNER TO postgres;

--
-- Name: thread_provenance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.thread_provenance (
    thread_id text NOT NULL,
    event public.thread_events NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    userid text NOT NULL,
    notes text
);


ALTER TABLE public.thread_provenance OWNER TO postgres;

--
-- Name: variable; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.variable (
    id text NOT NULL,
    description text,
    url text,
    name text,
    is_adjustment_variable boolean DEFAULT false,
    is_indicator boolean DEFAULT false,
    intervention_id text
);


ALTER TABLE public.variable OWNER TO postgres;

--
-- Name: variable_category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.variable_category (
    variable_id text NOT NULL,
    category text NOT NULL
);


ALTER TABLE public.variable_category OWNER TO postgres;

--
-- Name: remote_schemas id; Type: DEFAULT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.remote_schemas ALTER COLUMN id SET DEFAULT nextval('hdb_catalog.remote_schemas_id_seq'::regclass);


--
-- Name: region_geometry id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_geometry ALTER COLUMN id SET DEFAULT nextval('public.region_geometry_id_seq'::regclass);


--
-- Name: event_invocation_logs event_invocation_logs_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.event_invocation_logs
    ADD CONSTRAINT event_invocation_logs_pkey PRIMARY KEY (id);


--
-- Name: event_log event_log_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.event_log
    ADD CONSTRAINT event_log_pkey PRIMARY KEY (id);


--
-- Name: event_triggers event_triggers_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.event_triggers
    ADD CONSTRAINT event_triggers_pkey PRIMARY KEY (name);


--
-- Name: hdb_action_log hdb_action_log_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_action_log
    ADD CONSTRAINT hdb_action_log_pkey PRIMARY KEY (id);


--
-- Name: hdb_action_permission hdb_action_permission_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_action_permission
    ADD CONSTRAINT hdb_action_permission_pkey PRIMARY KEY (action_name, role_name);


--
-- Name: hdb_action hdb_action_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_action
    ADD CONSTRAINT hdb_action_pkey PRIMARY KEY (action_name);


--
-- Name: hdb_allowlist hdb_allowlist_collection_name_key; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_allowlist
    ADD CONSTRAINT hdb_allowlist_collection_name_key UNIQUE (collection_name);


--
-- Name: hdb_computed_field hdb_computed_field_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_computed_field
    ADD CONSTRAINT hdb_computed_field_pkey PRIMARY KEY (table_schema, table_name, computed_field_name);


--
-- Name: hdb_cron_event_invocation_logs hdb_cron_event_invocation_logs_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_cron_event_invocation_logs
    ADD CONSTRAINT hdb_cron_event_invocation_logs_pkey PRIMARY KEY (id);


--
-- Name: hdb_cron_events hdb_cron_events_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_cron_events
    ADD CONSTRAINT hdb_cron_events_pkey PRIMARY KEY (id);


--
-- Name: hdb_cron_triggers hdb_cron_triggers_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_cron_triggers
    ADD CONSTRAINT hdb_cron_triggers_pkey PRIMARY KEY (name);


--
-- Name: hdb_function hdb_function_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_function
    ADD CONSTRAINT hdb_function_pkey PRIMARY KEY (function_schema, function_name);


--
-- Name: hdb_permission hdb_permission_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_permission
    ADD CONSTRAINT hdb_permission_pkey PRIMARY KEY (table_schema, table_name, role_name, perm_type);


--
-- Name: hdb_query_collection hdb_query_collection_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_query_collection
    ADD CONSTRAINT hdb_query_collection_pkey PRIMARY KEY (collection_name);


--
-- Name: hdb_relationship hdb_relationship_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_relationship
    ADD CONSTRAINT hdb_relationship_pkey PRIMARY KEY (table_schema, table_name, rel_name);


--
-- Name: hdb_remote_relationship hdb_remote_relationship_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_remote_relationship
    ADD CONSTRAINT hdb_remote_relationship_pkey PRIMARY KEY (remote_relationship_name, table_schema, table_name);


--
-- Name: hdb_scheduled_event_invocation_logs hdb_scheduled_event_invocation_logs_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_scheduled_event_invocation_logs
    ADD CONSTRAINT hdb_scheduled_event_invocation_logs_pkey PRIMARY KEY (id);


--
-- Name: hdb_scheduled_events hdb_scheduled_events_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_scheduled_events
    ADD CONSTRAINT hdb_scheduled_events_pkey PRIMARY KEY (id);


--
-- Name: hdb_table hdb_table_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_table
    ADD CONSTRAINT hdb_table_pkey PRIMARY KEY (table_schema, table_name);


--
-- Name: hdb_version hdb_version_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_version
    ADD CONSTRAINT hdb_version_pkey PRIMARY KEY (hasura_uuid);


--
-- Name: remote_schemas remote_schemas_name_key; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.remote_schemas
    ADD CONSTRAINT remote_schemas_name_key UNIQUE (name);


--
-- Name: remote_schemas remote_schemas_pkey; Type: CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.remote_schemas
    ADD CONSTRAINT remote_schemas_pkey PRIMARY KEY (id);


--
-- Name: dataset dataset_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataset
    ADD CONSTRAINT dataset_pkey PRIMARY KEY (id);


--
-- Name: dataslice dataslice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataslice
    ADD CONSTRAINT dataslice_pkey PRIMARY KEY (id);


--
-- Name: dataslice_resource dataslice_resource_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataslice_resource
    ADD CONSTRAINT dataslice_resource_pkey PRIMARY KEY (dataslice_id, resource_id);


--
-- Name: execution_data_binding execution_data_binding_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_data_binding
    ADD CONSTRAINT execution_data_binding_pkey PRIMARY KEY (execution_id, model_io_id, resource_id);


--
-- Name: execution_parameter_binding execution_parameter_binding_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_pkey PRIMARY KEY (execution_id, model_parameter_id);


--
-- Name: execution execution_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution
    ADD CONSTRAINT execution_pkey PRIMARY KEY (id);


--
-- Name: execution_result execution_result_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_result
    ADD CONSTRAINT execution_result_pkey PRIMARY KEY (execution_id, model_io_id, resource_id);


--
-- Name: intervention intervention_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.intervention
    ADD CONSTRAINT intervention_pkey PRIMARY KEY (id);


--
-- Name: model_input_fixed_binding model_input_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_input_fixed_binding
    ADD CONSTRAINT model_input_bindings_pkey PRIMARY KEY (model_io_id, resource_id);


--
-- Name: model_input model_input_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_input
    ADD CONSTRAINT model_input_pkey PRIMARY KEY (model_id, model_io_id);


--
-- Name: model_io model_io_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_io
    ADD CONSTRAINT model_io_pkey PRIMARY KEY (id);


--
-- Name: model_io_variable model_io_variable_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_io_variable
    ADD CONSTRAINT model_io_variable_pkey PRIMARY KEY (model_io_id, variable_id);


--
-- Name: model_output model_output_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_output
    ADD CONSTRAINT model_output_pkey PRIMARY KEY (model_id, model_io_id);


--
-- Name: model_parameter model_parameter_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_parameter
    ADD CONSTRAINT model_parameter_pkey PRIMARY KEY (id);


--
-- Name: model model_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_pkey PRIMARY KEY (id);


--
-- Name: problem_statement_permission problem_statement_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_statement_permission
    ADD CONSTRAINT problem_statement_permission_pkey PRIMARY KEY (problem_statement_id, user_id);


--
-- Name: problem_statement problem_statement_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_statement
    ADD CONSTRAINT problem_statement_pkey PRIMARY KEY (id);


--
-- Name: problem_statement_provenance problem_statement_provenance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_statement_provenance
    ADD CONSTRAINT problem_statement_provenance_pkey PRIMARY KEY (event, problem_statement_id, "timestamp");


--
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_pkey PRIMARY KEY (id);


--
-- Name: region_category region_category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_category
    ADD CONSTRAINT region_category_pkey PRIMARY KEY (id);


--
-- Name: region_category_tree region_category_tree_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_category_tree
    ADD CONSTRAINT region_category_tree_pkey PRIMARY KEY (region_category_id, region_category_parent_id);


--
-- Name: region_geometry region_geometry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_geometry
    ADD CONSTRAINT region_geometry_pkey PRIMARY KEY (id);


--
-- Name: region region_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region
    ADD CONSTRAINT region_pkey PRIMARY KEY (id);


--
-- Name: resource resource_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resource
    ADD CONSTRAINT resource_pkey PRIMARY KEY (id);


--
-- Name: task_permission task_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_permission
    ADD CONSTRAINT task_permission_pkey PRIMARY KEY (task_id, user_id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: task_provenance task_provenance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_provenance
    ADD CONSTRAINT task_provenance_pkey PRIMARY KEY (task_id, event, "timestamp");


--
-- Name: thread_data thread_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_data
    ADD CONSTRAINT thread_data_pkey PRIMARY KEY (thread_id, dataslice_id);


--
-- Name: thread_model_execution thread_model_execution_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_execution
    ADD CONSTRAINT thread_model_execution_pkey PRIMARY KEY (thread_model_id, execution_id);


--
-- Name: thread_model_execution_summary thread_model_execution_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_execution_summary
    ADD CONSTRAINT thread_model_execution_summary_pkey PRIMARY KEY (thread_model_id);


--
-- Name: thread_model_io thread_model_io_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_io
    ADD CONSTRAINT thread_model_io_pkey PRIMARY KEY (model_io_id, thread_model_id, dataslice_id);


--
-- Name: thread_model_parameter thread_model_parameter_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_pkey PRIMARY KEY (thread_model_id, model_parameter_id, parameter_value);


--
-- Name: thread_model thread_model_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model
    ADD CONSTRAINT thread_model_pkey PRIMARY KEY (id);


--
-- Name: thread_model thread_model_thread_id_model_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model
    ADD CONSTRAINT thread_model_thread_id_model_id_key UNIQUE (thread_id, model_id);


--
-- Name: thread_permission thread_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_permission
    ADD CONSTRAINT thread_permission_pkey PRIMARY KEY (thread_id, user_id);


--
-- Name: thread thread_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_pkey PRIMARY KEY (id);


--
-- Name: thread_provenance thread_provenance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_provenance
    ADD CONSTRAINT thread_provenance_pkey PRIMARY KEY (thread_id, event, "timestamp");


--
-- Name: variable_category variable_category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variable_category
    ADD CONSTRAINT variable_category_pkey PRIMARY KEY (variable_id, category);


--
-- Name: variable variable_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variable
    ADD CONSTRAINT variable_pkey PRIMARY KEY (id);


--
-- Name: event_invocation_logs_event_id_idx; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE INDEX event_invocation_logs_event_id_idx ON hdb_catalog.event_invocation_logs USING btree (event_id);


--
-- Name: event_log_created_at_idx; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE INDEX event_log_created_at_idx ON hdb_catalog.event_log USING btree (created_at);


--
-- Name: event_log_delivered_idx; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE INDEX event_log_delivered_idx ON hdb_catalog.event_log USING btree (delivered);


--
-- Name: event_log_locked_idx; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE INDEX event_log_locked_idx ON hdb_catalog.event_log USING btree (locked);


--
-- Name: event_log_trigger_name_idx; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE INDEX event_log_trigger_name_idx ON hdb_catalog.event_log USING btree (trigger_name);


--
-- Name: hdb_cron_event_status; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE INDEX hdb_cron_event_status ON hdb_catalog.hdb_cron_events USING btree (status);


--
-- Name: hdb_scheduled_event_status; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE INDEX hdb_scheduled_event_status ON hdb_catalog.hdb_scheduled_events USING btree (status);


--
-- Name: hdb_schema_update_event_one_row; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE UNIQUE INDEX hdb_schema_update_event_one_row ON hdb_catalog.hdb_schema_update_event USING btree (((occurred_at IS NOT NULL)));


--
-- Name: hdb_version_one_row; Type: INDEX; Schema: hdb_catalog; Owner: postgres
--

CREATE UNIQUE INDEX hdb_version_one_row ON hdb_catalog.hdb_version USING btree (((version IS NOT NULL)));


--
-- Name: execution_data_binding_execution_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_data_binding_execution_id_index ON public.execution_data_binding USING btree (execution_id);


--
-- Name: execution_data_binding_model_io_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_data_binding_model_io_id_index ON public.execution_data_binding USING btree (model_io_id);


--
-- Name: execution_data_binding_resource_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_data_binding_resource_id_index ON public.execution_data_binding USING btree (resource_id);


--
-- Name: execution_end_time_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_end_time_index ON public.execution USING btree (end_time);


--
-- Name: execution_parameter_binding_execution_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_parameter_binding_execution_id_index ON public.execution_parameter_binding USING btree (execution_id);


--
-- Name: execution_parameter_binding_model_parameter_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_parameter_binding_model_parameter_id_index ON public.execution_parameter_binding USING btree (model_parameter_id);


--
-- Name: execution_parameter_binding_parameter_value_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_parameter_binding_parameter_value_index ON public.execution_parameter_binding USING btree (parameter_value);


--
-- Name: execution_result_execution_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_result_execution_id_index ON public.execution_result USING btree (execution_id);


--
-- Name: execution_result_model_output_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_result_model_output_id_index ON public.execution_result USING btree (model_io_id);


--
-- Name: execution_result_output_resource_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_result_output_resource_id_index ON public.execution_result USING btree (resource_id);


--
-- Name: execution_start_time_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_start_time_index ON public.execution USING btree (start_time);


--
-- Name: execution_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execution_status_index ON public.execution USING btree (status);


--
-- Name: model_input_model_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_input_model_id_index ON public.model_input USING btree (model_id);


--
-- Name: model_input_model_io_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_input_model_io_id_index ON public.model_input USING btree (model_io_id);


--
-- Name: model_io_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_io_id_index ON public.model_io USING btree (id);


--
-- Name: model_io_variable_model_io_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_io_variable_model_io_id_index ON public.model_io_variable USING btree (model_io_id);


--
-- Name: model_io_variable_variable_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_io_variable_variable_id_index ON public.model_io_variable USING btree (variable_id);


--
-- Name: model_model_configuration_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_model_configuration_index ON public.model USING btree (model_configuration);


--
-- Name: model_model_name_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_model_name_index ON public.model USING btree (model_name);


--
-- Name: model_model_version_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_model_version_index ON public.model USING btree (model_version);


--
-- Name: model_output_model_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_output_model_id_index ON public.model_output USING btree (model_id);


--
-- Name: model_output_model_io_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_output_model_io_id_index ON public.model_output USING btree (model_io_id);


--
-- Name: model_parameter_model_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX model_parameter_model_id_index ON public.model_parameter USING btree (model_id);


--
-- Name: problem_statement_region_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX problem_statement_region_id_index ON public.problem_statement USING btree (region_id);


--
-- Name: region_geometry_geometry_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX region_geometry_geometry_index ON public.region_geometry USING gist (geometry);


--
-- Name: region_geometry_region_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX region_geometry_region_id_index ON public.region_geometry USING btree (region_id);


--
-- Name: resource_spatial_coverage_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX resource_spatial_coverage_index ON public.resource USING gist (spatial_coverage);


--
-- Name: task_driving_variable_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX task_driving_variable_id_index ON public.task USING btree (driving_variable_id);


--
-- Name: task_problem_statement_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX task_problem_statement_id_index ON public.task USING btree (problem_statement_id);


--
-- Name: task_region_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX task_region_id_index ON public.task USING btree (region_id);


--
-- Name: task_response_variable_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX task_response_variable_id_index ON public.task USING btree (response_variable_id);


--
-- Name: thread_data_thread_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_data_thread_id_index ON public.thread_data USING btree (thread_id);


--
-- Name: thread_driving_variable_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_driving_variable_id_index ON public.thread USING btree (driving_variable_id);


--
-- Name: thread_model_execution_execution_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_model_execution_execution_id_index ON public.thread_model_execution USING btree (execution_id);


--
-- Name: thread_model_execution_model_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_model_execution_model_id_index ON public.thread_model_execution USING btree (thread_model_id);


--
-- Name: thread_model_execution_thread_model_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_model_execution_thread_model_id_index ON public.thread_model_execution USING btree (thread_model_id);


--
-- Name: thread_model_model_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_model_model_id_index ON public.thread_model USING btree (model_id);


--
-- Name: thread_model_thread_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_model_thread_id_index ON public.thread_model USING btree (thread_id);


--
-- Name: thread_response_variable_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_response_variable_id_index ON public.thread USING btree (response_variable_id);


--
-- Name: thread_task_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX thread_task_id_index ON public.thread USING btree (task_id);


--
-- Name: hdb_table event_trigger_table_name_update_trigger; Type: TRIGGER; Schema: hdb_catalog; Owner: postgres
--

CREATE TRIGGER event_trigger_table_name_update_trigger AFTER UPDATE ON hdb_catalog.hdb_table FOR EACH ROW EXECUTE PROCEDURE hdb_catalog.event_trigger_table_name_update();


--
-- Name: hdb_schema_update_event hdb_schema_update_event_notifier; Type: TRIGGER; Schema: hdb_catalog; Owner: postgres
--

CREATE TRIGGER hdb_schema_update_event_notifier AFTER INSERT OR UPDATE ON hdb_catalog.hdb_schema_update_event FOR EACH ROW EXECUTE PROCEDURE hdb_catalog.hdb_schema_update_event_notifier();


--
-- Name: event_invocation_logs event_invocation_logs_event_id_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.event_invocation_logs
    ADD CONSTRAINT event_invocation_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES hdb_catalog.event_log(id);


--
-- Name: hdb_action_permission hdb_action_permission_action_name_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_action_permission
    ADD CONSTRAINT hdb_action_permission_action_name_fkey FOREIGN KEY (action_name) REFERENCES hdb_catalog.hdb_action(action_name) ON UPDATE CASCADE;


--
-- Name: hdb_allowlist hdb_allowlist_collection_name_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_allowlist
    ADD CONSTRAINT hdb_allowlist_collection_name_fkey FOREIGN KEY (collection_name) REFERENCES hdb_catalog.hdb_query_collection(collection_name);


--
-- Name: hdb_computed_field hdb_computed_field_table_schema_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_computed_field
    ADD CONSTRAINT hdb_computed_field_table_schema_fkey FOREIGN KEY (table_schema, table_name) REFERENCES hdb_catalog.hdb_table(table_schema, table_name) ON UPDATE CASCADE;


--
-- Name: hdb_cron_event_invocation_logs hdb_cron_event_invocation_logs_event_id_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_cron_event_invocation_logs
    ADD CONSTRAINT hdb_cron_event_invocation_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES hdb_catalog.hdb_cron_events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hdb_cron_events hdb_cron_events_trigger_name_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_cron_events
    ADD CONSTRAINT hdb_cron_events_trigger_name_fkey FOREIGN KEY (trigger_name) REFERENCES hdb_catalog.hdb_cron_triggers(name) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: hdb_permission hdb_permission_table_schema_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_permission
    ADD CONSTRAINT hdb_permission_table_schema_fkey FOREIGN KEY (table_schema, table_name) REFERENCES hdb_catalog.hdb_table(table_schema, table_name) ON UPDATE CASCADE;


--
-- Name: hdb_relationship hdb_relationship_table_schema_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_relationship
    ADD CONSTRAINT hdb_relationship_table_schema_fkey FOREIGN KEY (table_schema, table_name) REFERENCES hdb_catalog.hdb_table(table_schema, table_name) ON UPDATE CASCADE;


--
-- Name: hdb_remote_relationship hdb_remote_relationship_table_schema_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_remote_relationship
    ADD CONSTRAINT hdb_remote_relationship_table_schema_fkey FOREIGN KEY (table_schema, table_name) REFERENCES hdb_catalog.hdb_table(table_schema, table_name) ON UPDATE CASCADE;


--
-- Name: hdb_scheduled_event_invocation_logs hdb_scheduled_event_invocation_logs_event_id_fkey; Type: FK CONSTRAINT; Schema: hdb_catalog; Owner: postgres
--

ALTER TABLE ONLY hdb_catalog.hdb_scheduled_event_invocation_logs
    ADD CONSTRAINT hdb_scheduled_event_invocation_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES hdb_catalog.hdb_scheduled_events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dataslice dataslice_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataslice
    ADD CONSTRAINT dataslice_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: dataslice dataslice_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataslice
    ADD CONSTRAINT dataslice_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: dataslice_resource dataslice_resource_dataslice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataslice_resource
    ADD CONSTRAINT dataslice_resource_dataslice_id_fkey FOREIGN KEY (dataslice_id) REFERENCES public.dataslice(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: dataslice_resource dataslice_resource_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dataslice_resource
    ADD CONSTRAINT dataslice_resource_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution_data_binding execution_data_binding_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_data_binding
    ADD CONSTRAINT execution_data_binding_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.execution(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution_data_binding execution_data_binding_model_io_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_data_binding
    ADD CONSTRAINT execution_data_binding_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution_data_binding execution_data_binding_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_data_binding
    ADD CONSTRAINT execution_data_binding_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution execution_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution
    ADD CONSTRAINT execution_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution_parameter_binding execution_parameter_binding_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.execution(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution_parameter_binding execution_parameter_binding_model_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_model_parameter_id_fkey FOREIGN KEY (model_parameter_id) REFERENCES public.model_parameter(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution_result execution_result_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_result
    ADD CONSTRAINT execution_result_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.execution(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution_result execution_result_model_io_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_result
    ADD CONSTRAINT execution_result_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: execution_result execution_result_output_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_result
    ADD CONSTRAINT execution_result_output_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_input_fixed_binding model_input_bindings_model_io_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_input_fixed_binding
    ADD CONSTRAINT model_input_bindings_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_input_fixed_binding model_input_bindings_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_input_fixed_binding
    ADD CONSTRAINT model_input_bindings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_input model_input_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_input
    ADD CONSTRAINT model_input_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_input model_input_model_io_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_input
    ADD CONSTRAINT model_input_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_io_variable model_io_variable_model_io_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_io_variable
    ADD CONSTRAINT model_io_variable_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_io_variable model_io_variable_variable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_io_variable
    ADD CONSTRAINT model_io_variable_variable_id_fkey FOREIGN KEY (variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_output model_output_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_output
    ADD CONSTRAINT model_output_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_output model_output_model_io_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_output
    ADD CONSTRAINT model_output_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: model_parameter model_parameter_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.model_parameter
    ADD CONSTRAINT model_parameter_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: problem_statement_permission problem_statement_permission_problem_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_statement_permission
    ADD CONSTRAINT problem_statement_permission_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: problem_statement_provenance problem_statement_provenance_problem_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_statement_provenance
    ADD CONSTRAINT problem_statement_provenance_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: problem_statement problem_statement_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.problem_statement
    ADD CONSTRAINT problem_statement_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: region region_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region
    ADD CONSTRAINT region_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.region_category(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: region_category_tree region_category_tree_region_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_category_tree
    ADD CONSTRAINT region_category_tree_region_category_id_fkey FOREIGN KEY (region_category_id) REFERENCES public.region_category(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: region_category_tree region_category_tree_region_category_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_category_tree
    ADD CONSTRAINT region_category_tree_region_category_parent_id_fkey FOREIGN KEY (region_category_parent_id) REFERENCES public.region_category(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: region_geometry region_geometry_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region_geometry
    ADD CONSTRAINT region_geometry_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: region region_parent_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region
    ADD CONSTRAINT region_parent_region_id_fkey FOREIGN KEY (parent_region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: task task_driving_variable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_driving_variable_id_fkey FOREIGN KEY (driving_variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: task_permission task_permission_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_permission
    ADD CONSTRAINT task_permission_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: task task_problem_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: task_provenance task_provenance_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_provenance
    ADD CONSTRAINT task_provenance_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: task task_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: task task_response_variable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_response_variable_id_fkey FOREIGN KEY (response_variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_data thread_data_dataslice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_data
    ADD CONSTRAINT thread_data_dataslice_id_fkey FOREIGN KEY (dataslice_id) REFERENCES public.dataslice(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: thread_data thread_data_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_data
    ADD CONSTRAINT thread_data_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread thread_driving_variable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_driving_variable_id_fkey FOREIGN KEY (driving_variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_model_execution thread_model_execution_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_execution
    ADD CONSTRAINT thread_model_execution_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.execution(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_model_execution_summary thread_model_execution_summary_thread_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_execution_summary
    ADD CONSTRAINT thread_model_execution_summary_thread_model_id_fkey FOREIGN KEY (thread_model_id) REFERENCES public.thread_model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_model_execution thread_model_execution_thread_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_execution
    ADD CONSTRAINT thread_model_execution_thread_model_id_fkey FOREIGN KEY (thread_model_id) REFERENCES public.thread_model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_model_io thread_model_io_dataslice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_io
    ADD CONSTRAINT thread_model_io_dataslice_id_fkey FOREIGN KEY (dataslice_id) REFERENCES public.dataslice(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: thread_model_io thread_model_io_model_io_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_io
    ADD CONSTRAINT thread_model_io_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: thread_model_io thread_model_io_thread_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_io
    ADD CONSTRAINT thread_model_io_thread_model_id_fkey FOREIGN KEY (thread_model_id) REFERENCES public.thread_model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_model thread_model_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model
    ADD CONSTRAINT thread_model_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_model_parameter thread_model_parameter_parameter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_parameter_id_fkey FOREIGN KEY (model_parameter_id) REFERENCES public.model_parameter(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: thread_model_parameter thread_model_parameter_thread_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_thread_model_id_fkey FOREIGN KEY (thread_model_id) REFERENCES public.thread_model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_model thread_model_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_model
    ADD CONSTRAINT thread_model_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_permission thread_permission_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_permission
    ADD CONSTRAINT thread_permission_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread_provenance thread_provenance_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread_provenance
    ADD CONSTRAINT thread_provenance_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread thread_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread thread_response_variable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_response_variable_id_fkey FOREIGN KEY (response_variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: thread thread_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: variable_category variable_category_variable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variable_category
    ADD CONSTRAINT variable_category_variable_id_fkey FOREIGN KEY (variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: variable variable_intervention_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variable
    ADD CONSTRAINT variable_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.intervention(id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

