package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
    private final ActivityEvaluations evaluations;
    private final ActivityEvaluationResponses evaluationResponses;
    private final OrganizationTenantContext tenantContext;

    ActivityService(OrganizationAccess organizationAccess, CollaboratorAccess collaboratorAccess,
            CollaboratorInvitations participants, ProgramDirectory programs, ProgramActivities activities,
            Enrollments enrollments, ActivityAssignments assignments, ActivityEvaluations evaluations,
            ActivityEvaluationResponses evaluationResponses, OrganizationTenantContext tenantContext) {
        this.organizationAccess = organizationAccess;
        this.collaboratorAccess = collaboratorAccess;
        this.participants = participants;
        this.programs = programs;
        this.activities = activities;
        this.enrollments = enrollments;
        this.assignments = assignments;
        this.evaluations = evaluations;
        this.evaluationResponses = evaluationResponses;
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
        if (!assignToAll && activeEnrollments.size() != uniqueEnrollmentIds.size()) {
            throw new EnrollmentNotFound();
        }

        var activity = activities.create(context.organizationId(), programId, sessionId,
                title, instructions, youtubeUrl, dueDate, position);
        var createdAssignments = activeEnrollments.isEmpty() ? List.<ActivityAssignments.Data>of()
                : assignments.create(context.organizationId(), programId, activity.id(),
                        activeEnrollments.stream().map(Enrollments.Data::id).toList());
        auditAfterCommit(createdAssignments.isEmpty() ? "PROGRAM_ACTIVITY_CREATED" : "PROGRAM_ACTIVITY_ASSIGNED",
                context.userId(), context.organizationId(), activity.id(), requestId);
        return response(activity, createdAssignments, Optional.empty(), Map.of());
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> listForConsultant(String subject, UUID organizationId, UUID programId,
            String requestId) {
        authorizeConsultant(subject, organizationId, programId, "VIEW_PROGRAM_ACTIVITIES", requestId);
        var definitions = activities.list(organizationId, programId);
        var assigned = assignments.listByActivities(organizationId, programId,
                definitions.stream().map(ProgramActivities.Activity::id).toList());
        var evaluationsByActivity = evaluations.list(organizationId, programId).stream()
                .collect(java.util.stream.Collectors.toMap(ActivityEvaluations.Evaluation::activityId, value -> value));
        var completedAt = evaluationResponses.completedAtByAssignments(organizationId, programId,
                assigned.stream().map(ActivityAssignments.Data::id).toList());
        return definitions.stream().map(activity -> response(activity, assigned.stream()
                .filter(assignment -> assignment.activityId().equals(activity.id())).toList(),
                Optional.ofNullable(evaluationsByActivity.get(activity.id())), completedAt)).toList();
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
            var evaluationsByActivity = evaluations.list(membership.organizationId(), programId).stream()
                    .collect(java.util.stream.Collectors.toMap(ActivityEvaluations.Evaluation::activityId, value -> value));
            var completedAt = evaluationResponses.completedAtByAssignments(membership.organizationId(), programId,
                    ownedAssignments.stream().map(ActivityAssignments.Data::id).toList());
            return definitions.stream().map(activity -> assignedResponse(activity,
                    assignmentsByActivity.get(activity.id()), Optional.ofNullable(evaluationsByActivity.get(activity.id())),
                    completedAt.get(assignmentsByActivity.get(activity.id()).id()))).toList();
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
            var evaluation = evaluations.find(membership.organizationId(), programId, activityId);
            var completedAt = evaluationResponses.findByAssignment(membership.organizationId(), programId, submitted.id())
                    .map(ActivityEvaluationResponses.Response::completedAt).orElse(null);
            return assignedResponse(activity, submitted, evaluation, completedAt);
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
        var assignment = assignments.listByActivities(context.organizationId(), programId, List.of(activityId)).stream()
                .filter(item -> item.id().equals(assignmentId)).findFirst()
                .orElseThrow(ActivityAssignmentNotFound::new);
        var evaluation = evaluations.find(context.organizationId(), programId, activityId);
        if (evaluation.isPresent()
                && evaluationResponses.findByAssignment(context.organizationId(), programId, assignment.id()).isEmpty()) {
            throw new ActivityWorkflowConflict();
        }
        var reviewed = assignments.review(context.organizationId(), programId, activityId, assignmentId,
                decision, cleanComment, context.userId()).orElseThrow(ActivityAssignmentNotFound::new);
        auditAfterCommit(decision == ActivityReviewDecision.APPROVE
                        ? "PROGRAM_ACTIVITY_COMPLETED" : "PROGRAM_ACTIVITY_CHANGES_REQUESTED",
                context.userId(), context.organizationId(), activityId, requestId);
        var completedAt = evaluationResponses.findByAssignment(context.organizationId(), programId, reviewed.id())
                .map(ActivityEvaluationResponses.Response::completedAt).orElse(null);
        return assignee(context.organizationId(), programId, reviewed, evaluation, completedAt);
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
            List<ActivityAssignments.Data> activityAssignments,
            Optional<ActivityEvaluations.Evaluation> evaluation, Map<UUID, Instant> completedAt) {
        var assignees = new ArrayList<AssigneeResponse>(activityAssignments.size());
        for (var assignment : activityAssignments) {
            assignees.add(assignee(activity.organizationId(), activity.programId(), assignment,
                    evaluation, completedAt.get(assignment.id())));
        }
        return new ActivityResponse(activity.id(), activity.organizationId(), activity.programId(),
                activity.moduleId(), activity.sessionId(), activity.dimensionName(), activity.sessionName(),
                activity.title(), activity.instructions(), activity.youtubeUrl(), activity.dueDate(),
                activity.position(), activity.version(), assignees);
    }

    private AssigneeResponse assignee(UUID organizationId, UUID programId, ActivityAssignments.Data assignment,
            Optional<ActivityEvaluations.Evaluation> evaluation, Instant surveyCompletedAt) {
        var enrollment = enrollments.find(organizationId, programId, assignment.enrollmentId())
                .orElseThrow(EnrollmentNotFound::new);
        var participant = participants.participant(organizationId, enrollment.membershipId());
        return new AssigneeResponse(assignment.id(), enrollment.id(), participant.email(),
                participant.firstName(), participant.lastName(), assignment.status(), assignment.responseText(),
                assignment.submittedAt(), assignment.reviewComment(), assignment.reviewedAt(),
                surveyStatus(evaluation, assignment, surveyCompletedAt),
                completionPercentage(evaluation, assignment, surveyCompletedAt), assignment.version());
    }

    private AssignedActivityResponse assignedResponse(ProgramActivities.Activity activity,
            ActivityAssignments.Data assignment, Optional<ActivityEvaluations.Evaluation> evaluation,
            Instant surveyCompletedAt) {
        return new AssignedActivityResponse(activity.id(), activity.organizationId(), activity.programId(),
                activity.moduleId(), activity.sessionId(), activity.dimensionName(), activity.sessionName(),
                activity.title(), activity.instructions(), activity.youtubeUrl(), activity.dueDate(),
                activity.position(), activity.version(), assignment.id(), assignment.status(),
                assignment.responseText(), assignment.submittedAt(), assignment.reviewComment(),
                assignment.reviewedAt(), assignment.version(),
                evaluation.map(value -> survey(value, assignment, surveyCompletedAt)).orElse(null),
                completionPercentage(evaluation, assignment, surveyCompletedAt));
    }

    private static SurveyResponse survey(ActivityEvaluations.Evaluation evaluation,
            ActivityAssignments.Data assignment, Instant completedAt) {
        return new SurveyResponse(evaluation.id(), evaluation.title(), evaluation.instructions(),
                evaluation.questions().stream().map(question -> new SurveyQuestionResponse(
                        question.id(), question.prompt(), question.type().name(), question.position())).toList(),
                surveyStatus(Optional.of(evaluation), assignment, completedAt), completedAt);
    }

    private static String surveyStatus(Optional<ActivityEvaluations.Evaluation> evaluation,
            ActivityAssignments.Data assignment, Instant completedAt) {
        if (evaluation.isEmpty()) return "NOT_REQUIRED";
        if (completedAt != null) return "COMPLETED";
        return assignment.submittedAt() == null ? "LOCKED" : "PENDING";
    }

    private static int completionPercentage(Optional<ActivityEvaluations.Evaluation> evaluation,
            ActivityAssignments.Data assignment, Instant completedAt) {
        if (assignment.submittedAt() == null) return 0;
        return evaluation.isEmpty() || completedAt != null ? 100 : 50;
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
            String reviewComment, Instant reviewedAt, String surveyStatus,
            int completionPercentage, long version) {}
    public record ActivityResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId, UUID sessionId,
            String dimensionName, String sessionName, String title, String instructions, String youtubeUrl,
            LocalDate dueDate, int position, long version,
            List<AssigneeResponse> assignees) {
        public ActivityResponse { assignees = List.copyOf(assignees); }
    }
    public record AssignedActivityResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId,
            UUID sessionId, String dimensionName, String sessionName, String title, String instructions,
            String youtubeUrl, LocalDate dueDate, int position, long version,
            UUID assignmentId, String assignmentStatus, String responseText, Instant submittedAt,
            String reviewComment, Instant reviewedAt, long assignmentVersion,
            SurveyResponse survey, int completionPercentage) {}
    public record SurveyResponse(UUID id, String title, String instructions,
            List<SurveyQuestionResponse> questions, String status, Instant completedAt) {
        public SurveyResponse { questions = List.copyOf(questions); }
    }
    public record SurveyQuestionResponse(UUID id, String prompt, String type, int position) {}
}
