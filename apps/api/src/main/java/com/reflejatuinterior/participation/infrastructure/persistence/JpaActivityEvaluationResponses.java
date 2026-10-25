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
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    JpaActivityEvaluationResponses(ActivityEvaluationResponseJpaRepository responses,
            ActivityEvaluationAnswerJpaRepository answers, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.responses = responses; this.answers = answers; this.jdbc=jdbc;
    }

    @Override
    public Response create(UUID organizationId, UUID programId, UUID activityId, UUID evaluationId,
            UUID assignmentId, UUID enrollmentId, List<AnswerInput> input) {
        var saved = responses.saveAndFlush(new ActivityEvaluationResponseJpaEntity(organizationId, programId,
                activityId, evaluationId, assignmentId, enrollmentId));
        return saveAnswers(organizationId,programId,saved,input);
    }
    private Response saveAnswers(UUID organizationId,UUID programId,ActivityEvaluationResponseJpaEntity saved,List<AnswerInput> input) {
        var storedAnswers = input.stream().flatMap(answer -> java.util.stream.IntStream
                .range(0, answer.values().size()).mapToObj(index -> new ActivityEvaluationAnswerJpaEntity(
                        organizationId, programId, saved.id(), answer.questionId(), answer.values().get(index), index + 1)))
                .toList();
        answers.saveAllAndFlush(storedAnswers);
        return data(saved, storedAnswers);
    }
    @Override public Response replace(UUID org,UUID program,UUID assignment,List<AnswerInput> input) {
        var stored=responses.findByOrganizationIdAndProgramIdAndAssignmentId(org,program,assignment).orElseThrow();
        jdbc.update("""
            INSERT INTO rti.activity_form_response_revisions(organization_id,program_id,response_id,response_version,completed_at,answers)
            SELECT r.organization_id,r.program_id,r.id,r.version,r.completed_at,
              coalesce((SELECT jsonb_agg(jsonb_build_object('questionId',a.question_id,'value',a.answer_value,'position',a.position) ORDER BY a.question_id,a.position)
              FROM rti.activity_evaluation_answers a WHERE a.organization_id=r.organization_id AND a.response_id=r.id),'[]'::jsonb)
            FROM rti.activity_evaluation_responses r WHERE r.organization_id=? AND r.program_id=? AND r.id=?
            """,org,program,stored.id());
        answers.deleteAll(answers.findByResponseIdInOrderByResponseIdAscQuestionIdAscPositionAsc(List.of(stored.id())));answers.flush();
        stored.resubmit();responses.saveAndFlush(stored);
        return saveAnswers(org,program,stored,input);
    }
    @Override public Response createForSession(UUID org,UUID program,UUID session,UUID evaluation,UUID enrollment,List<AnswerInput> input) {
        var entity=new ActivityEvaluationResponseJpaEntity(org,program,null,evaluation,null,enrollment);entity.forSession(session);
        return saveAnswers(org,program,responses.saveAndFlush(entity),input);
    }
    @Override public Optional<Response> findForSession(UUID org,UUID program,UUID session,UUID enrollment) {
        return responses.findByOrganizationIdAndProgramIdAndSessionIdAndEnrollmentId(org,program,session,enrollment)
            .map(r->data(r,answers.findByResponseIdInOrderByResponseIdAscQuestionIdAscPositionAsc(List.of(r.id()))));
    }

    @Override
    public Optional<Response> findByAssignment(UUID organizationId, UUID programId, UUID assignmentId) {
        return responses.findByOrganizationIdAndProgramIdAndAssignmentId(organizationId, programId, assignmentId)
                .map(response -> data(response,
                        answers.findByResponseIdInOrderByResponseIdAscQuestionIdAscPositionAsc(List.of(response.id()))));
    }

    @Override
    public List<Response> listByAssignments(UUID organizationId, UUID programId, Collection<UUID> assignmentIds) {
        if (assignmentIds.isEmpty()) return List.of();
        var stored = responses.findByOrganizationIdAndProgramIdAndAssignmentIdIn(organizationId, programId, assignmentIds);
        if (stored.isEmpty()) return List.of();
        var grouped = answers.findByResponseIdInOrderByResponseIdAscQuestionIdAscPositionAsc(
                stored.stream().map(ActivityEvaluationResponseJpaEntity::id).toList()).stream()
                .collect(java.util.stream.Collectors.groupingBy(ActivityEvaluationAnswerJpaEntity::responseId));
        return stored.stream().map(response -> data(response, grouped.getOrDefault(response.id(), List.of())))
                .sorted(java.util.Comparator.comparing(Response::completedAt).thenComparing(Response::id)).toList();
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
