package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.Set;
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
    private final SessionForms sessionForms;

    ActivityService(OrganizationAccess organizationAccess, CollaboratorAccess collaboratorAccess,
            CollaboratorInvitations participants, ProgramDirectory programs, ProgramActivities activities,
            Enrollments enrollments, ActivityAssignments assignments, ActivityEvaluations evaluations,
            ActivityEvaluationResponses evaluationResponses, OrganizationTenantContext tenantContext,SessionForms sessionForms) {
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
        this.sessionForms=sessionForms;
    }

    @Transactional
    public ActivityResponse create(String subject, UUID organizationId, UUID programId, UUID sessionId,
            String title, String instructions, String youtubeUrl, LocalDate dueDate, int position, String requestId) {
        var context = authorizeConsultant(subject, organizationId, programId, "CREATE_ACTIVITY", requestId);
        programs.lock(context.organizationId(), programId).orElseThrow(ProgramActivities.Missing::new).requireEditable();
        if(sessionForms.hasClosed(organizationId,programId,sessionId))throw new com.reflejatuinterior.program.ProgramContent.Conflict("SESSION_ALREADY_COMPLETED");
        var activity = activities.create(context.organizationId(), programId, sessionId,
                title, instructions, youtubeUrl, dueDate, position);
        var createdAssignments = assignments.assignScheduledActivity(context.organizationId(), programId, activity.id());
        auditAfterCommit(createdAssignments.isEmpty() ? "PROGRAM_ACTIVITY_CREATED" : "PROGRAM_ACTIVITY_ASSIGNED",
                context.userId(), context.organizationId(), activity.id(), requestId);
        return response(activity, createdAssignments, Optional.empty(), Map.of());
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> listForConsultant(String subject, UUID organizationId, UUID programId,
            String requestId) {
        return listForConsultant(subject, organizationId, programId, false, requestId);
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> listForConsultant(String subject, UUID organizationId, UUID programId,
            boolean includeArchived, String requestId) {
        authorizeConsultant(subject, organizationId, programId, "VIEW_PROGRAM_ACTIVITIES", requestId);
        var definitions = includeArchived ? activities.listIncludingArchived(organizationId, programId) : activities.list(organizationId, programId);
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
            var program = programs.find(membership.organizationId(), programId).orElseThrow(MyProgramNotFound::new);
            if (!program.activated()) return List.of();
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
    public AssigneeResponse review(String subject, UUID organizationId, UUID programId, UUID activityId,
            UUID assignmentId, ActivityReviewDecision decision, String comment, String requestId) {
        var context = authorizeConsultant(subject, organizationId, programId, "REVIEW_ACTIVITY", requestId);
        programs.lock(context.organizationId(), programId).orElseThrow(ProgramActivities.Missing::new).requireActive();
        var cleanComment = comment == null || comment.isBlank() ? null : comment.trim();
        if ((decision == ActivityReviewDecision.REQUEST_CHANGES && cleanComment == null)
                || (cleanComment != null && cleanComment.length() > 5000)) {
            throw new InvalidActivityAssignment("comment");
        }
        var assignment = assignments.listByActivities(context.organizationId(), programId, List.of(activityId)).stream()
                .filter(item -> item.id().equals(assignmentId)).findFirst()
                .orElseThrow(ActivityAssignmentNotFound::new);
        var definition=activities.findAll(organizationId,programId,List.of(activityId)).stream().findFirst().orElseThrow(ActivityAssignmentNotFound::new);
        if(decision==ActivityReviewDecision.REQUEST_CHANGES&&sessionForms.isClosed(organizationId,programId,definition.sessionId(),assignment.enrollmentId()))
            throw new com.reflejatuinterior.program.ProgramContent.Conflict("SESSION_ALREADY_COMPLETED");
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
        return assignee(context.organizationId(), programId, definition.sessionId(), reviewed, evaluation, completedAt);
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
            assignees.add(assignee(activity.organizationId(), activity.programId(), activity.sessionId(), assignment,
                    evaluation, completedAt.get(assignment.id())));
        }
        return new ActivityResponse(activity.id(), activity.organizationId(), activity.programId(),
                activity.moduleId(), activity.sessionId(), activity.dimensionName(), activity.dimensionPosition(),
                activity.sessionName(), activity.sessionPosition(),
                activity.title(), activity.instructions(), activity.youtubeUrl(), activity.dueDate(),
                activity.position(), activity.version(), assignees, activity.archived());
    }

    private AssigneeResponse assignee(UUID organizationId, UUID programId, UUID sessionId, ActivityAssignments.Data assignment,
            Optional<ActivityEvaluations.Evaluation> evaluation, Instant surveyCompletedAt) {
        var enrollment = enrollments.find(organizationId, programId, assignment.enrollmentId())
                .orElseThrow(EnrollmentNotFound::new);
        var participant = participants.participant(organizationId, enrollment.membershipId());
        var closure = sessionForms.state(organizationId, programId, sessionId, assignment.enrollmentId());
        return new AssigneeResponse(assignment.id(), enrollment.id(), participant.email(),
                participant.firstName(), participant.lastName(), assignment.status(), assignment.responseText(),
                assignment.submittedAt(), assignment.reviewComment(), assignment.reviewedAt(),
                surveyStatus(evaluation, assignment, surveyCompletedAt),
                completionPercentage(evaluation, assignment, surveyCompletedAt), assignment.version(),assignment.dueDate(),
                reviewedAnswers(organizationId,programId,assignment,evaluation),closure.completed(),closure.percentage());
    }

    private AssignedActivityResponse assignedResponse(ProgramActivities.Activity activity,
            ActivityAssignments.Data assignment, Optional<ActivityEvaluations.Evaluation> evaluation,
            Instant surveyCompletedAt) {
        return new AssignedActivityResponse(activity.id(), activity.organizationId(), activity.programId(),
                activity.moduleId(), activity.sessionId(), activity.dimensionName(), activity.dimensionPosition(),
                activity.sessionName(), activity.sessionPosition(),
                activity.title(), activity.instructions(), activity.youtubeUrl(), assignment.dueDate(),
                activity.position(), activity.version(), assignment.id(), assignment.status(),
                assignment.responseText(), assignment.submittedAt(), assignment.reviewComment(),
                assignment.reviewedAt(), assignment.version(),
                evaluation.map(value -> survey(value, assignment, surveyCompletedAt)).orElse(null),
                completionPercentage(evaluation, assignment, surveyCompletedAt),
                evaluationResponses.findByAssignment(activity.organizationId(),activity.programId(),assignment.id()).map(ActivityEvaluationResponses.Response::answers).orElse(List.of()),
                sessionForms.state(activity.organizationId(),activity.programId(),activity.sessionId(),assignment.enrollmentId()).percentage());
    }

    private static SurveyResponse survey(ActivityEvaluations.Evaluation evaluation,
            ActivityAssignments.Data assignment, Instant completedAt) {
        return new SurveyResponse(evaluation.id(), evaluation.title(), evaluation.instructions(),
                evaluation.questions().stream().map(question -> new SurveyQuestionResponse(
                        question.id(), question.prompt(), question.type().name(), question.position(), question.options())).toList(),
                surveyStatus(Optional.of(evaluation), assignment, completedAt), completedAt);
    }

    private static String surveyStatus(Optional<ActivityEvaluations.Evaluation> evaluation,
            ActivityAssignments.Data assignment, Instant completedAt) {
        if (evaluation.isEmpty()) return "NOT_REQUIRED";
        if (completedAt != null&&!"CHANGES_REQUESTED".equals(assignment.status())) return "COMPLETED";
        return "PENDING";
    }

    private static int completionPercentage(Optional<ActivityEvaluations.Evaluation> evaluation,
            ActivityAssignments.Data assignment, Instant completedAt) {
        return completedAt!=null&&!"CHANGES_REQUESTED".equals(assignment.status())?100:0;
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
            int completionPercentage, long version, LocalDate dueDate,List<ReviewedAnswer> answers,boolean sessionCompleted,double sessionProgressPercentage) {}
    public record ReviewedAnswer(UUID questionId,String prompt,String type,List<String> values){}
    public record ActivityResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId, UUID sessionId,
            String dimensionName, int dimensionPosition, String sessionName, int sessionPosition,
            String title, String instructions, String youtubeUrl,
            LocalDate dueDate, int position, long version,
            List<AssigneeResponse> assignees, boolean archived) {
        public ActivityResponse { assignees = List.copyOf(assignees); }
    }
    public record AssignedActivityResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId,
            UUID sessionId, String dimensionName, int dimensionPosition, String sessionName, int sessionPosition,
            String title, String instructions,
            String youtubeUrl, LocalDate dueDate, int position, long version,
            UUID assignmentId, String assignmentStatus, String responseText, Instant submittedAt,
            String reviewComment, Instant reviewedAt, long assignmentVersion,
            SurveyResponse survey, int completionPercentage,List<ActivityEvaluationResponses.Answer> answers,double sessionProgressPercentage) {}
    public record SurveyResponse(UUID id, String title, String instructions,
            List<SurveyQuestionResponse> questions, String status, Instant completedAt) {
        public SurveyResponse { questions = List.copyOf(questions); }
    }
    public record SurveyQuestionResponse(UUID id, String prompt, String type, int position, List<String> options) {}
    private List<ReviewedAnswer> reviewedAnswers(UUID org,UUID program,ActivityAssignments.Data assignment,Optional<ActivityEvaluations.Evaluation> evaluation){
        var answer=evaluationResponses.findByAssignment(org,program,assignment.id());
        if(answer.isEmpty()||evaluation.isEmpty())return List.of();
        return evaluation.get().questions().stream().map(q->new ReviewedAnswer(q.id(),q.prompt(),q.type().name(),
            answer.get().answers().stream().filter(a->a.questionId().equals(q.id())).findFirst().map(ActivityEvaluationResponses.Answer::values).orElse(List.of()))).toList();
    }
}
