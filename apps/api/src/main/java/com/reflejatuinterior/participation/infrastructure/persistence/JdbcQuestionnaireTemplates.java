package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.QuestionnaireTemplates;
import com.reflejatuinterior.program.ProgramContent;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JdbcQuestionnaireTemplates implements QuestionnaireTemplates {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    JdbcQuestionnaireTemplates(JdbcTemplate jdbc, ObjectMapper json) { this.jdbc = jdbc; this.json = json; }

    @Override public Stored create(UUID org, UUID program, UUID evaluation, UUID actor, String name, String description, Snapshot snapshot) {
        var saved = jdbc.query("""
            INSERT INTO rti.questionnaire_templates(source_organization_id,source_program_id,source_evaluation_id,
                created_by_user_id,name,description,snapshot) VALUES(?,?,?,?,?,?,?::jsonb)
            ON CONFLICT(lower(name)) DO NOTHING RETURNING id,name,description,created_at
            """, (row,n) -> new Summary(row.getObject("id",UUID.class),row.getString("name"),row.getString("description"),
                snapshot.questions().size(),row.getTimestamp("created_at").toInstant()),
            org,program,evaluation,actor,name,description,json.writeValueAsString(snapshot));
        if(saved.isEmpty()) throw new ProgramContent.Conflict("QUESTIONNAIRE_TEMPLATE_NAME_EXISTS");
        return new Stored(saved.getFirst(),snapshot);
    }
    @Override public Page list(int page, int size) {
        var total = jdbc.queryForObject("SELECT count(*) FROM rti.questionnaire_templates",Long.class);
        var items = jdbc.query("""
            SELECT id,name,description,created_at,jsonb_array_length(snapshot->'questions') question_count
            FROM rti.questionnaire_templates ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?
            """, (row,n) -> new Summary(row.getObject("id",UUID.class),row.getString("name"),row.getString("description"),
                row.getInt("question_count"),row.getTimestamp("created_at").toInstant()),size,(long)page*size);
        return new Page(items,page,size,total,(int)((total+size-1)/size));
    }
    @Override public Optional<Stored> find(UUID id) {
        return jdbc.query("SELECT id,name,description,created_at,snapshot FROM rti.questionnaire_templates WHERE id=?",(row,n) -> {
            var snapshot=json.readValue(row.getString("snapshot"),Snapshot.class);
            return new Stored(new Summary(row.getObject("id",UUID.class),row.getString("name"),row.getString("description"),
                snapshot.questions().size(),row.getTimestamp("created_at").toInstant()),snapshot);
        },id).stream().findFirst();
    }
}
