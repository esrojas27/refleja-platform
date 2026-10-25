CREATE TABLE rti.questionnaire_templates (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    source_organization_id UUID NOT NULL REFERENCES rti.organizations(id) ON DELETE RESTRICT,
    source_program_id UUID NOT NULL,
    source_evaluation_id UUID NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES rti.users(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_questionnaire_templates_name CHECK (length(btrim(name)) BETWEEN 1 AND 255),
    CONSTRAINT ck_questionnaire_templates_snapshot CHECK (jsonb_typeof(snapshot)='object'),
    CONSTRAINT fk_questionnaire_templates_source_program FOREIGN KEY(source_organization_id,source_program_id)
        REFERENCES rti.programs(organization_id,id) ON DELETE RESTRICT
);
-- Definitions are independent snapshots: deliberately no FK to a deletable source evaluation.
CREATE UNIQUE INDEX uq_questionnaire_templates_name ON rti.questionnaire_templates(lower(name));
CREATE INDEX ix_questionnaire_templates_catalog ON rti.questionnaire_templates(created_at DESC,id DESC);
ALTER TABLE rti.questionnaire_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY questionnaire_templates_global_read ON rti.questionnaire_templates FOR SELECT TO rti_app USING(true);
CREATE POLICY questionnaire_templates_source_insert ON rti.questionnaire_templates FOR INSERT TO rti_app
    WITH CHECK(source_organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
-- Only the authenticated consultant application service exposes this global catalog.
GRANT SELECT,INSERT ON rti.questionnaire_templates TO rti_app;
