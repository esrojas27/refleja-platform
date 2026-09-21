package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorAccess;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;
import com.reflejatuinterior.participation.domain.InvalidActivitySurveyResponse;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ActivityEvaluationService {
    private final OrganizationAccess organizationAccess;
    private final ProgramDirectory programs;
    private final ProgramActivities activities;
    private final ActivityEvaluations evaluations;
    private final ActivityEvaluationResponses responses;
    private final CollaboratorAccess collaboratorAccess;
    private final Enrollments enrollments;
    private final ActivityAssignments assignments;
    private final OrganizationTenantContext tenantContext;

    ActivityEvaluationService(OrganizationAccess organizationAccess, ProgramDirectory programs,
            ProgramActivities activities, ActivityEvaluations evaluations, ActivityEvaluationResponses responses,
            CollaboratorAccess collaboratorAccess, Enrollments enrollments, ActivityAssignments assignments,
            OrganizationTenantContext tenantContext) {
        this.organizationAccess = organizationAccess; this.programs = programs; this.activities = activities;
        this.evaluations = evaluations; this.responses = responses; this.collaboratorAccess = collaboratorAccess;
        this.enrollments = enrollments; this.assignments = assignments; this.tenantContext = tenantContext;
    }

    @Transactional
    public ActivityEvaluations.Evaluation create(String subject, UUID organizationId, UUID programId,
            UUID activityId, String title, String instructions,
            List<ActivityEvaluations.QuestionInput> questions, String requestId) {
        var context = authorize(subject, organizationId, programId, "CREATE_ACTIVITY_EVALUATION", requestId);
        if (activities.findAll(context.organizationId(), programId, List.of(activityId)).isEmpty()) {
            throw new ProgramActivities.Missing();
        }
        var created = evaluations.create(context.organizationId(), programId, activityId,
                title, instructions, questions);
        auditAfterCommit(context.userId(), context.organizationId(), created.id(), requestId);
        return created;
    }

    @Transactional(readOnly = true)
    public List<ActivityEvaluations.Evaluation> list(String subject, UUID organizationId, UUID programId,
            String requestId) {
        authorize(subject, organizationId, programId, "VIEW_ACTIVITY_EVALUATIONS", requestId);
        return evaluations.list(organizationId, programId);
    }

    @Transactional
    public SurveySubmission submit(String subject, UUID programId, UUID activityId,
            List<ActivityEvaluationResponses.AnswerInput> input, String requestId) {
        var owned = authorizeOwned(subject, programId, activityId, requestId);
        var evaluation = evaluations.find(owned.organizationId(), programId, activityId)
                .orElseThrow(ProgramActivities.Missing::new);
        if (owned.assignment().submittedAt() == null
                || responses.findByAssignment(owned.organizationId(), programId, owned.assignment().id()).isPresent()) {
            throw new ActivityWorkflowConflict();
        }
        var cleanAnswers = validate(evaluation, input);
        var created = responses.create(owned.organizationId(), programId, activityId, evaluation.id(),
                owned.assignment().id(), owned.enrollmentId(), cleanAnswers);
        auditSurveyAfterCommit(owned.userId(), owned.organizationId(), created.id(), requestId);
        return new SurveySubmission(evaluation.id(), "COMPLETED", created.completedAt());
    }

    private OwnedContext authorizeOwned(String subject, UUID programId, UUID activityId, String requestId) {
        CollaboratorAccess.Context context;
        try {
            context = collaboratorAccess.resolve(subject);
        } catch (CollaboratorAccess.Denied exception) {
            denied(null, null, programId, "COMPLETE_ACTIVITY_SURVEY", requestId);
            throw exception;
        }
        for (var membership : context.memberships().stream()
                .sorted(Comparator.comparing(CollaboratorAccess.Membership::organizationId)).toList()) {
            tenantContext.activate(membership.organizationId());
            var enrollment = enrollments.findOwned(membership.organizationId(), membership.id(), programId);
            if (enrollment.isEmpty()) continue;
            if (!"ACTIVE".equals(enrollment.get().status())) throw new ActivityWorkflowConflict();
            var assignment = assignments.listOwned(membership.organizationId(), programId, enrollment.get().id())
                    .stream().filter(item -> item.activityId().equals(activityId)).findFirst()
                    .orElseThrow(ActivityAssignmentNotFound::new);
            return new OwnedContext(context.userId(), membership.organizationId(), enrollment.get().id(), assignment);
        }
        denied(context.userId(), null, programId, "COMPLETE_ACTIVITY_SURVEY", requestId);
        throw new ActivityAssignmentNotFound();
    }

    private static List<ActivityEvaluationResponses.AnswerInput> validate(ActivityEvaluations.Evaluation evaluation,
            List<ActivityEvaluationResponses.AnswerInput> input) {
        if (input == null || input.size() != evaluation.questions().size()) {
            throw new InvalidActivitySurveyResponse("answers");
        }
        var questionIds = input.stream().map(ActivityEvaluationResponses.AnswerInput::questionId)
                .collect(java.util.stream.Collectors.toSet());
        if (questionIds.size() != input.size() || !questionIds.equals(evaluation.questions().stream()
                .map(ActivityEvaluations.Question::id).collect(java.util.stream.Collectors.toSet()))) {
            throw new InvalidActivitySurveyResponse("answers");
        }
        return evaluation.questions().stream().sorted(Comparator.comparingInt(ActivityEvaluations.Question::position))
                .map(question -> clean(question, input.stream().filter(answer -> answer.questionId().equals(question.id()))
                        .findFirst().orElseThrow(() -> new InvalidActivitySurveyResponse("answers"))))
                .toList();
    }

    private static ActivityEvaluationResponses.AnswerInput clean(ActivityEvaluations.Question question,
            ActivityEvaluationResponses.AnswerInput answer) {
        var values = answer.values() == null ? List.<String>of() : answer.values().stream()
                .map(value -> value == null ? "" : value.trim()).toList();
        var unique = new LinkedHashSet<>(values);
        if (unique.size() != values.size() || values.stream().anyMatch(String::isEmpty)) {
            throw new InvalidActivitySurveyResponse("answers");
        }
        if (question.type() == EvaluationQuestionType.OPEN_TEXT) {
            if (values.size() != 1 || values.getFirst().length() > 5000) invalidAnswers();
        } else if (question.type() == EvaluationQuestionType.EMOTION_MULTI_SELECT) {
            if (values.isEmpty() || values.size() > 2 || !EMOTIONS.containsAll(values)) invalidAnswers();
        } else if (values.size() != 1 || !SCALE_VALUES.contains(values.getFirst())) {
            invalidAnswers();
        }
        return new ActivityEvaluationResponses.AnswerInput(question.id(), values);
    }

    private static void invalidAnswers() { throw new InvalidActivitySurveyResponse("answers"); }

    private static final Set<String> SCALE_VALUES = Set.of("1", "2", "3", "4", "5");
    private static final Set<String> EMOTIONS = Set.of("Inspirado(a)", "Motivado(a)", "Reflexivo(a)",
            "Sorprendido(a)", "Retado(a)", "Confundido(a)", "Indiferente");

    private OrganizationAccess.Context authorize(String subject, UUID organizationId, UUID programId,
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
            throw new ProgramActivities.Missing();
        }
        return context;
    }

    private static void auditAfterCommit(UUID actor, UUID organizationId, UUID evaluationId, String requestId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(ActivityEvaluationService.class).info(
                        "action=ACTIVITY_EVALUATION_CREATED actor={} organization={} resource=ActivityEvaluation resourceId={} requestId={} timestamp={} result=SUCCESS",
                        actor, organizationId, evaluationId, requestId, Instant.now());
            }
        });
    }

    private static void auditSurveyAfterCommit(UUID actor, UUID organizationId, UUID responseId, String requestId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(ActivityEvaluationService.class).info(
                        "action=ACTIVITY_SURVEY_COMPLETED actor={} organization={} resource=ActivityEvaluationResponse resourceId={} requestId={} timestamp={} result=SUCCESS",
                        actor, organizationId, responseId, requestId, Instant.now());
            }
        });
    }

    private static void denied(UUID actor, UUID organizationId, UUID programId,
            String operation, String requestId) {
        LoggerFactory.getLogger(ActivityEvaluationService.class).info(
                "action=AUTHORIZATION_DENIED operation={} actor={} organization={} resource=Program resourceId={} requestId={} timestamp={} result=DENIED",
                operation, actor, organizationId, programId, requestId, Instant.now());
    }

    private record OwnedContext(UUID userId, UUID organizationId, UUID enrollmentId,
                                ActivityAssignments.Data assignment) {}
    public record SurveySubmission(UUID evaluationId, String status, Instant completedAt) {}
}
