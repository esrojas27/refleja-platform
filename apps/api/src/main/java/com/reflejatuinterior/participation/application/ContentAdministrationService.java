package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.program.*;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Transactional
public class ContentAdministrationService {
    private final OrganizationAccess access;
    private final OrganizationTenantContext tenant;
    private final ProgramDirectory programs;
    private final ProgramContent content;
    private final ProgramContentUsage usage;
    private final ProgramActivities activities;
    private final ActivityAssignments assignments;
    private final ActivityEvaluations surveys;
    private final Enrollments enrollments;

    ContentAdministrationService(OrganizationAccess access, OrganizationTenantContext tenant, ProgramDirectory programs,
            ProgramContent content, ProgramContentUsage usage, ProgramActivities activities,
            ActivityAssignments assignments, ActivityEvaluations surveys, Enrollments enrollments) {
        this.access = access; this.tenant = tenant; this.programs = programs; this.content = content;
        this.usage = usage; this.activities = activities; this.assignments = assignments; this.surveys = surveys; this.enrollments = enrollments;
    }

    public void editDimension(String subject, UUID org, UUID program, UUID id, long version, String name, String description, String request) {
        var actor = authorize(subject, org, program);
        node(org, program, ProgramContent.Kind.DIMENSION, id, version).requireVisible();
        content.editDimension(org, program, id, name, description);
        audit(actor, program, id, "DIMENSION_UPDATED", request);
    }
    public void editSession(String subject, UUID org, UUID program, UUID id, long version, String name, String objective, LocalDate date, String request) {
        var actor = authorize(subject, org, program);
        node(org, program, ProgramContent.Kind.SESSION, id, version).requireVisible();
        content.editSession(org, program, id, name, objective, date);
        audit(actor, program, id, "SESSION_UPDATED", request);
    }
    public void editActivity(String subject, UUID org, UUID program, UUID id, long version,
            String title, String instructions, String youtube, LocalDate date, String request) {
        var actor = authorize(subject, org, program);
        var node = node(org, program, ProgramContent.Kind.ACTIVITY, id, version); node.requireVisible();
        var old = source(org, program, id);
        if (started(org, program, node.activityIds()) && !old.instructions().equals(instructions == null ? null : instructions.trim()))
            throw new ProgramContent.Conflict("CONTENT_HAS_SUBMISSIONS");
        content.editActivity(org, program, id, title, instructions, youtube, date);
        audit(actor, program, id, "ACTIVITY_UPDATED", request);
    }
    public ActivityEvaluations.Evaluation editSurvey(String subject, UUID org, UUID program, UUID activity,
            long version, String title, String instructions, List<ActivityEvaluations.QuestionInput> questions, String request) {
        var actor = authorize(subject, org, program);
        var node = content.describe(org, program, ProgramContent.Kind.ACTIVITY, activity); node.requireVisible();
        if (started(org, program, node.activityIds())) throw new ProgramContent.Conflict("CONTENT_HAS_SUBMISSIONS");
        var result = surveys.replace(org, program, activity, version, title, instructions, questions);
        audit(actor, program, activity, "SURVEY_UPDATED", request); return result;
    }
    public void archive(String subject, UUID org, UUID program, String kindPath, UUID id, long version, boolean archived, String request) {
        var actor = authorize(subject, org, program); var kind = ProgramContent.Kind.parse(kindPath);
        var node = node(org, program, kind, id, version);
        if (node.parentArchived()) throw new ProgramContent.Conflict("CONTENT_PARENT_ARCHIVED");
        if (archived && started(org, program, node.activityIds())) throw new ProgramContent.Conflict("CONTENT_HAS_SUBMISSIONS");
        content.archive(org, program, kind, id, archived);
        audit(actor, program, id, archived ? "CONTENT_ARCHIVED" : "CONTENT_RESTORED", request);
    }
    public void move(String subject, UUID org, UUID program, String kindPath, UUID id, long version, boolean up, String request) {
        var actor = authorize(subject, org, program); var kind = ProgramContent.Kind.parse(kindPath);
        node(org, program, kind, id, version).requireVisible();
        content.move(org, program, kind, id, up); audit(actor, program, id, "CONTENT_REORDERED", request);
    }
    public void remove(String subject, UUID org, UUID program, String kindPath, UUID id, long version, String request) {
        var actor = authorize(subject, org, program); var kind = ProgramContent.Kind.parse(kindPath);
        var node = node(org, program, kind, id, version);
        // Never delete a root or descendant with any assignment or response.
        // These checks and all child deletions share the program lock and transaction.
        if (usage.hasAssignments(org, program, node.activityIds()) || usage.hasResponses(org, program, node.activityIds()))
            throw new ProgramContent.Conflict("CONTENT_HAS_ASSIGNMENTS");
        surveys.deleteUnassignedDefinitions(org, program, node.activityIds());
        content.deleteUnassigned(org, program, kind, id);
        audit(actor, program, id, "UNASSIGNED_CONTENT_DELETED", request);
    }
    public UUID duplicate(String subject, UUID org, UUID program, UUID id, long version,
            boolean assignAll, List<UUID> selected, String request) {
        var actor = authorize(subject, org, program);
        node(org, program, ProgramContent.Kind.ACTIVITY, id, version).requireVisible();
        var source = source(org, program, id);
        var ids = new LinkedHashSet<>(selected);
        if (ids.size() != selected.size() || (assignAll && !ids.isEmpty())) throw new ProgramActivities.InvalidInput("enrollmentIds");
        var targets = assignAll ? enrollments.findAllActive(org, program) : enrollments.findActive(org, program, ids);
        if (!assignAll && targets.size() != ids.size()) throw new EnrollmentNotFound();
        int position = activities.listIncludingArchived(org, program).stream().filter(a -> a.sessionId().equals(source.sessionId()))
                .mapToInt(ProgramActivities.Activity::position).max().orElse(0) + 1;
        String title = source.title().substring(0, Math.min(247, source.title().length())) + " (copia)";
        var created = activities.create(org, program, source.sessionId(), title, source.instructions(), source.youtubeUrl(), source.dueDate(), position);
        if (!targets.isEmpty()) assignments.create(org, program, created.id(), targets.stream().map(Enrollments.Data::id).toList());
        surveys.find(org, program, id).ifPresent(survey -> surveys.create(org, program, created.id(), survey.title(), survey.instructions(),
                survey.questions().stream().map(q -> new ActivityEvaluations.QuestionInput(q.prompt(), q.type(), q.position())).toList()));
        audit(actor, program, created.id(), "ACTIVITY_DUPLICATED", request); return created.id();
    }

