package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorAccess;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.domain.InvalidActivityAssignment;
import com.reflejatuinterior.participation.domain.ActivityReviewDecision;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ActivityService {
    private final OrganizationAccess organizationAccess;
    private final CollaboratorAccess collaboratorAccess;
    private final CollaboratorInvitations participants;
    private final ProgramDirectory programs;
    private final ProgramActivities activities;
    private final Enrollments enrollments;
    private final ActivityAssignments assignments;
    private final OrganizationTenantContext tenantContext;

    ActivityService(OrganizationAccess organizationAccess, CollaboratorAccess collaboratorAccess,
            CollaboratorInvitations participants, ProgramDirectory programs, ProgramActivities activities,
            Enrollments enrollments, ActivityAssignments assignments, OrganizationTenantContext tenantContext) {
        this.organizationAccess = organizationAccess;
        this.collaboratorAccess = collaboratorAccess;
        this.participants = participants;
        this.programs = programs;
        this.activities = activities;
        this.enrollments = enrollments;
        this.assignments = assignments;
        this.tenantContext = tenantContext;
    }

    @Transactional
    public ActivityResponse create(String subject, UUID organizationId, UUID programId, UUID sessionId,
            String title, String instructions, String youtubeUrl, LocalDate dueDate, int position,
            boolean assignToAll, List<UUID> enrollmentIds, String requestId) {
        var context = authorizeConsultant(subject, organizationId, programId, "CREATE_ACTIVITY", requestId);
        var uniqueEnrollmentIds = new LinkedHashSet<>(enrollmentIds);
        if ((assignToAll && !uniqueEnrollmentIds.isEmpty())
                || (!assignToAll && uniqueEnrollmentIds.isEmpty())
                || uniqueEnrollmentIds.size() != enrollmentIds.size()) {
            throw new InvalidActivityAssignment("enrollmentIds");
        }
        var activeEnrollments = assignToAll
                ? enrollments.findAllActive(context.organizationId(), programId)
                : enrollments.findActive(context.organizationId(), programId, uniqueEnrollmentIds);
        if (activeEnrollments.isEmpty()
                || (!assignToAll && activeEnrollments.size() != uniqueEnrollmentIds.size())) {
            throw new EnrollmentNotFound();
        }

        var activity = activities.create(context.organizationId(), programId, sessionId,
                title, instructions, youtubeUrl, dueDate, position);
        var createdAssignments = assignments.create(context.organizationId(), programId, activity.id(),
                activeEnrollments.stream().map(Enrollments.Data::id).toList());
        auditAfterCommit("PROGRAM_ACTIVITY_ASSIGNED", context.userId(), context.organizationId(), activity.id(), requestId);
        return response(activity, createdAssignments);
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> listForConsultant(String subject, UUID organizationId, UUID programId,
            String requestId) {
        authorizeConsultant(subject, organizationId, programId, "VIEW_PROGRAM_ACTIVITIES", requestId);
        var definitions = activities.list(organizationId, programId);
        var assigned = assignments.listByActivities(organizationId, programId,
                definitions.stream().map(ProgramActivities.Activity::id).toList());
        return definitions.stream().map(activity -> response(activity, assigned.stream()
                .filter(assignment -> assignment.activityId().equals(activity.id())).toList())).toList();
    }

    @Transactional(readOnly = true)
    public List<AssignedActivityResponse> listOwned(String subject, UUID programId, String requestId) {
        CollaboratorAccess.Context context;
        try {
            context = collaboratorAccess.resolve(subject);
        } catch (CollaboratorAccess.Denied exception) {
            denied(null, null, programId, "VIEW_ASSIGNED_ACTIVITIES", requestId);
            throw exception;
        }
        for (var membership : context.memberships().stream()
                .sorted(Comparator.comparing(CollaboratorAccess.Membership::organizationId)).toList()) {
            tenantContext.activate(membership.organizationId());
            var enrollment = enrollments.findOwned(membership.organizationId(), membership.id(), programId);
            if (enrollment.isEmpty()) continue;
            var ownedAssignments = assignments.listOwned(membership.organizationId(), programId, enrollment.get().id());
            var definitions = activities.findAll(membership.organizationId(), programId,
                    ownedAssignments.stream().map(ActivityAssignments.Data::activityId).toList());
            var assignmentsByActivity = ownedAssignments.stream().collect(java.util.stream.Collectors.toMap(
                    ActivityAssignments.Data::activityId, assignment -> assignment));
            return definitions.stream().map(activity -> AssignedActivityResponse.from(
                    activity, assignmentsByActivity.get(activity.id()))).toList();
        }
        denied(context.userId(), null, programId, "VIEW_ASSIGNED_ACTIVITIES", requestId);
        throw new MyProgramNotFound();
    }

    @Transactional
    public AssignedActivityResponse submit(String subject, UUID programId, UUID activityId,
            String responseText, String requestId) {
        var cleanResponse = responseText == null ? "" : responseText.trim();
        if (cleanResponse.isEmpty() || cleanResponse.length() > 10000) {
            throw new InvalidActivityAssignment("responseText");
        }
        CollaboratorAccess.Context context;
        try {
            context = collaboratorAccess.resolve(subject);
        } catch (CollaboratorAccess.Denied exception) {
            denied(null, null, programId, "SUBMIT_ACTIVITY", requestId);
            throw exception;
        }
        for (var membership : context.memberships().stream()
                .sorted(Comparator.comparing(CollaboratorAccess.Membership::organizationId)).toList()) {
            tenantContext.activate(membership.organizationId());
            var enrollment = enrollments.findOwned(membership.organizationId(), membership.id(), programId);
            if (enrollment.isEmpty()) continue;
            if (!"ACTIVE".equals(enrollment.get().status())) throw new ActivityWorkflowConflict();
            var submitted = assignments.submit(membership.organizationId(), programId, activityId,
                    enrollment.get().id(), cleanResponse).orElseThrow(ActivityAssignmentNotFound::new);
            var activity = activities.findAll(membership.organizationId(), programId, List.of(activityId)).stream()
                    .findFirst().orElseThrow(ActivityAssignmentNotFound::new);
            auditAfterCommit("PROGRAM_ACTIVITY_SUBMITTED", context.userId(), membership.organizationId(), activityId, requestId);
            return AssignedActivityResponse.from(activity, submitted);
        }
        denied(context.userId(), null, programId, "SUBMIT_ACTIVITY", requestId);
        throw new ActivityAssignmentNotFound();
    }

    @Transactional
    public AssigneeResponse review(String subject, UUID organizationId, UUID programId, UUID activityId,
            UUID assignmentId, ActivityReviewDecision decision, String comment, String requestId) {
        var context = authorizeConsultant(subject, organizationId, programId, "REVIEW_ACTIVITY", requestId);
        var cleanComment = comment == null || comment.isBlank() ? null : comment.trim();
        if ((decision == ActivityReviewDecision.REQUEST_CHANGES && cleanComment == null)
                || (cleanComment != null && cleanComment.length() > 5000)) {
            throw new InvalidActivityAssignment("comment");
        }
        var reviewed = assignments.review(context.organizationId(), programId, activityId, assignmentId,
                decision, cleanComment, context.userId()).orElseThrow(ActivityAssignmentNotFound::new);
        auditAfterCommit(decision == ActivityReviewDecision.APPROVE
                        ? "PROGRAM_ACTIVITY_COMPLETED" : "PROGRAM_ACTIVITY_CHANGES_REQUESTED",
                context.userId(), context.organizationId(), activityId, requestId);
        return assignee(context.organizationId(), programId, reviewed);
    }

    private OrganizationAccess.Context authorizeConsultant(String subject, UUID organizationId, UUID programId,
            String operation, String requestId) {
        OrganizationAccess.Context context;
        try {
            context = organizationAccess.resolve(subject, organizationId);
        } catch (OrganizationAccess.Unavailable exception) {
            denied(null, organizationId, programId, operation, requestId);
            throw new ProgramActivities.Missing();
        } catch (OrganizationAccess.Denied exception) {
            denied(null, organizationId, programId, operation, requestId);
            throw exception;
        }
        if (!context.roles().contains("CONSULTANT")) {
            denied(context.userId(), organizationId, programId, operation, requestId);
            throw new OrganizationAccess.Denied();
        }
        tenantContext.activate(context.organizationId());
        if (programs.find(context.organizationId(), programId).isEmpty()) {
            denied(context.userId(), organizationId, programId, operation, requestId);
            throw new ProgramActivities.Missing();
        }
        return context;
    }

    private ActivityResponse response(ProgramActivities.Activity activity,
            List<ActivityAssignments.Data> activityAssignments) {
        var assignees = new ArrayList<AssigneeResponse>(activityAssignments.size());
        for (var assignment : activityAssignments) {
            assignees.add(assignee(activity.organizationId(), activity.programId(), assignment));
        }
        return new ActivityResponse(activity.id(), activity.organizationId(), activity.programId(),
                activity.moduleId(), activity.sessionId(), activity.title(), activity.instructions(),
                activity.youtubeUrl(), activity.dueDate(), activity.position(), activity.version(), assignees);
    }

    private AssigneeResponse assignee(UUID organizationId, UUID programId, ActivityAssignments.Data assignment) {
        var enrollment = enrollments.find(organizationId, programId, assignment.enrollmentId())
                .orElseThrow(EnrollmentNotFound::new);
        var participant = participants.participant(organizationId, enrollment.membershipId());
        return new AssigneeResponse(assignment.id(), enrollment.id(), participant.email(),
                participant.firstName(), participant.lastName(), assignment.status(), assignment.responseText(),
                assignment.submittedAt(), assignment.reviewComment(), assignment.reviewedAt(), assignment.version());
    }

    private static void auditAfterCommit(String action, UUID actor, UUID organizationId,
            UUID activityId, String requestId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(ActivityService.class).info(
                        "action={} actor={} organization={} resource=Activity resourceId={} requestId={} timestamp={} result=SUCCESS",
                        action, actor, organizationId, activityId, requestId, Instant.now());
            }
        });
    }

    private static void denied(UUID actor, UUID organizationId, UUID programId, String operation, String requestId) {
        LoggerFactory.getLogger(ActivityService.class).info(
                "action=AUTHORIZATION_DENIED operation={} actor={} organization={} resource=Program resourceId={} requestId={} timestamp={} result=DENIED",
                operation, actor, organizationId, programId, requestId, Instant.now());
    }

    public record AssigneeResponse(UUID assignmentId, UUID enrollmentId, String email, String firstName,
            String lastName, String status, String responseText, Instant submittedAt,
            String reviewComment, Instant reviewedAt, long version) {}
    public record ActivityResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId, UUID sessionId,
            String title, String instructions, String youtubeUrl, LocalDate dueDate, int position, long version,
            List<AssigneeResponse> assignees) {
        public ActivityResponse { assignees = List.copyOf(assignees); }
    }
    public record AssignedActivityResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId,
            UUID sessionId, String title, String instructions, String youtubeUrl, LocalDate dueDate,
            int position, long version,
            UUID assignmentId, String assignmentStatus, String responseText, Instant submittedAt,
            String reviewComment, Instant reviewedAt, long assignmentVersion) {
        static AssignedActivityResponse from(ProgramActivities.Activity activity, ActivityAssignments.Data assignment) {
            return new AssignedActivityResponse(activity.id(), activity.organizationId(), activity.programId(),
                    activity.moduleId(), activity.sessionId(), activity.title(), activity.instructions(),
                    activity.youtubeUrl(), activity.dueDate(), activity.position(), activity.version(),
                    assignment.id(), assignment.status(),
                    assignment.responseText(), assignment.submittedAt(), assignment.reviewComment(),
                    assignment.reviewedAt(), assignment.version());
        }
    }
}
