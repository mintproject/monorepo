CREATE TABLE public.region_geometry (
    id integer NOT NULL,
    region_id text NOT NULL,
    geometry public.geometry NOT NULL
);
CREATE TABLE public.region (
    id text NOT NULL,
    name text NOT NULL,
    parent_region_id text,
    category_id text,
    model_catalog_uri text
);
CREATE TYPE public.problem_statement_events AS ENUM (
    'CREATE',
    'UPDATE',
    'ADD_TASK',
    'DELETE_TASK'
);
CREATE TYPE public.task_events AS ENUM (
    'CREATE',
    'UPDATE',
    'ADD_THREAD',
    'DELETE_THREAD'
);
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
CREATE TABLE public.regions_containing_point (
    id text,
    name text,
    category_id text
);
CREATE FUNCTION public.find_regions_containing_point(latitude double precision, longitude double precision) RETURNS SETOF public.regions_containing_point
    LANGUAGE sql STABLE
    AS $$
SELECT id, name, category_id 
FROM region WHERE id in
(
    SELECT 
    region_id FROM region_geometry
    WHERE
    ST_CONTAINS(
        ST_SetSRID(geometry, 4326),
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    )
);
$$;
CREATE FUNCTION public.find_regions_containing_point_fuzzy(latitude double precision, longitude double precision) RETURNS SETOF public.regions_containing_point
    LANGUAGE sql STABLE
    AS $$
