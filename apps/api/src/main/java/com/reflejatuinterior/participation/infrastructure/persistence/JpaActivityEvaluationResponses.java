package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityEvaluationResponses;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaActivityEvaluationResponses implements ActivityEvaluationResponses {
    private final ActivityEvaluationResponseJpaRepository responses;
    private final ActivityEvaluationAnswerJpaRepository answers;

    JpaActivityEvaluationResponses(ActivityEvaluationResponseJpaRepository responses,
            ActivityEvaluationAnswerJpaRepository answers) {
        this.responses = responses; this.answers = answers;
    }

    @Override
    public Response create(UUID organizationId, UUID programId, UUID activityId, UUID evaluationId,
            UUID assignmentId, UUID enrollmentId, List<AnswerInput> input) {
        var saved = responses.saveAndFlush(new ActivityEvaluationResponseJpaEntity(organizationId, programId,
                activityId, evaluationId, assignmentId, enrollmentId));
        var storedAnswers = input.stream().flatMap(answer -> java.util.stream.IntStream
                .range(0, answer.values().size()).mapToObj(index -> new ActivityEvaluationAnswerJpaEntity(
                        organizationId, programId, saved.id(), answer.questionId(), answer.values().get(index), index + 1)))
                .toList();
        answers.saveAllAndFlush(storedAnswers);
        return data(saved, storedAnswers);
    }

    @Override
    public Optional<Response> findByAssignment(UUID organizationId, UUID programId, UUID assignmentId) {
        return responses.findByOrganizationIdAndProgramIdAndAssignmentId(organizationId, programId, assignmentId)
                .map(response -> data(response,
                        answers.findByResponseIdInOrderByResponseIdAscQuestionIdAscPositionAsc(List.of(response.id()))));
    }

    @Override
    public Map<UUID, Instant> completedAtByAssignments(UUID organizationId, UUID programId,
            Collection<UUID> assignmentIds) {
        if (assignmentIds.isEmpty()) return Map.of();
        var result = new LinkedHashMap<UUID, Instant>();
        responses.findByOrganizationIdAndProgramIdAndAssignmentIdIn(organizationId, programId, assignmentIds)
                .forEach(response -> result.put(response.assignmentId(), response.completedAt()));
        return Map.copyOf(result);
    }

    private static Response data(ActivityEvaluationResponseJpaEntity response,
            List<ActivityEvaluationAnswerJpaEntity> storedAnswers) {
        var grouped = storedAnswers.stream().collect(java.util.stream.Collectors.groupingBy(
                ActivityEvaluationAnswerJpaEntity::questionId, LinkedHashMap::new,
                java.util.stream.Collectors.mapping(ActivityEvaluationAnswerJpaEntity::value,
                        java.util.stream.Collectors.toList())));
        return new Response(response.id(), response.evaluationId(), response.assignmentId(),
                response.enrollmentId(), response.completedAt(), grouped.entrySet().stream()
                        .map(entry -> new Answer(entry.getKey(), entry.getValue())).toList(), response.version());
    }
}
