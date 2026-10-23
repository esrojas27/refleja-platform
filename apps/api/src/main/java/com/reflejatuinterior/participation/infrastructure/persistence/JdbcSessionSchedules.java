package com.reflejatuinterior.participation.infrastructure.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation=Propagation.MANDATORY)
class JdbcSessionSchedules implements SessionSchedules {
    private final NamedParameterJdbcTemplate jdbc;
    JdbcSessionSchedules(NamedParameterJdbcTemplate jdbc) { this.jdbc=jdbc; }
    private MapSqlParameterSource params(UUID org, UUID program) { return new MapSqlParameterSource("org",org).addValue("program",program); }
    private static final String SESSIONS="""
            FROM rti.program_sessions s JOIN rti.program_modules d ON d.organization_id=s.organization_id AND d.id=s.module_id
            WHERE s.organization_id=:org AND s.program_id=:program AND NOT s.archived AND NOT d.archived
            """;
    private Session session(ResultSet r) throws SQLException {
        return new Session(r.getObject("id",UUID.class),r.getObject("module_id",UUID.class),r.getString("dimension_name"),
                r.getString("name"),r.getString("objective"),r.getInt("dimension_position"),r.getInt("position"));
    }
    public List<Session> sessions(UUID org, UUID program) {
        return jdbc.query("SELECT s.*,d.name dimension_name,d.position dimension_position "+SESSIONS+" ORDER BY d.position,s.position,s.id",params(org,program),(r,i)->session(r));
    }
    public List<Person> participants(UUID org,UUID program,UUID session) {
        return jdbc.query("""
                SELECT e.id,e.status,u.email,COALESCE(NULLIF(u.full_name,''),NULLIF(trim(concat_ws(' ',u.first_name,u.last_name)),''),u.email) name,
                    u.status IN ('ACTIVE','INVITED') AND m.status IN ('ACTIVE','PENDING') enabled,c.scheduled_date,c.version
                FROM rti.enrollments e JOIN rti.organization_memberships m ON m.organization_id=e.organization_id AND m.id=e.participant_membership_id
                JOIN rti.users u ON u.id=m.user_id
                LEFT JOIN rti.session_schedules c ON c.organization_id=e.organization_id AND c.session_id=:session AND c.enrollment_id=e.id
                WHERE e.organization_id=:org AND e.program_id=:program AND e.status IN ('INVITED','ACTIVE','COMPLETED','SUSPENDED')
                ORDER BY name,e.id
                """,params(org,program).addValue("session",session),(r,i)->new Person(r.getObject("id",UUID.class),r.getString("email"),r.getString("name"),
                r.getString("status"),r.getBoolean("enabled"),r.getObject("scheduled_date",LocalDate.class),(Long)r.getObject("version")));
    }
    public List<OwnedSession> owned(UUID org,UUID program,UUID enrollment) {
        return jdbc.query("SELECT s.*,d.name dimension_name,d.position dimension_position "+
                SESSIONS+" AND EXISTS(SELECT FROM rti.session_schedules x WHERE x.organization_id=s.organization_id AND x.session_id=s.id AND x.enrollment_id=:enrollment)"+
                " ORDER BY d.position,s.position,s.id",params(org,program).addValue("enrollment",enrollment),(r,i)->new OwnedSession(session(r),date(org,program,r.getObject("id",UUID.class),enrollment)));
    }
    private LocalDate date(UUID org,UUID program,UUID session,UUID enrollment) {
        return jdbc.queryForObject("SELECT scheduled_date FROM rti.session_schedules WHERE organization_id=:org AND program_id=:program AND session_id=:session AND enrollment_id=:enrollment",
                params(org,program).addValue("session",session).addValue("enrollment",enrollment),LocalDate.class);
    }
    public void save(UUID org,UUID program,UUID session,Person person,LocalDate date,UUID actor,String actorLabel,String reason,String request) {
        var p=params(org,program).addValue("session",session).addValue("enrollment",person.enrollmentId())
                .addValue("date",date).addValue("previous",person.scheduledDate()).addValue("actor",actor).addValue("label",actorLabel)
                .addValue("reason",reason).addValue("request",request).addValue("version",person.version()==null?0:person.version()+1)
                .addValue("source",person.scheduledDate()==null?"ASSIGNED":"RESCHEDULED");
        if(person.scheduledDate()==null) jdbc.update("INSERT INTO rti.session_schedules(organization_id,program_id,session_id,enrollment_id,scheduled_date) VALUES(:org,:program,:session,:enrollment,:date)",p);
        else jdbc.update("UPDATE rti.session_schedules SET scheduled_date=:date,version=:version WHERE organization_id=:org AND session_id=:session AND enrollment_id=:enrollment",p);
        UUID revision=jdbc.queryForObject("""
                INSERT INTO rti.session_schedule_history(organization_id,program_id,session_id,enrollment_id,previous_date,scheduled_date,version,actor_id,actor_label,reason,source,request_id)
                VALUES(:org,:program,:session,:enrollment,:previous,:date,:version,:actor,:label,:reason,:source,:request) RETURNING id
                """,p,UUID.class);
        jdbc.update("""
                UPDATE rti.activity_assignments a SET due_date=CAST(:date AS DATE)+3,version=a.version+1,updated_at=now()
                FROM rti.program_activities d WHERE d.organization_id=:org AND d.program_id=:program AND d.session_id=:session
                AND a.organization_id=d.organization_id AND a.activity_id=d.id AND a.enrollment_id=:enrollment AND a.status IN ('ASSIGNED','CHANGES_REQUESTED')
                """,p);
        if(person.scheduledDate()!=null) jdbc.update("""
                INSERT INTO rti.session_schedule_notifications(organization_id,revision_id,recipient_membership_id)
                SELECT organization_id,:revision,participant_membership_id FROM rti.enrollments WHERE organization_id=:org AND id=:enrollment
                """,p.addValue("revision",revision));
    }
    private static final String HISTORY=" FROM rti.session_schedule_history WHERE organization_id=:org AND program_id=:program AND session_id=:session AND enrollment_id=:enrollment ";
    public List<Revision> history(UUID org,UUID program,UUID session,UUID enrollment,int offset,int limit) {
        return jdbc.query("SELECT *"+HISTORY+" ORDER BY recorded_at DESC,id DESC OFFSET :offset LIMIT :limit",
                params(org,program).addValue("session",session).addValue("enrollment",enrollment).addValue("offset",offset).addValue("limit",limit),
                (r,i)->new Revision(r.getObject("id",UUID.class),enrollment,r.getObject("previous_date",LocalDate.class),r.getObject("scheduled_date",LocalDate.class),
                        r.getString("actor_label"),r.getString("reason"),r.getString("source"),r.getTimestamp("recorded_at").toInstant()));
    }
    public long countHistory(UUID org,UUID program,UUID session,UUID enrollment) {
        return jdbc.queryForObject("SELECT count(*)"+HISTORY,params(org,program).addValue("session",session).addValue("enrollment",enrollment),Long.class);
    }
    public boolean hasSchedules(UUID org,UUID program,String kind,UUID id) {
        return jdbc.queryForObject("SELECT EXISTS(SELECT FROM rti.session_schedules c JOIN rti.program_sessions s ON s.organization_id=c.organization_id AND s.id=c.session_id WHERE c.organization_id=:org AND c.program_id=:program AND "+
                ("sessions".equals(kind)?"s.id=:id":"s.module_id=:id")+")",params(org,program).addValue("id",id),Boolean.class);
    }
    private static final String INBOX="""
            FROM rti.session_schedule_notifications n JOIN rti.session_schedule_history h ON h.organization_id=n.organization_id AND h.id=n.revision_id
            JOIN rti.enrollments e ON e.organization_id=h.organization_id AND e.id=h.enrollment_id
            JOIN rti.organization_memberships m ON m.organization_id=n.organization_id AND m.id=n.recipient_membership_id AND m.id=e.participant_membership_id
            JOIN rti.users u ON u.id=m.user_id JOIN rti.organizations o ON o.id=m.organization_id
            JOIN rti.programs p ON p.organization_id=h.organization_id AND p.id=h.program_id
            JOIN rti.program_sessions s ON s.organization_id=h.organization_id AND s.id=h.session_id
            JOIN rti.program_modules d ON d.organization_id=s.organization_id AND d.id=s.module_id
            WHERE n.organization_id=:org AND m.user_id=:user AND m.status='ACTIVE' AND m.profile_status='COMPLETE'
            AND u.status='ACTIVE' AND o.status='ACTIVE' AND e.status='ACTIVE' AND p.status='ACTIVE' AND NOT s.archived AND NOT d.archived
            AND EXISTS(SELECT FROM rti.membership_roles r WHERE r.membership_id=m.id AND r.role='COLLABORATOR')
            """;
    public List<Notifications.Item> notifications(UUID org,UUID user,Instant before,UUID beforeId,int limit) {
        var p=new MapSqlParameterSource("org",org).addValue("user",user).addValue("limit",limit);
        String cursor="";
        if(before!=null) { cursor=" AND (n.created_at<:before OR (n.created_at=:before AND n.id<:beforeId))"; p.addValue("before",Timestamp.from(before)).addValue("beforeId",beforeId); }
        return jdbc.query("SELECT n.*,h.program_id,h.session_id,h.previous_date,h.scheduled_date,h.reason,o.name organization_name,p.name program_name,s.name session_name "+INBOX+cursor+
                " ORDER BY n.created_at DESC,n.id DESC LIMIT :limit",p,(r,i)->new Notifications.Item(r.getObject("id",UUID.class),org,r.getString("organization_name"),
                r.getObject("program_id",UUID.class),r.getString("program_name"),null,r.getString("session_name"),null,Notifications.Kind.SESSION_RESCHEDULED,null,
                r.getTimestamp("created_at").toInstant(),r.getTimestamp("read_at")==null?null:r.getTimestamp("read_at").toInstant(),
                r.getObject("session_id",UUID.class),r.getObject("previous_date",LocalDate.class),r.getObject("scheduled_date",LocalDate.class),r.getString("reason")));
    }
    public long unread(UUID org,UUID user) { return jdbc.queryForObject("SELECT count(*) "+INBOX+" AND n.read_at IS NULL",new MapSqlParameterSource("org",org).addValue("user",user),Long.class); }
    public boolean markRead(UUID org,UUID user,UUID id) {
        return jdbc.update("UPDATE rti.session_schedule_notifications SET read_at=COALESCE(read_at,now()) WHERE organization_id=:org AND id IN(SELECT n.id "+INBOX+" AND n.id=:id)",
                new MapSqlParameterSource("org",org).addValue("user",user).addValue("id",id))==1;
    }
}
