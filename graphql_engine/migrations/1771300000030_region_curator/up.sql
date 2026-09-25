CREATE TABLE public.region_curator (
    tenant_id text NOT NULL,
    username text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT region_curator_pkey PRIMARY KEY (tenant_id, username),
    CONSTRAINT region_curator_identity_nonempty CHECK (length(trim(tenant_id)) > 0 AND length(trim(username)) > 0)
);
