package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;

/** Global immutable definitions; participant answers never enter this contract. */
public interface QuestionnaireTemplates {
    Stored create(UUID org, UUID program, UUID evaluation, UUID actor, String name, String description, Snapshot snapshot);
    Page list(int page, int size);
    Optional<Stored> find(UUID id);

    record Question(String prompt, EvaluationQuestionType type, int position, List<String> options) {
        public Question { options = List.copyOf(options); }
    }
    record Snapshot(String title, String instructions, List<Question> questions) {
        public Snapshot { questions = List.copyOf(questions); }
    }
    record Summary(UUID id, String name, String description, int questionCount, Instant createdAt) {}
    record Stored(Summary summary, Snapshot definition) {}
    record Page(List<Summary> items, int page, int size, long totalElements, int totalPages) {
        public Page { items = List.copyOf(items); }
    }
}
