package com.reflejatuinterior.participation.infrastructure.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.Notifications;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Inbox projection with current authorization; never reads responses or DISC content. */
@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JdbcNotifications implements Notifications {
    private final NamedParameterJdbcTemplate jdbc;
    JdbcNotifications(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void record(UUID organizationId, UUID assignmentId, Kind kind) {
        jdbc.update("""
                INSERT INTO rti.activity_notifications
                    (organization_id,program_id,assignment_id,recipient_membership_id,kind,source_version)
                SELECT a.organization_id,a.program_id,a.id,m.id,:kind,
                    CASE WHEN :kind='SURVEY_PENDING' THEN 0 ELSE a.version END
                FROM rti.activity_assignments a
                JOIN rti.enrollments e ON e.organization_id=a.organization_id AND e.id=a.enrollment_id
                JOIN rti.organization_memberships m ON m.organization_id=a.organization_id AND m.status='ACTIVE'
                JOIN rti.users u ON u.id=m.user_id AND u.status='ACTIVE'
                WHERE a.organization_id=:org AND a.id=:assignment AND e.status='ACTIVE'
                AND ((:kind='SUBMISSION_RECEIVED' AND EXISTS(SELECT FROM rti.membership_roles r WHERE r.membership_id=m.id AND r.role='CONSULTANT'))
                  OR (:kind<>'SUBMISSION_RECEIVED' AND m.id=e.participant_membership_id
                    AND EXISTS(SELECT FROM rti.membership_roles r WHERE r.membership_id=m.id AND r.role='COLLABORATOR')))
                AND (:kind<>'SURVEY_PENDING' OR (
                    EXISTS(SELECT FROM rti.activity_evaluations v WHERE v.organization_id=a.organization_id AND v.activity_id=a.activity_id)
                    AND NOT EXISTS(SELECT FROM rti.activity_evaluation_responses v WHERE v.organization_id=a.organization_id AND v.assignment_id=a.id)))
                ON CONFLICT ON CONSTRAINT uq_activity_notifications_event DO NOTHING
                """, new MapSqlParameterSource("org",organizationId).addValue("assignment",assignmentId).addValue("kind",kind.name()));
    }

    private static final String VISIBLE = """
            FROM rti.activity_notifications n
            JOIN rti.organization_memberships m ON m.organization_id=n.organization_id AND m.id=n.recipient_membership_id
            JOIN rti.users u ON u.id=m.user_id
            JOIN rti.organizations o ON o.id=n.organization_id
            JOIN rti.programs p ON p.organization_id=n.organization_id AND p.id=n.program_id
            JOIN rti.activity_assignments a ON a.organization_id=n.organization_id AND a.id=n.assignment_id
            JOIN rti.enrollments e ON e.organization_id=a.organization_id AND e.id=a.enrollment_id
            JOIN rti.organization_memberships owner ON owner.organization_id=e.organization_id AND owner.id=e.participant_membership_id
            JOIN rti.users participant ON participant.id=owner.user_id
            JOIN rti.program_activities act ON act.organization_id=a.organization_id AND act.id=a.activity_id
            JOIN rti.program_sessions s ON s.organization_id=act.organization_id AND s.id=act.session_id
            JOIN rti.program_modules d ON d.organization_id=act.organization_id AND d.id=act.module_id
            WHERE n.organization_id=:org AND m.user_id=:user AND m.status='ACTIVE' AND u.status='ACTIVE'
              AND o.status='ACTIVE' AND p.status='ACTIVE' AND e.status='ACTIVE'
              AND owner.status='ACTIVE' AND participant.status='ACTIVE'
              AND EXISTS(SELECT FROM rti.membership_roles r WHERE r.membership_id=owner.id AND r.role='COLLABORATOR')
              AND NOT act.archived AND NOT s.archived AND NOT d.archived
              AND EXISTS(SELECT FROM rti.session_schedules c WHERE c.organization_id=a.organization_id AND c.session_id=s.id AND c.enrollment_id=a.enrollment_id)
              AND ((n.kind='SUBMISSION_RECEIVED' AND a.status='SUBMITTED' AND a.version=n.source_version
                AND EXISTS(SELECT FROM rti.membership_roles r WHERE r.membership_id=m.id AND r.role='CONSULTANT'))
                OR (n.kind<>'SUBMISSION_RECEIVED' AND m.id=e.participant_membership_id AND m.profile_status='COMPLETE'
                  AND EXISTS(SELECT FROM rti.membership_roles r WHERE r.membership_id=m.id AND r.role='COLLABORATOR')))
              AND (n.kind<>'SURVEY_PENDING' OR NOT EXISTS(
                  SELECT FROM rti.activity_evaluation_responses v WHERE v.organization_id=n.organization_id AND v.assignment_id=n.assignment_id))
            """;

    private MapSqlParameterSource params(UUID org, UUID user) {
        return new MapSqlParameterSource("org",org).addValue("user",user);
    }
    public List<Item> list(UUID org, UUID user, Instant before, UUID beforeId, int limit) {
        var cursor = before == null ? "" : " AND (n.created_at<:before OR (n.created_at=:before AND n.id<:beforeId))";
        var parameters = params(org,user).addValue("limit",limit);
        if (before != null) parameters.addValue("before",Timestamp.from(before)).addValue("beforeId",beforeId);
        return jdbc.query("SELECT n.*,o.name organization_name,p.name program_name,act.id activity_id,act.title activity_title, "
                + "CASE WHEN n.kind='SUBMISSION_RECEIVED' THEN COALESCE(NULLIF(participant.full_name,''), "
                + "NULLIF(trim(concat_ws(' ',participant.first_name,participant.last_name)),''),participant.email) END participant_name "
                + VISIBLE + cursor + " ORDER BY n.created_at DESC,n.id DESC LIMIT :limit", parameters, (rs,i) ->
                new Item(rs.getObject("id",UUID.class),org,rs.getString("organization_name"),rs.getObject("program_id",UUID.class),
                    rs.getString("program_name"),rs.getObject("activity_id",UUID.class),rs.getString("activity_title"),
                    rs.getObject("assignment_id",UUID.class),Kind.valueOf(rs.getString("kind")),rs.getString("participant_name"),
                    rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("read_at")==null?null:rs.getTimestamp("read_at").toInstant(),null,null,null,null));
    }
    public long unreadCount(UUID org, UUID user) {
        return jdbc.queryForObject("SELECT count(*) " + VISIBLE + " AND n.read_at IS NULL",params(org,user),Long.class);
    }
    public boolean markRead(UUID org, UUID user, UUID id) {
        return jdbc.update("UPDATE rti.activity_notifications SET read_at=COALESCE(read_at,now()) WHERE organization_id=:org AND id IN (SELECT n.id "
                + VISIBLE + " AND n.id=:id)",params(org,user).addValue("id",id)) == 1;
    }
}
