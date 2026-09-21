package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityEvaluations;
import com.reflejatuinterior.participation.domain.InvalidActivityEvaluation;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaActivityEvaluations implements ActivityEvaluations {
    private final ActivityEvaluationJpaRepository evaluations;
    private final ActivityEvaluationQuestionJpaRepository questions;

    JpaActivityEvaluations(ActivityEvaluationJpaRepository evaluations,
            ActivityEvaluationQuestionJpaRepository questions) {
        this.evaluations = evaluations; this.questions = questions;
    }

    @Override
    public Evaluation create(UUID organizationId, UUID programId, UUID activityId, String title,
            String instructions, List<QuestionInput> inputQuestions) {
        var cleanTitle = title == null ? "" : title.trim();
        var cleanInstructions = instructions == null || instructions.isBlank() ? null : instructions.trim();
        if (cleanTitle.isEmpty() || cleanTitle.length() > 255) throw new InvalidActivityEvaluation("title");
        if (cleanInstructions != null && cleanInstructions.length() > 2000) {
            throw new InvalidActivityEvaluation("instructions");
        }
        if (inputQuestions.isEmpty() || inputQuestions.size() > 20) {
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
        }
        var saved = evaluations.saveAndFlush(new ActivityEvaluationJpaEntity(
                organizationId, programId, activityId, cleanTitle, cleanInstructions));
        var savedQuestions = questions.saveAllAndFlush(inputQuestions.stream()
                .map(question -> new ActivityEvaluationQuestionJpaEntity(organizationId, programId, saved.id(),
                        question.prompt().trim(), question.type(), question.position())).toList());
        return data(saved, savedQuestions);
    }

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
                        question.position(), question.version())).toList(), evaluation.version());
    }
}
