BEGIN;
SELECT pg_advisory_xact_lock(72651020);
CREATE TABLE IF NOT EXISTS werkz_business_state (
  organisation_id text PRIMARY KEY,
  state jsonb NOT NULL CHECK (jsonb_typeof(state)='object' AND state->>'schemaVersion'='1'),
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE werkz_business_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE werkz_business_state FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=current_schema() AND tablename='werkz_business_state' AND policyname='werkz_business_tenant') THEN
    CREATE POLICY werkz_business_tenant ON werkz_business_state
      USING (organisation_id=current_setting('werkz.organisation_id',true))
      WITH CHECK (organisation_id=current_setting('werkz.organisation_id',true));
  END IF;
END $$;
COMMIT;
