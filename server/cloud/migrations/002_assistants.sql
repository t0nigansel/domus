ALTER TABLE domus_accounts ADD COLUMN deleting boolean NOT NULL DEFAULT false;
CREATE TABLE user_settings (
 account_id text NOT NULL REFERENCES domus_accounts(id), user_id text NOT NULL REFERENCES "user"(id),
 data jsonb NOT NULL DEFAULT '{}', PRIMARY KEY(account_id, user_id)
);
CREATE TABLE llm_connections (
 account_id text NOT NULL REFERENCES domus_accounts(id), user_id text NOT NULL REFERENCES "user"(id),
 provider text NOT NULL CHECK(provider IN ('openai','anthropic','google')), model text NOT NULL,
 secret jsonb NOT NULL, tested boolean NOT NULL DEFAULT false,
 PRIMARY KEY(account_id, user_id, provider)
);
CREATE TABLE assistant_records (
 account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('buildings','exposes','utility-statements')),
 data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,id)
);
CREATE INDEX assistant_records_kind ON assistant_records(account_id,kind);
CREATE TABLE assistant_jobs (
 account_id text NOT NULL REFERENCES domus_accounts(id), id text NOT NULL, user_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('expose','analysis','pdf','statement-pdfs','statement-zip','export','delete')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
 input jsonb NOT NULL, result jsonb NOT NULL DEFAULT '{}', error text,
 request_key text NOT NULL, object_key text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,id), UNIQUE(account_id,user_id,request_key)
);
CREATE UNIQUE INDEX one_active_ai_job ON assistant_jobs(account_id,user_id)
 WHERE kind IN ('expose','analysis') AND status IN ('queued','running');
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['user_settings','llm_connections','assistant_records','assistant_jobs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY account_isolation ON %I USING (account_id = nullif(current_setting(''app.account_id'',true),'''')) WITH CHECK (account_id = nullif(current_setting(''app.account_id'',true),''''))', t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO domus_runtime',t);
 END LOOP;
END $$;
