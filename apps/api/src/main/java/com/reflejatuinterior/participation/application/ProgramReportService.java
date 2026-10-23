package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationDirectory;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProgramReportService {
    private final OrganizationAccess access;
    private final OrganizationTenantContext tenant;
    private final OrganizationDirectory organizations;
    private final ProgramDirectory programs;
    private final ProgramActivities activities;
    private final ActivityAssignments assignments;
    private final ActivityEvaluations evaluations;
    private final ActivityEvaluationResponses responses;
    private final Enrollments enrollments;
    private final CollaboratorInvitations people;
    private final SurveyResultsService surveys;

    ProgramReportService(OrganizationAccess access, OrganizationTenantContext tenant, OrganizationDirectory organizations,
            ProgramDirectory programs, ProgramActivities activities, ActivityAssignments assignments,
            ActivityEvaluations evaluations, ActivityEvaluationResponses responses, Enrollments enrollments,
            CollaboratorInvitations people, SurveyResultsService surveys) {
        this.access = access; this.tenant = tenant; this.organizations = organizations; this.programs = programs;
        this.activities = activities; this.assignments = assignments; this.evaluations = evaluations;
        this.responses = responses; this.enrollments = enrollments; this.people = people; this.surveys = surveys;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ProgramReport load(String subject, UUID org, UUID program, UUID enrollmentId, boolean exporting, String requestId) {
        OrganizationAccess.Context actor;
        try { actor = access.resolve(subject, org); }
        catch (OrganizationAccess.Unavailable e) { throw new ProgramActivities.Missing(); }
        if (!actor.roles().contains("CONSULTANT")) throw new OrganizationAccess.Denied();
        tenant.activate(actor.organizationId());
        var info = programs.find(org, program).orElseThrow(ProgramActivities.Missing::new);
        var company = organizations.reportInfo(org).orElseThrow(ProgramActivities.Missing::new);
        var generatedAt = Instant.now();
        var zone = ZoneId.of(company.timeZone());
        var today = generatedAt.atZone(zone).toLocalDate();
        var participants = new ArrayList<Enrollments.Data>();
        if (enrollmentId != null) participants.add(enrollments.find(org, program, enrollmentId).orElseThrow(EnrollmentNotFound::new));
        else {
            int page = 0;
            Enrollments.Page batch;
            do { batch = enrollments.list(org, program, page++, 100); participants.addAll(batch.items()); }
            while (page < batch.totalPages());
        }
        var definitions = activities.list(org, program).stream()
                .sorted(Comparator.comparingInt(ProgramActivities.Activity::dimensionPosition)
                        .thenComparingInt(ProgramActivities.Activity::sessionPosition).thenComparingInt(ProgramActivities.Activity::position)
                        .thenComparing(ProgramActivities.Activity::id)).toList();
        var surveyActivities = evaluations.list(org, program).stream().map(ActivityEvaluations.Evaluation::activityId).collect(Collectors.toSet());
        var assigned = assignments.listByActivities(org, program, definitions.stream().map(ProgramActivities.Activity::id).toList())
                .stream().filter(a -> enrollmentId == null || enrollmentId.equals(a.enrollmentId())).toList();
        var completed = responses.completedAtByAssignments(org, program, assigned.stream().map(ActivityAssignments.Data::id).toList());
        var work = new ArrayList<ProgramReport.Work>();
        var byActivity = assigned.stream().collect(Collectors.groupingBy(ActivityAssignments.Data::activityId));
        for (var definition : definitions) for (var assignment : byActivity.getOrDefault(definition.id(), List.of())) {
            var surveyAt = completed.get(assignment.id());
            boolean required = surveyActivities.contains(definition.id());
            int progress = assignment.submittedAt() == null ? 0 : required && surveyAt == null ? 50 : 100;
            // This is the latest submitted version, not a historical first-submission metric.
            boolean onTime = assignment.dueDate()!=null && assignment.submittedAt() != null && !assignment.submittedAt().atZone(zone).toLocalDate().isAfter(assignment.dueDate())
                    && (!required || surveyAt != null && !surveyAt.atZone(zone).toLocalDate().isAfter(assignment.dueDate()));
            work.add(new ProgramReport.Work(assignment.id(), assignment.enrollmentId(), definition.id(), definition.title(),
                    definition.moduleId(), definition.dimensionName(), definition.sessionId(), definition.sessionName(), assignment.dueDate(),
                    assignment.status(), assignment.submittedAt(), required, surveyAt, progress,
                    assignment.dueDate()!=null && !"COMPLETED".equals(assignment.status()) && assignment.dueDate().isBefore(today), onTime));
        }
        var byPerson = work.stream().collect(Collectors.groupingBy(ProgramReport.Work::enrollmentId));
        var personReports = participants.stream().map(p -> {
            var person = people.participant(org, p.membershipId());
            var name = java.util.stream.Stream.of(person.firstName(), person.lastName()).filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(" "));
            return new ProgramReport.Participant(p.id(), name.isBlank() ? person.email() : name, person.email(), p.status(),
                    summarize(byPerson.getOrDefault(p.id(), List.of()), 1, today));
        }).sorted(Comparator.comparing(ProgramReport.Participant::name).thenComparing(ProgramReport.Participant::enrollmentId)).toList();
        var counts = participants.stream().collect(Collectors.groupingBy(Enrollments.Data::status, LinkedHashMap::new, Collectors.counting()));
        var surveyReport = surveys.loadForReport(subject, org, program, enrollmentId, exporting, requestId);
        LoggerFactory.getLogger(ProgramReportService.class).info(
                "action={} actor={} organization={} program={} enrollment={} participants={} requestId={} result=SUCCESS",
                exporting ? "PROGRAM_REPORT_EXPORTED" : "PROGRAM_REPORT_VIEWED", actor.userId(), org, program, enrollmentId, participants.size(), requestId);
        return new ProgramReport(org, company.name(), program, info.name(), info.status(), info.startDate(), info.endDate(), generatedAt,
                zone.getId(), today, enrollmentId, summarize(work, participants.size(), today), counts, personReports, List.copyOf(work), surveyReport);
    }

    static ProgramReport.Summary summarize(List<ProgramReport.Work> work, int participantCount, LocalDate today) {
        int submitted = (int) work.stream().filter(w -> w.submittedAt() != null).count();
        int participating = (int) work.stream().filter(w -> w.submittedAt() != null).map(ProgramReport.Work::enrollmentId).distinct().count();
        int approved = count(work, "COMPLETED");
        int due = (int) work.stream().filter(w -> w.dueDate()!=null && w.dueDate().isBefore(today)).count();
        int onTime = (int) work.stream().filter(w -> w.dueDate()!=null && w.dueDate().isBefore(today) && w.onTime()).count();
        return new ProgramReport.Summary(participantCount, participating, work.size(), submitted, count(work, "ASSIGNED"), count(work, "SUBMITTED"),
                count(work, "CHANGES_REQUESTED"), approved, (int) work.stream().filter(ProgramReport.Work::overdue).count(),
                (int) work.stream().filter(ProgramReport.Work::surveyRequired).count(), (int) work.stream().filter(w -> w.surveyRequired() && w.surveyCompletedAt() != null).count(),
                due, onTime, work.isEmpty() ? null : round(work.stream().mapToInt(ProgramReport.Work::progressPercentage).average().orElseThrow()),
                rate(approved, work.size()), rate(participating, participantCount), rate(onTime, due));
    }
    private static int count(List<ProgramReport.Work> work, String status) { return (int) work.stream().filter(w -> status.equals(w.status())).count(); }
    private static Double rate(int numerator, int denominator) { return denominator == 0 ? null : round(100d * numerator / denominator); }
    private static double round(double value) { return Math.round(value * 100d) / 100d; }
}