SELECT id, name, category_id 
FROM region WHERE id in
(
    SELECT 
    region_id FROM region_geometry
    WHERE
    ST_CONTAINS(
        ST_SetSRID(ST_Expand(geometry,0.0001), 4326),
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    )
);
$$;
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
CREATE TABLE public.dataslice (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    name text NOT NULL,
    dataset_id text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    region_id text NOT NULL,
    resource_count integer NOT NULL
);
CREATE TABLE public.dataslice_resource (
    dataslice_id uuid NOT NULL,
    resource_id text NOT NULL,
    selected boolean NOT NULL
);
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
CREATE TABLE public.execution_data_binding (
    execution_id uuid NOT NULL,
    model_io_id text NOT NULL,
    resource_id text NOT NULL
);
CREATE TABLE public.execution_parameter_binding (
    execution_id uuid NOT NULL,
    model_parameter_id text NOT NULL,
    parameter_value text NOT NULL
);
CREATE TABLE public.execution_result (
    execution_id uuid NOT NULL,
    model_io_id text NOT NULL,
    resource_id text NOT NULL
);
CREATE TABLE public.intervention (
    id text NOT NULL,
    name text,
    description text
);
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
CREATE TABLE public.model_input (
    model_id text NOT NULL,
    model_io_id text NOT NULL,
    "position" integer
);
CREATE TABLE public.model_input_fixed_binding (
    model_io_id text NOT NULL,
    resource_id text NOT NULL
);
CREATE TABLE public.model_io (
    id text NOT NULL,
    name text NOT NULL,
    type text,
    description text,
    format text
);
CREATE TABLE public.model_io_variable (
    model_io_id text NOT NULL,
    variable_id text NOT NULL
);
CREATE TABLE public.model_output (
    model_id text NOT NULL,
    model_io_id text NOT NULL,
    "position" integer
);
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
CREATE TABLE public.problem_statement (
    id text NOT NULL,
    name text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    region_id text NOT NULL
);
CREATE TABLE public.problem_statement_permission (
    problem_statement_id text NOT NULL,
    read boolean DEFAULT true NOT NULL,
    write boolean DEFAULT true NOT NULL,
    user_id text NOT NULL
);
CREATE TABLE public.problem_statement_provenance (
    problem_statement_id text NOT NULL,
    userid text NOT NULL,
    notes text,
    event public.problem_statement_events NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.profile (
    id integer NOT NULL,
    name text NOT NULL
);
CREATE TABLE public.region_category (
    id text NOT NULL,
    name text NOT NULL,
    citation text
);
CREATE TABLE public.region_category_tree (
    region_category_id text NOT NULL,
    region_category_parent_id text NOT NULL
);
CREATE SEQUENCE public.region_geometry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.region_geometry_id_seq OWNED BY public.region_geometry.id;
CREATE TABLE public.resource (
    id text NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    start_date date,
    end_date date,
    spatial_coverage public.geometry,
    dcid text
);
CREATE TABLE public.task (
    id text NOT NULL,
    name text NOT NULL,
    response_variable_id text,
    driving_variable_id text,
    problem_statement_id text NOT NULL,
    region_id text,
    start_date date NOT NULL,
    end_date date NOT NULL
);
CREATE TABLE public.task_permission (
    task_id text NOT NULL,
    read boolean DEFAULT true NOT NULL,
    write boolean DEFAULT true NOT NULL,
    user_id text NOT NULL
);
CREATE TABLE public.task_provenance (
    task_id text NOT NULL,
    event public.task_events NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    userid text NOT NULL,
    notes text
);
CREATE TABLE public.thread (
    id text NOT NULL,
    name text,
    response_variable_id text,
    driving_variable_id text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    region_id text,
    task_id text NOT NULL
);
CREATE TABLE public.thread_data (
    thread_id text NOT NULL,
    dataslice_id uuid NOT NULL
);
CREATE TABLE public.thread_model (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    thread_id text NOT NULL,
    model_id text NOT NULL
);
CREATE TABLE public.thread_model_execution (
    thread_model_id uuid NOT NULL,
    execution_id uuid NOT NULL
);
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
CREATE TABLE public.thread_model_io (
    thread_model_id uuid NOT NULL,
    model_io_id text NOT NULL,
    dataslice_id uuid NOT NULL
);
CREATE TABLE public.thread_model_parameter (
    thread_model_id uuid NOT NULL,
    model_parameter_id text NOT NULL,
    parameter_value text NOT NULL
);
CREATE TABLE public.thread_permission (
    thread_id text NOT NULL,
    read boolean DEFAULT true NOT NULL,
    write boolean DEFAULT true NOT NULL,
    execute boolean DEFAULT true NOT NULL,
    user_id text NOT NULL
);
CREATE TABLE public.thread_provenance (
    thread_id text NOT NULL,
    event public.thread_events NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    userid text NOT NULL,
    notes text
);
CREATE TABLE public.variable (
    id text NOT NULL,
    description text,
    url text,
    name text,
    is_adjustment_variable boolean DEFAULT false,
    is_indicator boolean DEFAULT false,
    intervention_id text
);
CREATE TABLE public.variable_category (
    variable_id text NOT NULL,
    category text NOT NULL
);
ALTER TABLE ONLY public.region_geometry ALTER COLUMN id SET DEFAULT nextval('public.region_geometry_id_seq'::regclass);
ALTER TABLE ONLY public.dataset
    ADD CONSTRAINT dataset_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.dataslice
    ADD CONSTRAINT dataslice_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.dataslice_resource
    ADD CONSTRAINT dataslice_resource_pkey PRIMARY KEY (dataslice_id, resource_id);
ALTER TABLE ONLY public.execution_data_binding
    ADD CONSTRAINT execution_data_binding_pkey PRIMARY KEY (execution_id, model_io_id, resource_id);
ALTER TABLE ONLY public.execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_pkey PRIMARY KEY (execution_id, model_parameter_id);
ALTER TABLE ONLY public.execution
    ADD CONSTRAINT execution_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.execution_result
    ADD CONSTRAINT execution_result_pkey PRIMARY KEY (execution_id, model_io_id, resource_id);
ALTER TABLE ONLY public.intervention
    ADD CONSTRAINT intervention_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.model_input_fixed_binding
    ADD CONSTRAINT model_input_bindings_pkey PRIMARY KEY (model_io_id, resource_id);
ALTER TABLE ONLY public.model_input
    ADD CONSTRAINT model_input_pkey PRIMARY KEY (model_id, model_io_id);
ALTER TABLE ONLY public.model_io
    ADD CONSTRAINT model_io_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.model_io_variable
    ADD CONSTRAINT model_io_variable_pkey PRIMARY KEY (model_io_id, variable_id);
ALTER TABLE ONLY public.model_output
    ADD CONSTRAINT model_output_pkey PRIMARY KEY (model_id, model_io_id);
ALTER TABLE ONLY public.model_parameter
    ADD CONSTRAINT model_parameter_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.problem_statement_permission
    ADD CONSTRAINT problem_statement_permission_pkey PRIMARY KEY (problem_statement_id, user_id);
ALTER TABLE ONLY public.problem_statement
    ADD CONSTRAINT problem_statement_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.problem_statement_provenance
    ADD CONSTRAINT problem_statement_provenance_pkey PRIMARY KEY (event, problem_statement_id, "timestamp");
ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.region_category
    ADD CONSTRAINT region_category_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.region_category_tree
    ADD CONSTRAINT region_category_tree_pkey PRIMARY KEY (region_category_id, region_category_parent_id);
ALTER TABLE ONLY public.region_geometry
    ADD CONSTRAINT region_geometry_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.region
    ADD CONSTRAINT region_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.resource
    ADD CONSTRAINT resource_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_permission
    ADD CONSTRAINT task_permission_pkey PRIMARY KEY (task_id, user_id);
ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.task_provenance
    ADD CONSTRAINT task_provenance_pkey PRIMARY KEY (task_id, event, "timestamp");
ALTER TABLE ONLY public.thread_data
    ADD CONSTRAINT thread_data_pkey PRIMARY KEY (thread_id, dataslice_id);
ALTER TABLE ONLY public.thread_model_execution
    ADD CONSTRAINT thread_model_execution_pkey PRIMARY KEY (thread_model_id, execution_id);
ALTER TABLE ONLY public.thread_model_execution_summary
    ADD CONSTRAINT thread_model_execution_summary_pkey PRIMARY KEY (thread_model_id);
ALTER TABLE ONLY public.thread_model_io
    ADD CONSTRAINT thread_model_io_pkey PRIMARY KEY (model_io_id, thread_model_id, dataslice_id);
ALTER TABLE ONLY public.thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_pkey PRIMARY KEY (thread_model_id, model_parameter_id, parameter_value);
ALTER TABLE ONLY public.thread_model
    ADD CONSTRAINT thread_model_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.thread_model
    ADD CONSTRAINT thread_model_thread_id_model_id_key UNIQUE (thread_id, model_id);
ALTER TABLE ONLY public.thread_permission
    ADD CONSTRAINT thread_permission_pkey PRIMARY KEY (thread_id, user_id);
ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.thread_provenance
    ADD CONSTRAINT thread_provenance_pkey PRIMARY KEY (thread_id, event, "timestamp");
ALTER TABLE ONLY public.variable_category
    ADD CONSTRAINT variable_category_pkey PRIMARY KEY (variable_id, category);
ALTER TABLE ONLY public.variable
    ADD CONSTRAINT variable_pkey PRIMARY KEY (id);
CREATE INDEX execution_data_binding_execution_id_index ON public.execution_data_binding USING btree (execution_id);
CREATE INDEX execution_data_binding_model_io_id_index ON public.execution_data_binding USING btree (model_io_id);
CREATE INDEX execution_data_binding_resource_id_index ON public.execution_data_binding USING btree (resource_id);
CREATE INDEX execution_end_time_index ON public.execution USING btree (end_time);
CREATE INDEX execution_parameter_binding_execution_id_index ON public.execution_parameter_binding USING btree (execution_id);
CREATE INDEX execution_parameter_binding_model_parameter_id_index ON public.execution_parameter_binding USING btree (model_parameter_id);
CREATE INDEX execution_parameter_binding_parameter_value_index ON public.execution_parameter_binding USING btree (parameter_value);
CREATE INDEX execution_result_execution_id_index ON public.execution_result USING btree (execution_id);
CREATE INDEX execution_result_model_output_id_index ON public.execution_result USING btree (model_io_id);
CREATE INDEX execution_result_output_resource_id_index ON public.execution_result USING btree (resource_id);
CREATE INDEX execution_start_time_index ON public.execution USING btree (start_time);
CREATE INDEX execution_status_index ON public.execution USING btree (status);
CREATE INDEX model_input_model_id_index ON public.model_input USING btree (model_id);
CREATE INDEX model_input_model_io_id_index ON public.model_input USING btree (model_io_id);
CREATE INDEX model_io_id_index ON public.model_io USING btree (id);
CREATE INDEX model_io_variable_model_io_id_index ON public.model_io_variable USING btree (model_io_id);
CREATE INDEX model_io_variable_variable_id_index ON public.model_io_variable USING btree (variable_id);
CREATE INDEX model_model_configuration_index ON public.model USING btree (model_configuration);
CREATE INDEX model_model_name_index ON public.model USING btree (model_name);
CREATE INDEX model_model_version_index ON public.model USING btree (model_version);
CREATE INDEX model_output_model_id_index ON public.model_output USING btree (model_id);
CREATE INDEX model_output_model_io_id_index ON public.model_output USING btree (model_io_id);
CREATE INDEX model_parameter_model_id_index ON public.model_parameter USING btree (model_id);
CREATE INDEX problem_statement_region_id_index ON public.problem_statement USING btree (region_id);
CREATE INDEX region_geometry_geometry_index ON public.region_geometry USING gist (geometry);
CREATE INDEX region_geometry_region_id_index ON public.region_geometry USING btree (region_id);
CREATE INDEX resource_spatial_coverage_index ON public.resource USING gist (spatial_coverage);
CREATE INDEX task_driving_variable_id_index ON public.task USING btree (driving_variable_id);
CREATE INDEX task_problem_statement_id_index ON public.task USING btree (problem_statement_id);
CREATE INDEX task_region_id_index ON public.task USING btree (region_id);
CREATE INDEX task_response_variable_id_index ON public.task USING btree (response_variable_id);
CREATE INDEX thread_data_thread_id_index ON public.thread_data USING btree (thread_id);
CREATE INDEX thread_driving_variable_id_index ON public.thread USING btree (driving_variable_id);
CREATE INDEX thread_model_execution_execution_id_index ON public.thread_model_execution USING btree (execution_id);
CREATE INDEX thread_model_execution_model_id_index ON public.thread_model_execution USING btree (thread_model_id);
CREATE INDEX thread_model_execution_thread_model_id_index ON public.thread_model_execution USING btree (thread_model_id);
CREATE INDEX thread_model_model_id_index ON public.thread_model USING btree (model_id);
CREATE INDEX thread_model_thread_id_index ON public.thread_model USING btree (thread_id);
CREATE INDEX thread_response_variable_id_index ON public.thread USING btree (response_variable_id);
CREATE INDEX thread_task_id_index ON public.thread USING btree (task_id);
ALTER TABLE ONLY public.dataslice
    ADD CONSTRAINT dataslice_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.dataset(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.dataslice
    ADD CONSTRAINT dataslice_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.dataslice_resource
    ADD CONSTRAINT dataslice_resource_dataslice_id_fkey FOREIGN KEY (dataslice_id) REFERENCES public.dataslice(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.dataslice_resource
    ADD CONSTRAINT dataslice_resource_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution_data_binding
    ADD CONSTRAINT execution_data_binding_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.execution(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution_data_binding
    ADD CONSTRAINT execution_data_binding_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution_data_binding
    ADD CONSTRAINT execution_data_binding_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution
    ADD CONSTRAINT execution_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.execution(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution_parameter_binding
    ADD CONSTRAINT execution_parameter_binding_model_parameter_id_fkey FOREIGN KEY (model_parameter_id) REFERENCES public.model_parameter(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution_result
    ADD CONSTRAINT execution_result_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.execution(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution_result
    ADD CONSTRAINT execution_result_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.execution_result
    ADD CONSTRAINT execution_result_output_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_input_fixed_binding
    ADD CONSTRAINT model_input_bindings_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_input_fixed_binding
    ADD CONSTRAINT model_input_bindings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_input
    ADD CONSTRAINT model_input_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_input
    ADD CONSTRAINT model_input_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_io_variable
    ADD CONSTRAINT model_io_variable_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_io_variable
    ADD CONSTRAINT model_io_variable_variable_id_fkey FOREIGN KEY (variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_output
    ADD CONSTRAINT model_output_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_output
    ADD CONSTRAINT model_output_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.model_parameter
    ADD CONSTRAINT model_parameter_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.problem_statement_permission
    ADD CONSTRAINT problem_statement_permission_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.problem_statement_provenance
    ADD CONSTRAINT problem_statement_provenance_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.problem_statement
    ADD CONSTRAINT problem_statement_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.region
    ADD CONSTRAINT region_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.region_category(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.region_category_tree
    ADD CONSTRAINT region_category_tree_region_category_id_fkey FOREIGN KEY (region_category_id) REFERENCES public.region_category(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.region_category_tree
    ADD CONSTRAINT region_category_tree_region_category_parent_id_fkey FOREIGN KEY (region_category_parent_id) REFERENCES public.region_category(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.region_geometry
    ADD CONSTRAINT region_geometry_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.region
    ADD CONSTRAINT region_parent_region_id_fkey FOREIGN KEY (parent_region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_driving_variable_id_fkey FOREIGN KEY (driving_variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.task_permission
    ADD CONSTRAINT task_permission_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_problem_statement_id_fkey FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.task_provenance
    ADD CONSTRAINT task_provenance_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_response_variable_id_fkey FOREIGN KEY (response_variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_data
    ADD CONSTRAINT thread_data_dataslice_id_fkey FOREIGN KEY (dataslice_id) REFERENCES public.dataslice(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.thread_data
    ADD CONSTRAINT thread_data_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_driving_variable_id_fkey FOREIGN KEY (driving_variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_model_execution
    ADD CONSTRAINT thread_model_execution_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.execution(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_model_execution_summary
    ADD CONSTRAINT thread_model_execution_summary_thread_model_id_fkey FOREIGN KEY (thread_model_id) REFERENCES public.thread_model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_model_execution
    ADD CONSTRAINT thread_model_execution_thread_model_id_fkey FOREIGN KEY (thread_model_id) REFERENCES public.thread_model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_model_io
    ADD CONSTRAINT thread_model_io_dataslice_id_fkey FOREIGN KEY (dataslice_id) REFERENCES public.dataslice(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.thread_model_io
    ADD CONSTRAINT thread_model_io_model_io_id_fkey FOREIGN KEY (model_io_id) REFERENCES public.model_io(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.thread_model_io
    ADD CONSTRAINT thread_model_io_thread_model_id_fkey FOREIGN KEY (thread_model_id) REFERENCES public.thread_model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_model
    ADD CONSTRAINT thread_model_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_parameter_id_fkey FOREIGN KEY (model_parameter_id) REFERENCES public.model_parameter(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.thread_model_parameter
    ADD CONSTRAINT thread_model_parameter_thread_model_id_fkey FOREIGN KEY (thread_model_id) REFERENCES public.thread_model(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_model
    ADD CONSTRAINT thread_model_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_permission
    ADD CONSTRAINT thread_permission_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread_provenance
    ADD CONSTRAINT thread_provenance_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.thread(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.region(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_response_variable_id_fkey FOREIGN KEY (response_variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.variable_category
    ADD CONSTRAINT variable_category_variable_id_fkey FOREIGN KEY (variable_id) REFERENCES public.variable(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE ONLY public.variable
    ADD CONSTRAINT variable_intervention_id_fkey FOREIGN KEY (intervention_id) REFERENCES public.intervention(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
