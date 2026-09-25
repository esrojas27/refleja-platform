package com.reflejatuinterior.programtemplate.application;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.ActivitySurveyBlueprints;
import com.reflejatuinterior.program.ProgramBlueprints;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ProgramTemplateService {
    private final OrganizationAccess access;
    private final OrganizationTenantContext tenantContext;
    private final ProgramBlueprints programs;
    private final ActivitySurveyBlueprints surveys;
    private final ProgramTemplates templates;

    ProgramTemplateService(OrganizationAccess access, OrganizationTenantContext tenantContext,
            ProgramBlueprints programs, ActivitySurveyBlueprints surveys, ProgramTemplates templates) {
        this.access = access;
        this.tenantContext = tenantContext;
        this.programs = programs;
        this.surveys = surveys;
        this.templates = templates;
    }

    @Transactional(readOnly = true)
    public ProgramTemplateReadiness readiness(String subject, UUID organizationId, UUID programId) {
        authorize(subject, organizationId);
        return assess(source(organizationId, programId)).readiness();
    }

    @Transactional(readOnly = true)
    public ProgramTemplatePage list(String subject, UUID organizationId, int page, int size) {
        authorize(subject, organizationId);
        if (page < 0) throw new InvalidProgramTemplateInput("page");
        if (size < 1 || size > 100) throw new InvalidProgramTemplateInput("size");
        if ((long) page * size > Integer.MAX_VALUE) throw new InvalidProgramTemplateInput("page");
        var result = templates.list(page, size);
        return new ProgramTemplatePage(result.items().stream().map(ProgramTemplateService::data).toList(),
                result.page(), result.size(), result.totalElements(), result.totalPages());
    }

    @Transactional
    public ProgramTemplateData createTemplate(String subject, UUID organizationId, UUID sourceProgramId,
            String name, String description, String requestId) {
        var context = authorize(subject, organizationId);
        var cleanName = name(name);
        var cleanDescription = description(description);
        var assessment = assess(source(organizationId, sourceProgramId));
        if (!assessment.readiness().eligible()) {
            throw new ProgramTemplateIncomplete(assessment.readiness().issues());
        }
        var stored = templates.create(organizationId, sourceProgramId, context.userId(), cleanName,
                cleanDescription, assessment.snapshot());
        audit("PROGRAM_TEMPLATE_CREATED", context.userId(), organizationId, stored.id(), requestId);
        return data(stored);
    }

    @Transactional
    public ProgramBlueprints.Program createProgram(String subject, UUID organizationId, UUID templateId,
            String name, String description, LocalDate startDate, LocalDate endDate, String requestId) {
        var context = authorize(subject, organizationId);
        var template = templates.find(templateId).orElseThrow(ProgramTemplateNotFound::new);
        var snapshot = template.snapshot();
        List<ProgramBlueprints.DimensionDraft> dimensions;
        try {
            dimensions = snapshot.dimensions().stream().map(dimension -> new ProgramBlueprints.DimensionDraft(
                    dimension.name(), dimension.description(), dimension.position(), dimension.sessions().stream()
                            .map(session -> new ProgramBlueprints.SessionDraft(session.name(), session.description(),
                                    session.objective(), startDate.plusDays(session.scheduledDayOffset()),
                                    session.position(), session.activities().stream()
                                            .map(activity -> new ProgramBlueprints.ActivityDraft(activity.reference(),
                                                    activity.title(), activity.instructions(), activity.youtubeUrl(),
                                                    startDate.plusDays(activity.dueDayOffset()), activity.position()))
                                            .toList()))
                            .toList())).toList();
        } catch (DateTimeException exception) {
            throw new InvalidProgramTemplateInput("startDate");
        }
        var created = programs.create(organizationId,
                new ProgramBlueprints.ProgramDraft(name, description, startDate, endDate), dimensions);
        for (var dimension : snapshot.dimensions()) {
            for (var session : dimension.sessions()) {
                for (var activity : session.activities()) {
                    var activityId = created.activityIds().get(activity.reference());
                    if (activityId == null) throw new IllegalStateException("Missing materialized activity");
                    var survey = activity.survey();
                    surveys.create(organizationId, created.program().id(), activityId,
                            new ActivitySurveyBlueprints.SurveyDraft(survey.title(), survey.instructions(),
                                    survey.questions().stream().map(question -> new ActivitySurveyBlueprints.Question(
                                            question.prompt(), question.type(), question.position())).toList()));
                }
            }
        }
        audit("PROGRAM_CREATED_FROM_TEMPLATE", context.userId(), organizationId, created.program().id(), requestId);
        return created.program();
    }

    private Assessment assess(ProgramBlueprints.Source source) {
        var issues = new LinkedHashSet<String>();
        if (source.startDate() == null || source.endDate() == null) issues.add("PROGRAM_WITHOUT_DATES");
        if (source.dimensions().isEmpty()) issues.add("MISSING_DIMENSIONS");
        var storedSurveys = surveys.list(source.organizationId(), source.id());
        Map<UUID, ActivitySurveyBlueprints.Survey> surveyByActivity = storedSurveys.stream()
                .collect(Collectors.toMap(ActivitySurveyBlueprints.Survey::activityId, Function.identity()));
        var dimensions = new ArrayList<ProgramTemplateSnapshot.Dimension>();
        int sessionCount = 0;
        int activityCount = 0;
        int surveyCount = 0;
        for (var dimension : source.dimensions()) {
            if (dimension.sessions().isEmpty()) issues.add("DIMENSION_WITHOUT_SESSIONS");
            var sessions = new ArrayList<ProgramTemplateSnapshot.Session>();
            for (var session : dimension.sessions()) {
                sessionCount++;
                if (session.activities().isEmpty()) issues.add("SESSION_WITHOUT_ACTIVITIES");
                var activities = new ArrayList<ProgramTemplateSnapshot.Activity>();
                for (var activity : session.activities()) {
                    activityCount++;
                    var survey = surveyByActivity.get(activity.id());
                    if (survey == null) {
                        issues.add("ACTIVITY_WITHOUT_SURVEY");
                        continue;
                    }
                    surveyCount++;
                    if (source.startDate() != null) {
                        activities.add(new ProgramTemplateSnapshot.Activity(activity.id().toString(),
                                activity.title(), activity.instructions(), activity.youtubeUrl(),
                                ChronoUnit.DAYS.between(source.startDate(), activity.dueDate()), activity.position(),
                                new ProgramTemplateSnapshot.Survey(survey.title(), survey.instructions(),
                                        survey.questions().stream().map(question -> new ProgramTemplateSnapshot.Question(
                                                question.prompt(), question.type(), question.position())).toList())));
                    }
                }
                if (source.startDate() != null) {
                    sessions.add(new ProgramTemplateSnapshot.Session(session.name(), session.description(),
                            session.objective(), ChronoUnit.DAYS.between(source.startDate(), session.scheduledDate()),
                            session.position(), activities));
                }
            }
            dimensions.add(new ProgramTemplateSnapshot.Dimension(dimension.name(), dimension.description(),
                    dimension.position(), sessions));
        }
        var readiness = new ProgramTemplateReadiness(issues.isEmpty(), source.dimensions().size(), sessionCount,
                activityCount, surveyCount, List.copyOf(issues));
        var duration = source.startDate() == null || source.endDate() == null ? 0
                : ChronoUnit.DAYS.between(source.startDate(), source.endDate());
        return new Assessment(readiness, new ProgramTemplateSnapshot(source.name(), source.description(),
                duration, dimensions));
    }

    private ProgramBlueprints.Source source(UUID organizationId, UUID programId) {
        return programs.find(organizationId, programId).orElseThrow(ProgramTemplateNotFound::new);
    }

    private OrganizationAccess.Context authorize(String subject, UUID organizationId) {
        OrganizationAccess.Context context;
        try {
            context = access.resolve(subject, organizationId);
        } catch (OrganizationAccess.Unavailable exception) {
            throw new ProgramTemplateNotFound();
        }
        if (!context.roles().contains("CONSULTANT")) throw new OrganizationAccess.Denied();
        tenantContext.activate(context.organizationId());
        return context;
    }

    private static String name(String value) {
        if (value == null || value.isBlank() || value.length() > 255
                || value.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidProgramTemplateInput("name");
        }
        return value.strip();
    }

    private static String description(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.length() > 10000 || value.indexOf('\0') >= 0) {
            throw new InvalidProgramTemplateInput("description");
        }
        return value.strip();
    }

    private static ProgramTemplateData data(ProgramTemplates.Stored stored) {
        var snapshot = stored.snapshot();
        int sessions = snapshot.dimensions().stream().mapToInt(dimension -> dimension.sessions().size()).sum();
        int activities = snapshot.dimensions().stream().flatMap(dimension -> dimension.sessions().stream())
                .mapToInt(session -> session.activities().size()).sum();
        return new ProgramTemplateData(stored.id(), stored.sourceOrganizationId(), stored.sourceProgramId(),
                stored.name(), stored.description(), snapshot.sourceName(), snapshot.durationDays(),
                snapshot.dimensions().size(), sessions, activities, activities, stored.createdAt(), stored.version());
    }

    private static void audit(String action, UUID actor, UUID organizationId, UUID resourceId, String requestId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(ProgramTemplateService.class).info(
                        "action={} actor={} organization={} resource=ProgramTemplate resourceId={} requestId={} timestamp={} result=SUCCESS",
                        action, actor, organizationId, resourceId, requestId, Instant.now());
            }
        });
    }

    private record Assessment(ProgramTemplateReadiness readiness, ProgramTemplateSnapshot snapshot) {}
}
