package com.reflejatuinterior.participation.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SurveyResultsService {
    private final OrganizationAccess access;
    private final OrganizationTenantContext tenant;
    private final ProgramDirectory programs;
    private final ProgramActivities activities;
    private final ActivityEvaluations evaluations;
    private final ActivityAssignments assignments;
    private final ActivityEvaluationResponses responses;
    private final Enrollments enrollments;
    private final CollaboratorInvitations people;

    SurveyResultsService(OrganizationAccess access, OrganizationTenantContext tenant, ProgramDirectory programs,
            ProgramActivities activities, ActivityEvaluations evaluations, ActivityAssignments assignments,
            ActivityEvaluationResponses responses, Enrollments enrollments, CollaboratorInvitations people) {
        this.access = access; this.tenant = tenant; this.programs = programs; this.activities = activities;
        this.evaluations = evaluations; this.assignments = assignments; this.responses = responses;
        this.enrollments = enrollments; this.people = people;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public SurveyResults load(String subject, UUID org, UUID program, SurveyResults.Scope scope, boolean exporting, String requestId) {
        return loadScoped(subject, org, program, scope, null, exporting, requestId);
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public SurveyResults loadForReport(String subject, UUID org, UUID program, UUID enrollmentId, boolean exporting, String requestId) {
        return loadScoped(subject, org, program, new SurveyResults.Scope(null, null, null), enrollmentId, exporting, requestId);
    }

    private SurveyResults loadScoped(String subject, UUID org, UUID program, SurveyResults.Scope scope,
            UUID enrollmentId, boolean exporting, String requestId) {
        OrganizationAccess.Context actor;
        try { actor = access.resolve(subject, org); }
        catch (OrganizationAccess.Unavailable e) { denied(org, program, requestId); throw new ProgramActivities.Missing(); }
        catch (OrganizationAccess.Denied e) { denied(org, program, requestId); throw e; }
        if (!actor.roles().contains("CONSULTANT")) { denied(org, program, requestId); throw new OrganizationAccess.Denied(); }
        tenant.activate(actor.organizationId());
        var info = programs.find(org, program).orElseThrow(ProgramActivities.Missing::new);
        var surveyByActivity = evaluations.list(org, program).stream()
                .collect(java.util.stream.Collectors.toMap(ActivityEvaluations.Evaluation::activityId, Function.identity()));
        var definitions = activities.list(org, program).stream().filter(a -> surveyByActivity.containsKey(a.id())).toList();
        // Every supplied filter must resolve inside this same authorized program,
        // and nested filters must describe a valid parent/child combination.
        var selected = definitions.stream().filter(a -> matches(a, scope)).toList();
        if ((scope.dimensionId() != null || scope.sessionId() != null || scope.activityId() != null) && selected.isEmpty())
            throw new ProgramActivities.Missing();
        if (enrollmentId != null) enrollments.find(org, program, enrollmentId).orElseThrow(EnrollmentNotFound::new);
        var assigned = assignments.listByActivities(org, program, selected.stream().map(ProgramActivities.Activity::id).toList())
                .stream().filter(a -> enrollmentId == null || a.enrollmentId().equals(enrollmentId)).toList();
        var stored = responses.listByAssignments(org, program, assigned.stream().map(ActivityAssignments.Data::id).toList());
        var names = new LinkedHashMap<UUID, CollaboratorInvitations.Participant>();
        // Resolve each respondent once, through the identity-owned public port.
        for (var respondentId : stored.stream().map(ActivityEvaluationResponses.Response::enrollmentId).distinct().toList()) {
            var enrollment = enrollments.find(org, program, respondentId).orElseThrow(EnrollmentNotFound::new);
            names.put(respondentId, people.participant(org, enrollment.membershipId()));
        }
        var output = new ArrayList<SurveyResults.Survey>();
        for (var activity : selected) {
            var survey = surveyByActivity.get(activity.id());
            var current = stored.stream().filter(r -> r.evaluationId().equals(survey.id())).toList();
            var currentAssignments = assigned.stream().filter(a -> a.activityId().equals(activity.id())).toList();
            var questions = survey.questions().stream().sorted(Comparator.comparingInt(ActivityEvaluations.Question::position))
                    .map(q -> question(q, current)).toList();
            var respondents = current.stream().map(r -> {
                var person = names.get(r.enrollmentId());
                var name = java.util.stream.Stream.of(person.firstName(), person.lastName()).filter(s -> s != null && !s.isBlank())
                        .collect(java.util.stream.Collectors.joining(" "));
                return new SurveyResults.Respondent(r.id(), r.enrollmentId(), name.isBlank() ? person.email() : name,
                        person.email(), r.completedAt(), r.answers());
            }).toList();
            output.add(new SurveyResults.Survey(survey.id(), survey.title(), option(activity),
                    summarize(List.of(survey), currentAssignments, current), questions, respondents));
        }
        var selectedSurveys = selected.stream().map(a -> surveyByActivity.get(a.id())).toList();
        var result = new SurveyResults(program, info.name(), Instant.now(), scope, definitions.stream().map(SurveyResultsService::option).toList(),
                summarize(selectedSurveys, assigned, stored),
                comparisons(selected, assigned, stored, surveyByActivity, "DIMENSION"),
                comparisons(selected, assigned, stored, surveyByActivity, "SESSION"),
                comparisons(selected, assigned, stored, surveyByActivity, "ACTIVITY"), List.copyOf(output));
        LoggerFactory.getLogger(SurveyResultsService.class).info(
                "action={} actor={} organization={} program={} dimension={} session={} activity={} responses={} requestId={} timestamp={} result=SUCCESS",
                exporting ? "SURVEY_RESULTS_EXPORTED" : "SURVEY_RESULTS_VIEWED", actor.userId(), org, program,
                scope.dimensionId(), scope.sessionId(), scope.activityId(), stored.size(), requestId, Instant.now());
        return result;
    }

    private static boolean matches(ProgramActivities.Activity a, SurveyResults.Scope scope) {
        return (scope.dimensionId() == null || scope.dimensionId().equals(a.moduleId()))
                && (scope.sessionId() == null || scope.sessionId().equals(a.sessionId()))
                && (scope.activityId() == null || scope.activityId().equals(a.id()));
    }
    private static SurveyResults.ActivityOption option(ProgramActivities.Activity a) {
        return new SurveyResults.ActivityOption(a.id(), a.title(), a.moduleId(), a.dimensionName(), a.sessionId(), a.sessionName());
    }
    private static List<SurveyResults.Comparison> comparisons(List<ProgramActivities.Activity> activities,
            List<ActivityAssignments.Data> assigned, List<ActivityEvaluationResponses.Response> responses,
            Map<UUID, ActivityEvaluations.Evaluation> surveys, String level) {
        var grouped = activities.stream().collect(java.util.stream.Collectors.groupingBy(a -> switch (level) {
            case "DIMENSION" -> a.moduleId(); case "SESSION" -> a.sessionId(); default -> a.id();
        }, LinkedHashMap::new, java.util.stream.Collectors.toList()));
        return grouped.entrySet().stream().map(entry -> {
            var group = entry.getValue(); var first = group.getFirst();
            var activityIds = group.stream().map(ProgramActivities.Activity::id).collect(java.util.stream.Collectors.toSet());
            var definitions = group.stream().map(a -> surveys.get(a.id())).toList();
            var surveyIds = definitions.stream().map(ActivityEvaluations.Evaluation::id).collect(java.util.stream.Collectors.toSet());
            var summary = summarize(definitions, assigned.stream().filter(a -> activityIds.contains(a.activityId())).toList(),
                    responses.stream().filter(r -> surveyIds.contains(r.evaluationId())).toList());
            return new SurveyResults.Comparison(entry.getKey(), switch (level) {
                case "DIMENSION" -> first.dimensionName(); case "SESSION" -> first.sessionName(); default -> first.title();
            }, switch (level) { case "SESSION" -> first.dimensionName(); case "ACTIVITY" -> first.dimensionName() + " · " + first.sessionName(); default -> ""; }, summary);
        }).toList();
    }
    private static SurveyResults.Summary summarize(List<ActivityEvaluations.Evaluation> surveys,
            List<ActivityAssignments.Data> assigned, List<ActivityEvaluationResponses.Response> responses) {
        var types = surveys.stream().flatMap(s -> s.questions().stream())
                .collect(java.util.stream.Collectors.toMap(ActivityEvaluations.Question::id, ActivityEvaluations.Question::type));
        var agreement = new ArrayList<Integer>(); var likelihood = new ArrayList<Integer>();
        responses.stream().flatMap(r -> r.answers().stream()).forEach(answer -> {
            if (types.get(answer.questionId()) == EvaluationQuestionType.AGREEMENT_SCALE) answer.values().forEach(v -> agreement.add(Integer.parseInt(v)));
            if (types.get(answer.questionId()) == EvaluationQuestionType.LIKELIHOOD_SCALE) answer.values().forEach(v -> likelihood.add(Integer.parseInt(v)));
        });
        return new SurveyResults.Summary(surveys.size(), assigned.size(), responses.size(), assigned.size() - responses.size(),
                (int) assigned.stream().map(ActivityAssignments.Data::enrollmentId).distinct().count(),
                (int) responses.stream().map(ActivityEvaluationResponses.Response::enrollmentId).distinct().count(),
                assigned.isEmpty() ? null : rounded(100d * responses.size() / assigned.size()), average(agreement), agreement.size(),
                average(likelihood), likelihood.size());
    }
    private static SurveyResults.Question question(ActivityEvaluations.Question q, List<ActivityEvaluationResponses.Response> responses) {
        var values = responses.stream().flatMap(r -> r.answers().stream()).filter(a -> a.questionId().equals(q.id())).toList();
        var counts = values.stream().flatMap(a -> a.values().stream())
                .collect(java.util.stream.Collectors.groupingBy(Function.identity(), java.util.stream.Collectors.counting()));
        List<String> options = switch (q.type()) {
            case AGREEMENT_SCALE, LIKELIHOOD_SCALE, NUMERIC_SCALE -> List.of("1", "2", "3", "4", "5");
            case EMOTION_MULTI_SELECT -> EMOTIONS; case OPEN_TEXT -> List.of();
        };
        var distribution = options.stream().map(value -> new SurveyResults.OptionCount(value, label(q.type(), value),
                counts.getOrDefault(value, 0L).intValue(), values.isEmpty() ? 0 : rounded(100d * counts.getOrDefault(value, 0L) / values.size())))
                .sorted(q.type() == EvaluationQuestionType.EMOTION_MULTI_SELECT
                        ? Comparator.comparingInt(SurveyResults.OptionCount::count).reversed()
                        : (a, b) -> 0).toList();
        boolean scale = q.type() == EvaluationQuestionType.AGREEMENT_SCALE || q.type() == EvaluationQuestionType.LIKELIHOOD_SCALE
                || q.type() == EvaluationQuestionType.NUMERIC_SCALE;
        return new SurveyResults.Question(q.id(), q.prompt(), q.type(), q.position(), values.size(),
                scale ? average(values.stream().flatMap(a -> a.values().stream()).map(Integer::parseInt).toList()) : null, distribution);
    }
    private static Double average(List<Integer> values) {
        return values.isEmpty() ? null : rounded(values.stream().mapToInt(Integer::intValue).average().orElseThrow());
    }
    private static double rounded(double value) { return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue(); }
    public static String label(EvaluationQuestionType type, String value) {
        if (type == EvaluationQuestionType.AGREEMENT_SCALE) return AGREEMENT.get(Integer.parseInt(value) - 1);
        if (type == EvaluationQuestionType.LIKELIHOOD_SCALE) return LIKELIHOOD.get(Integer.parseInt(value) - 1);
        return value;
    }
    private static final List<String> AGREEMENT = List.of("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo");
    private static final List<String> LIKELIHOOD = List.of("Muy improbable", "Improbable", "No estoy seguro(a)", "Probable", "Muy probable");
    private static final List<String> EMOTIONS = List.of("Inspirado(a)", "Motivado(a)", "Reflexivo(a)", "Sorprendido(a)", "Retado(a)", "Confundido(a)", "Indiferente");
    private static void denied(UUID org, UUID program, String requestId) {
        LoggerFactory.getLogger(SurveyResultsService.class).info(
                "action=AUTHORIZATION_DENIED operation=SURVEY_RESULTS organization={} program={} requestId={} result=DENIED", org, program, requestId);
    }
}