    private OrganizationAccess.Context authorize(String subject, UUID org, UUID program) {
        OrganizationAccess.Context actor;
        try { actor = access.resolve(subject, org); }
        catch (OrganizationAccess.Unavailable e) { throw new ProgramActivities.Missing(); }
        if (!actor.roles().contains("CONSULTANT")) throw new OrganizationAccess.Denied();
        tenant.activate(actor.organizationId());
        programs.lock(org, program).orElseThrow(ProgramActivities.Missing::new).requireEditable();
        return actor;
    }
    private ProgramContent.Node node(UUID org, UUID program, ProgramContent.Kind kind, UUID id, long version) {
        var node = content.describe(org, program, kind, id); node.expect(version); return node;
    }
    private ProgramActivities.Activity source(UUID org, UUID program, UUID id) {
        return activities.listIncludingArchived(org, program).stream().filter(a -> a.id().equals(id))
                .findFirst().orElseThrow(ProgramActivities.Missing::new);
    }
    private boolean started(UUID org, UUID program, List<UUID> ids) {
        return usage.hasResponses(org, program, ids) || assignments.listByActivities(org, program, ids).stream().anyMatch(a -> a.submittedAt() != null);
    }
    private static void audit(OrganizationAccess.Context actor, UUID program, UUID resource, String action, String request) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(ContentAdministrationService.class).info(
                        "action={} actor={} organization={} program={} resourceId={} requestId={} timestamp={} result=SUCCESS",
                        action, actor.userId(), actor.organizationId(), program, resource, request, Instant.now());
            }
        });
    }
}
