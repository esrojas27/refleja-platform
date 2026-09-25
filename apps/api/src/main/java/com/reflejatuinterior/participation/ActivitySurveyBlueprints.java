package com.reflejatuinterior.participation;

import java.util.List;
import java.util.UUID;

/** Public survey API used by immutable program templates. */
public interface ActivitySurveyBlueprints {
    List<Survey> list(UUID organizationId, UUID programId);

    void create(UUID organizationId, UUID programId, UUID activityId, SurveyDraft survey);

    record Survey(UUID activityId, String title, String instructions, List<Question> questions) {
        public Survey { questions = List.copyOf(questions); }
    }

    record Question(String prompt, String type, int position) {}

    record SurveyDraft(String title, String instructions, List<Question> questions) {
        public SurveyDraft { questions = List.copyOf(questions); }
    }
}
