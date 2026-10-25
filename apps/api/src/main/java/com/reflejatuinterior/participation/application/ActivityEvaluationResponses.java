package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface ActivityEvaluationResponses {
    Response create(UUID organizationId, UUID programId, UUID activityId, UUID evaluationId,
            UUID assignmentId, UUID enrollmentId, List<AnswerInput> answers);
    Optional<Response> findByAssignment(UUID organizationId, UUID programId, UUID assignmentId);
    List<Response> listByAssignments(UUID organizationId, UUID programId, Collection<UUID> assignmentIds);
    Map<UUID, Instant> completedAtByAssignments(UUID organizationId, UUID programId,
            Collection<UUID> assignmentIds);
    Response replace(UUID org, UUID program, UUID assignment, List<AnswerInput> answers);
    Response createForSession(UUID org,UUID program,UUID session,UUID evaluation,UUID enrollment,List<AnswerInput> answers);
    Optional<Response> findForSession(UUID org,UUID program,UUID session,UUID enrollment);

    record AnswerInput(UUID questionId, List<String> values) {
        public AnswerInput { values = List.copyOf(values); }
    }
    record Answer(UUID questionId, List<String> values) {
        public Answer { values = List.copyOf(values); }
    }
    record Response(UUID id, UUID evaluationId, UUID assignmentId, UUID enrollmentId,
            Instant completedAt, List<Answer> answers, long version) {
        public Response { answers = List.copyOf(answers); }
    }
}
