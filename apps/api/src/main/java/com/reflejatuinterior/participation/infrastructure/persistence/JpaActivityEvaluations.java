package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityEvaluations;
import com.reflejatuinterior.participation.domain.InvalidActivityEvaluation;
import com.reflejatuinterior.participation.domain.QuestionOptions;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramContent;
import com.reflejatuinterior.program.ProgramContentUsage;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaActivityEvaluations implements ActivityEvaluations {
    private final ActivityEvaluationJpaRepository evaluations;
    private final ActivityEvaluationQuestionJpaRepository questions;
    private final ProgramContentUsage usage;

    JpaActivityEvaluations(ActivityEvaluationJpaRepository evaluations,
            ActivityEvaluationQuestionJpaRepository questions, ProgramContentUsage usage) {
        this.evaluations = evaluations; this.questions = questions; this.usage = usage;
    }

    @Override
    public Evaluation create(UUID organizationId, UUID programId, UUID activityId, String title,
            String instructions, List<QuestionInput> inputQuestions) {
        var text = validate(title, instructions, inputQuestions);
        var saved = evaluations.saveAndFlush(new ActivityEvaluationJpaEntity(
                organizationId, programId, activityId, text.title(), text.instructions()));
        return data(saved, saveQuestions(organizationId, programId, saved.id(), inputQuestions));
    }

    @Override public Evaluation replace(UUID org, UUID program, UUID activity, long version, String title,
            String instructions, List<QuestionInput> inputQuestions) {
        if (usage.hasResponses(org, program, List.of(activity))) throw new ProgramContent.Conflict("CONTENT_HAS_SUBMISSIONS");
        var stored = evaluations.findByOrganizationIdAndProgramIdAndActivityId(org, program, activity)
                .orElseThrow(ProgramActivities.Missing::new);
        if (stored.version() != version) throw new ProgramContent.Conflict("CONTENT_VERSION_CONFLICT");
        var text = validate(title, instructions, inputQuestions);
        questions.deleteAll(questions.findByEvaluationIdOrderByPositionAsc(stored.id()));
        questions.flush();
        stored.edit(text.title(), text.instructions());
        evaluations.saveAndFlush(stored);
        return data(stored, saveQuestions(org, program, stored.id(), inputQuestions));
    }

    @Override public void deleteUnassignedDefinitions(UUID org, UUID program, java.util.Collection<UUID> ids) {
        if (ids.isEmpty()) return;
        if (usage.hasAssignments(org, program, ids) || usage.hasResponses(org, program, ids))
            throw new ProgramContent.Conflict("CONTENT_HAS_ASSIGNMENTS");
        var stored = evaluations.findByOrganizationIdAndProgramIdOrderByActivityIdAsc(org, program).stream()
                .filter(e -> ids.contains(e.activityId())).toList();
        questions.deleteAll(questions.findByEvaluationIdInOrderByEvaluationIdAscPositionAsc(stored.stream().map(ActivityEvaluationJpaEntity::id).toList()));
        questions.flush(); evaluations.deleteAll(stored); evaluations.flush();
    }

    private List<ActivityEvaluationQuestionJpaEntity> saveQuestions(UUID org, UUID program, UUID evaluation, List<QuestionInput> input) {
        return questions.saveAllAndFlush(input.stream().map(q -> new ActivityEvaluationQuestionJpaEntity(
                org, program, evaluation, q.prompt().trim(), q.type(), q.position(), q.options())).toList());
    }

    private static Texts validate(String title, String instructions, List<QuestionInput> inputQuestions) {
        var cleanTitle = title == null ? "" : title.trim();
        var cleanInstructions = instructions == null || instructions.isBlank() ? null : instructions.trim();
        if (cleanTitle.isEmpty() || cleanTitle.length() > 255) throw new InvalidActivityEvaluation("title");
        if (cleanInstructions != null && cleanInstructions.length() > 2000) {
            throw new InvalidActivityEvaluation("instructions");
        }
        if (inputQuestions == null || inputQuestions.isEmpty() || inputQuestions.size() > 20) {
            throw new InvalidActivityEvaluation("questions");
        }
        var positions = inputQuestions.stream().map(QuestionInput::position).collect(java.util.stream.Collectors.toSet());
        if (positions.size() != inputQuestions.size() || !positions.containsAll(
                java.util.stream.IntStream.rangeClosed(1, inputQuestions.size()).boxed().toList())) {
            throw new InvalidActivityEvaluation("questions");
        }
        for (var question : inputQuestions) {
            if (question.prompt() == null || question.prompt().trim().isEmpty()
                    || question.prompt().trim().length() > 500 || question.type() == null) {
                throw new InvalidActivityEvaluation("questions");
            }
            QuestionOptions.clean(question.type(), question.options());
        }
        return new Texts(cleanTitle, cleanInstructions);
    }
    private record Texts(String title, String instructions) {}

    @Override
    public List<Evaluation> list(UUID organizationId, UUID programId) {
        var stored = evaluations.findByOrganizationIdAndProgramIdOrderByActivityIdAsc(organizationId, programId);
        if (stored.isEmpty()) return List.of();
        var storedQuestions = questions.findByEvaluationIdInOrderByEvaluationIdAscPositionAsc(
                stored.stream().map(ActivityEvaluationJpaEntity::id).toList());
        return stored.stream().map(evaluation -> data(evaluation, storedQuestions.stream()
                .filter(question -> question.evaluationId().equals(evaluation.id())).toList())).toList();
    }

    @Override
    public Optional<Evaluation> find(UUID organizationId, UUID programId, UUID activityId) {
        return evaluations.findByOrganizationIdAndProgramIdAndActivityId(organizationId, programId, activityId)
                .map(evaluation -> data(evaluation,
                        questions.findByEvaluationIdOrderByPositionAsc(evaluation.id())));
    }

    private static Evaluation data(ActivityEvaluationJpaEntity evaluation,
            List<ActivityEvaluationQuestionJpaEntity> storedQuestions) {
        return new Evaluation(evaluation.id(), evaluation.organizationId(), evaluation.programId(),
                evaluation.activityId(), evaluation.title(), evaluation.instructions(), storedQuestions.stream()
                .map(question -> new Question(question.id(), question.prompt(), question.type(),
                        question.position(), question.version(), question.options())).toList(), evaluation.version());
    }
}
