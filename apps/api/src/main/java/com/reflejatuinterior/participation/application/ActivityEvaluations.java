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

    record QuestionInput(String prompt, EvaluationQuestionType type, int position) {}
    record Question(UUID id, String prompt, EvaluationQuestionType type, int position, long version) {}
    record Evaluation(UUID id, UUID organizationId, UUID programId, UUID activityId, String title,
            String instructions, List<Question> questions, long version) {
        public Evaluation { questions = List.copyOf(questions); }
    }
}
