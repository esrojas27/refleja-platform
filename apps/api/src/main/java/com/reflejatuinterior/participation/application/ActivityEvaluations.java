package com.reflejatuinterior.participation.application;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;

public interface ActivityEvaluations {
    Evaluation create(UUID organizationId, UUID programId, UUID activityId, String title,
            String instructions, List<QuestionInput> questions);
    List<Evaluation> list(UUID organizationId, UUID programId);
    Optional<Evaluation> find(UUID organizationId, UUID programId, UUID activityId);
    Evaluation replace(UUID org, UUID program, UUID activity, long version, String title, String instructions, List<QuestionInput> questions);
    void deleteUnassignedDefinitions(UUID org, UUID program, java.util.Collection<UUID> activityIds);
    void deleteSessionDefinitions(UUID org,UUID program,java.util.Collection<UUID> sessionIds);
    Evaluation createForSession(UUID org, UUID program, UUID session, String title, String instructions, List<QuestionInput> questions);
    Optional<Evaluation> findForSession(UUID org, UUID program, UUID session);
    List<Evaluation> listForSessions(UUID org, UUID program);
    Evaluation replaceForSession(UUID org, UUID program, UUID session, long version, String title, String instructions, List<QuestionInput> questions);

    record QuestionInput(String prompt, EvaluationQuestionType type, int position, List<String> options) {}
    record Question(UUID id, String prompt, EvaluationQuestionType type, int position, long version, List<String> options) {
        public Question { options = List.copyOf(options); }
    }
    record Evaluation(UUID id, UUID organizationId, UUID programId, UUID activityId, String title,
            String instructions, List<Question> questions, long version, UUID sessionId) {
        public Evaluation { questions = List.copyOf(questions); }
    }
}
