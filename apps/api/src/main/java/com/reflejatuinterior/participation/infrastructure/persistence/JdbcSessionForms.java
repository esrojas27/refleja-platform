package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.UUID;
import com.reflejatuinterior.participation.application.SessionForms;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation=Propagation.MANDATORY)
class JdbcSessionForms implements SessionForms {
    private final JdbcTemplate jdbc;
    JdbcSessionForms(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @Override public java.util.List<UUID> containedSessions(UUID org,UUID program,String kind,UUID id){
        if(kind.equals("activities"))return java.util.List.of();
        return jdbc.queryForList("SELECT id FROM rti.program_sessions WHERE organization_id=? AND program_id=? AND "+(kind.equals("sessions")?"id=?":"module_id=?"),UUID.class,org,program,id);
    }
    @Override public String missing(UUID org,UUID program,UUID session){
        var items=jdbc.queryForList("""
            SELECT CASE
              WHEN NOT EXISTS(SELECT FROM rti.program_activities a WHERE a.organization_id=s.organization_id AND a.session_id=s.id AND NOT a.archived) THEN 'SESSION_MISSING_ACTIVITIES'
              WHEN EXISTS(SELECT FROM rti.program_activities a WHERE a.organization_id=s.organization_id AND a.session_id=s.id AND NOT a.archived
                AND NOT EXISTS(SELECT FROM rti.activity_evaluations f WHERE f.organization_id=a.organization_id AND f.activity_id=a.id)) THEN 'SESSION_MISSING_ACTIVITY_FORM'
              WHEN s.objective IS NULL OR btrim(s.objective)='' THEN 'SESSION_MISSING_CLOSING_COMMENT'
              WHEN NOT EXISTS(SELECT FROM rti.activity_evaluations f WHERE f.organization_id=s.organization_id AND f.session_id=s.id) THEN 'SESSION_MISSING_CLOSING_SURVEY'
              ELSE '' END FROM rti.program_sessions s WHERE s.organization_id=? AND s.program_id=? AND s.id=?
            """,String.class,org,program,session);
        return items.isEmpty()?"SESSION_NOT_FOUND":items.getFirst();
    }
    @Override public boolean hasStarted(UUID org,UUID program,UUID session){
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT FROM rti.session_closure_acknowledgements WHERE organization_id=? AND program_id=? AND session_id=?)",Boolean.class,org,program,session));
    }
    @Override public boolean hasClosed(UUID org,UUID program,UUID session){
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT FROM rti.activity_evaluation_responses WHERE organization_id=? AND program_id=? AND session_id=?)",Boolean.class,org,program,session));
    }
    @Override public boolean isClosed(UUID org,UUID program,UUID session,UUID enrollment){
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT FROM rti.activity_evaluation_responses WHERE organization_id=? AND program_id=? AND session_id=? AND enrollment_id=?)",Boolean.class,org,program,session,enrollment));
    }
    @Override public State state(UUID org,UUID program,UUID session,UUID enrollment){
        return jdbc.queryForObject("""
            SELECT count(*)::int total,
              count(*) FILTER(WHERE a.status IN ('SUBMITTED','COMPLETED') AND EXISTS(SELECT FROM rti.activity_evaluation_responses r WHERE r.organization_id=a.organization_id AND r.assignment_id=a.id))::int submitted,
              EXISTS(SELECT FROM rti.session_closure_acknowledgements c WHERE c.organization_id=? AND c.session_id=? AND c.enrollment_id=?) acknowledged,
              EXISTS(SELECT FROM rti.activity_evaluation_responses c WHERE c.organization_id=? AND c.program_id=? AND c.session_id=? AND c.enrollment_id=?) completed
            FROM rti.program_activities d LEFT JOIN rti.activity_assignments a ON a.organization_id=d.organization_id AND a.activity_id=d.id AND a.enrollment_id=?
            JOIN rti.program_sessions s ON s.organization_id=d.organization_id AND s.id=d.session_id
            JOIN rti.program_modules m ON m.organization_id=d.organization_id AND m.id=d.module_id
            WHERE d.organization_id=? AND d.program_id=? AND d.session_id=? AND NOT d.archived AND NOT s.archived AND NOT m.archived
            """,(r,n)->new State(r.getInt("total"),r.getInt("submitted"),r.getBoolean("acknowledged"),r.getBoolean("completed")),
            org,session,enrollment,org,program,session,enrollment,enrollment,org,program,session);
    }
    @Override public void acknowledge(UUID org,UUID program,UUID session,UUID enrollment){
        jdbc.update("INSERT INTO rti.session_closure_acknowledgements(organization_id,program_id,session_id,enrollment_id) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",org,program,session,enrollment);
    }
}
