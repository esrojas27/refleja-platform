package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityAssignments;
import com.reflejatuinterior.participation.application.Notifications;
import com.reflejatuinterior.participation.application.Notifications.Kind;
import com.reflejatuinterior.participation.domain.ActivityReviewDecision;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaActivityAssignments implements ActivityAssignments {
    private final ActivityAssignmentJpaRepository repository;
    private final Notifications notifications;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    JpaActivityAssignments(ActivityAssignmentJpaRepository repository, Notifications notifications,org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.repository = repository; this.notifications = notifications; this.jdbc=jdbc;
    }

    private List<Data> create(UUID organizationId, UUID programId, UUID activityId,
            Collection<UUID> enrollmentIds) {
        var entities = enrollmentIds.stream()
                .map(enrollmentId -> {
                    var entity=new ActivityAssignmentJpaEntity(organizationId,programId,activityId,enrollmentId);
                    var dates=jdbc.queryForList("""
                            SELECT c.scheduled_date+3 FROM rti.session_schedules c JOIN rti.program_activities d
                            ON d.organization_id=c.organization_id AND d.session_id=c.session_id
                            WHERE c.organization_id=? AND c.program_id=? AND d.id=? AND c.enrollment_id=?
                            """,java.sql.Date.class,organizationId,programId,activityId,enrollmentId);
                    entity.deadline(dates.isEmpty()?null:dates.getFirst().toLocalDate());return entity;
                })
                .toList();
        var saved = repository.saveAllAndFlush(entities);
        saved.forEach(entity -> notifications.record(organizationId,entity.id(),Kind.ACTIVITY_ASSIGNED));
        return saved.stream().map(JpaActivityAssignments::data).toList();
    }

    @Override
    public List<Data> assignScheduledActivity(UUID organizationId, UUID programId, UUID activityId) {
        return assignScheduled(organizationId, programId, " AND d.id=:activity",
                new org.springframework.jdbc.core.namedparam.MapSqlParameterSource("activity", activityId));
    }

    @Override
    public void assignScheduledSession(UUID organizationId, UUID programId, UUID sessionId, Collection<UUID> enrollmentIds) {
        if (enrollmentIds.isEmpty()) return;
        assignScheduled(organizationId, programId, " AND d.session_id=:session AND c.enrollment_id IN (:enrollments)",
                new org.springframework.jdbc.core.namedparam.MapSqlParameterSource("session", sessionId).addValue("enrollments", enrollmentIds));
    }

    // Callers hold the program lock: creation, agenda changes and restoration cannot
    // race. Only missing pairs are inserted; existing work and notifications survive.
    private List<Data> assignScheduled(UUID org, UUID program, String filter,
            org.springframework.jdbc.core.namedparam.MapSqlParameterSource params) {
        record Target(UUID activity, UUID enrollment) {}
        var targets = new org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate(jdbc).query("""
                SELECT d.id activity_id,c.enrollment_id FROM rti.program_activities d
                JOIN rti.program_sessions s ON s.organization_id=d.organization_id AND s.program_id=d.program_id AND s.id=d.session_id
                JOIN rti.program_modules m ON m.organization_id=d.organization_id AND m.program_id=d.program_id AND m.id=d.module_id
                JOIN rti.session_schedules c ON c.organization_id=d.organization_id AND c.program_id=d.program_id AND c.session_id=d.session_id
                JOIN rti.enrollments e ON e.organization_id=c.organization_id AND e.program_id=c.program_id AND e.id=c.enrollment_id
                JOIN rti.organization_memberships om ON om.organization_id=e.organization_id AND om.id=e.participant_membership_id
                JOIN rti.users u ON u.id=om.user_id
                WHERE d.organization_id=:org AND d.program_id=:program AND NOT d.archived AND NOT s.archived AND NOT m.archived
                AND e.status IN ('INVITED','ACTIVE') AND om.status IN ('PENDING','ACTIVE') AND u.status IN ('INVITED','ACTIVE')
                AND NOT EXISTS(SELECT FROM rti.activity_assignments a WHERE a.organization_id=d.organization_id
                    AND a.program_id=d.program_id AND a.activity_id=d.id AND a.enrollment_id=c.enrollment_id)
                """ + filter + " ORDER BY d.id,c.enrollment_id", params.addValue("org",org).addValue("program",program),
                (row,index) -> new Target(row.getObject("activity_id",UUID.class),row.getObject("enrollment_id",UUID.class)));
        var created = new java.util.ArrayList<Data>();
        targets.stream().collect(java.util.stream.Collectors.groupingBy(Target::activity)).forEach((activity, people) ->
                created.addAll(create(org,program,activity,people.stream().map(Target::enrollment).toList())));
        return List.copyOf(created);
    }

    @Override
    public List<Data> listByActivities(UUID organizationId, UUID programId, Collection<UUID> activityIds) {
        if (activityIds.isEmpty()) return List.of();
        return repository.findByOrganizationIdAndProgramIdAndActivityIdInOrderByActivityIdAscEnrollmentIdAsc(
                organizationId, programId, activityIds).stream().map(JpaActivityAssignments::data).toList();
    }

    @Override
    public List<Data> listOwned(UUID organizationId, UUID programId, UUID enrollmentId) {
        var visible=visible(organizationId,programId,enrollmentId);
        return repository.findByOrganizationIdAndProgramIdAndEnrollmentIdOrderByActivityIdAsc(
                organizationId, programId, enrollmentId).stream().filter(a->a.dueDate()!=null&&visible.contains(a.activityId())).map(JpaActivityAssignments::data).toList();
    }

    @Override
    public Optional<Data> submit(UUID organizationId, UUID programId, UUID activityId,
            UUID enrollmentId, String responseText) {
        if(!visible(organizationId,programId,enrollmentId).contains(activityId)) return Optional.empty();
        return repository.lockOwned(organizationId, programId, activityId, enrollmentId).map(entity -> {
            entity.submit(responseText);
            var saved=repository.saveAndFlush(entity);
            notifications.record(organizationId,saved.id(),Kind.SUBMISSION_RECEIVED);
            return data(saved);
        });
    }

    @Override
    public Optional<Data> review(UUID organizationId, UUID programId, UUID activityId,
            UUID assignmentId, ActivityReviewDecision decision, String comment, UUID reviewerId) {
        return repository.lockForReview(organizationId, programId, activityId, assignmentId).map(entity -> {
            entity.review(decision, comment, reviewerId);
            var saved=repository.saveAndFlush(entity);
            notifications.record(organizationId,saved.id(),decision==ActivityReviewDecision.APPROVE
                    ? Kind.ACTIVITY_APPROVED : Kind.CHANGES_REQUESTED);
            return data(saved);
        });
    }

    private static Data data(ActivityAssignmentJpaEntity entity) {
        return new Data(entity.id(), entity.organizationId(), entity.programId(),
                entity.activityId(), entity.enrollmentId(), entity.status().name(), entity.responseText(),
                entity.submittedAt(), entity.reviewComment(), entity.reviewedAt(), entity.reviewedBy(), entity.version(),entity.dueDate());
    }
    private java.util.Set<UUID> visible(UUID org,UUID program,UUID enrollment) {
        return new java.util.HashSet<>(jdbc.queryForList("""
                SELECT d.id FROM rti.program_activities d JOIN rti.session_schedules c
                ON c.organization_id=d.organization_id AND c.session_id=d.session_id
                JOIN rti.program_sessions s ON s.organization_id=d.organization_id AND s.id=d.session_id
                JOIN rti.program_modules m ON m.organization_id=d.organization_id AND m.id=d.module_id
                WHERE c.organization_id=? AND c.program_id=? AND c.enrollment_id=? AND NOT d.archived AND NOT s.archived AND NOT m.archived
                """,UUID.class,org,program,enrollment));
    }
}
