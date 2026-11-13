CREATE TABLE domus_accounts (
    id text PRIMARY KEY REFERENCES organization(id),
    owner_user_id text NOT NULL UNIQUE REFERENCES "user"(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE properties (
    account_id text NOT NULL REFERENCES domus_accounts(id),
    id text NOT NULL,
    data jsonb NOT NULL,
    cold_rent_cents bigint,
    utilities_cents bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id)
);
CREATE TABLE tenants (
    account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL, data jsonb NOT NULL,
    property_id text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id),
    FOREIGN KEY (account_id, property_id) REFERENCES properties(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE documents (
    account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL, data jsonb NOT NULL,
    property_id text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id),
    FOREIGN KEY (account_id, property_id) REFERENCES properties(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE document_files (
    account_id text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
    bytes bigint NOT NULL CHECK (bytes > 0),
    hash text NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
    object_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id), UNIQUE (object_key),
    CHECK (starts_with(object_key, account_id || '/')),
    FOREIGN KEY (account_id, id) REFERENCES documents(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE rentals (
    account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL, data jsonb NOT NULL,
    property_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id),
    FOREIGN KEY (account_id, property_id) REFERENCES properties(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE rental_applications (
    account_id text NOT NULL, id text NOT NULL, data jsonb NOT NULL, rental_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id), UNIQUE (account_id, rental_id, id),
    FOREIGN KEY (account_id, rental_id) REFERENCES rentals(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE rental_viewings (
    account_id text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
    rental_id text NOT NULL, application_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id),
    FOREIGN KEY (account_id, rental_id, application_id) REFERENCES rental_applications(account_id, rental_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE leases (
    account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL, data jsonb NOT NULL,
    property_id text NOT NULL, rental_id text, contract_document_id text,
    start_date date NOT NULL, end_date date,
    cold_rent_cents bigint NOT NULL CHECK (cold_rent_cents >= 0),
    utilities_cents bigint NOT NULL CHECK (utilities_cents >= 0),
    deposit_cents bigint NOT NULL CHECK (deposit_cents >= 0),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id), UNIQUE (account_id, rental_id),
    CHECK (end_date IS NULL OR end_date >= start_date),
    FOREIGN KEY (account_id, property_id) REFERENCES properties(account_id, id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (account_id, rental_id) REFERENCES rentals(account_id, id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (account_id, contract_document_id) REFERENCES documents(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE lease_parties (
    account_id text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
    lease_id text NOT NULL, tenant_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id), UNIQUE (account_id, lease_id, tenant_id),
    FOREIGN KEY (account_id, lease_id) REFERENCES leases(account_id, id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (account_id, tenant_id) REFERENCES tenants(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE issues (
    account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL, data jsonb NOT NULL,
    property_id text, tenant_id text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id),
    FOREIGN KEY (account_id, property_id) REFERENCES properties(account_id, id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (account_id, tenant_id) REFERENCES tenants(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE costs (
    account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL, data jsonb NOT NULL,
    amount_cents bigint NOT NULL CHECK (amount_cents >= 0), due_date date, paid_date date,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id)
);
CREATE TABLE cost_links (
    account_id text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
    cost_id text NOT NULL, tenant_id text, property_id text, issue_id text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id),
    CHECK (num_nonnulls(tenant_id, property_id, issue_id) = 1),
    FOREIGN KEY (account_id, cost_id) REFERENCES costs(account_id, id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (account_id, tenant_id) REFERENCES tenants(account_id, id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (account_id, property_id) REFERENCES properties(account_id, id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (account_id, issue_id) REFERENCES issues(account_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE contacts (
    account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL, data jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, id)
);
CREATE TABLE audit_log (
    account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL,
    user_id text NOT NULL, action text NOT NULL, entity text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (account_id, id)
);
CREATE TABLE domus_imports (
    account_id text NOT NULL REFERENCES domus_accounts(id),
    source_hash text NOT NULL, manifest jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, source_hash)
);

-- FORCE also protects connections accidentally made with the table-owner role.
DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['domus_accounts', 'properties', 'tenants', 'documents', 'document_files', 'rentals', 'rental_applications', 'rental_viewings', 'leases', 'lease_parties', 'issues', 'costs', 'cost_links', 'contacts', 'audit_log', 'domus_imports']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format('CREATE POLICY account_isolation ON %I USING (%I = nullif(current_setting(''app.account_id'', true), '''')) WITH CHECK (%I = nullif(current_setting(''app.account_id'', true), ''''))', table_name, CASE WHEN table_name = 'domus_accounts' THEN 'id' ELSE 'account_id' END, CASE WHEN table_name = 'domus_accounts' THEN 'id' ELSE 'account_id' END);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO domus_runtime', table_name);
    END LOOP;
END $$;
