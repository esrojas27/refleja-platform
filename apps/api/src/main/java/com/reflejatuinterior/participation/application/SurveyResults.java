package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;

/** Immutable read model; contains only survey answers, never activity submissions or DISC. */
public record SurveyResults(UUID programId, String programName, Instant generatedAt, Scope scope,
        List<ActivityOption> options, Summary summary, List<Comparison> dimensions,
        List<Comparison> sessions, List<Comparison> activities, List<Survey> surveys) {
    public record Scope(UUID dimensionId, UUID sessionId, UUID activityId) {}
    public record ActivityOption(UUID id, String title, UUID dimensionId, String dimensionName, UUID sessionId, String sessionName) {}
    public record Summary(int surveyCount, int assignedCount, int responseCount, int pendingCount,
            int participantCount, int respondentCount, Double responseRate, Double agreementAverage,
            int agreementAnswers, Double likelihoodAverage, int likelihoodAnswers) {}
    public record Comparison(UUID id, String name, String context, Summary summary) {}
    public record OptionCount(String value, String label, int count, double percentage) {}
    public record Question(UUID id, String prompt, EvaluationQuestionType type, int position,
            int responseCount, Double average, List<OptionCount> distribution) {}
    public record Respondent(UUID responseId, UUID enrollmentId, String name, String email,
            Instant completedAt, List<ActivityEvaluationResponses.Answer> answers) {}
    public record Survey(UUID id, String title, ActivityOption activity, Summary summary,
            List<Question> questions, List<Respondent> responses) {}
}
