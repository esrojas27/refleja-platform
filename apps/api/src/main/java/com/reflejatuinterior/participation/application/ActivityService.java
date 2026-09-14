package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorAccess;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.domain.InvalidActivityAssignment;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ActivityService {
    private final OrganizationAccess organizationAccess;
    private final CollaboratorAccess collaboratorAccess;
    private final CollaboratorInvitations participants;
    private final ProgramDirectory programs;
    private final ProgramActivities activities;
    private final Enrollments enrollments;
    private final ActivityAssignments assignments;
    private final OrganizationTenantContext tenantContext;

    ActivityService(OrganizationAccess organizationAccess, CollaboratorAccess collaboratorAccess,
            CollaboratorInvitations participants, ProgramDirectory programs, ProgramActivities activities,
            Enrollments enrollments, ActivityAssignments assignments, OrganizationTenantContext tenantContext) {
        this.organizationAccess = organizationAccess;
        this.collaboratorAccess = collaboratorAccess;
        this.participants = participants;
        this.programs = programs;
        this.activities = activities;
        this.enrollments = enrollments;
        this.assignments = assignments;
        this.tenantContext = tenantContext;
    }

    @Transactional
    public ActivityResponse create(String subject, UUID organizationId, UUID programId, UUID sessionId,
            String title, String instructions, LocalDate dueDate, int position,
            List<UUID> enrollmentIds, String requestId) {
        var context = authorizeConsultant(subject, organizationId, programId, "CREATE_ACTIVITY", requestId);
        var uniqueEnrollmentIds = new LinkedHashSet<>(enrollmentIds);
        if (uniqueEnrollmentIds.isEmpty() || uniqueEnrollmentIds.size() != enrollmentIds.size()) {
            throw new InvalidActivityAssignment("enrollmentIds");
        }
        var activeEnrollments = enrollments.findActive(context.organizationId(), programId, uniqueEnrollmentIds);
        if (activeEnrollments.size() != uniqueEnrollmentIds.size()) throw new EnrollmentNotFound();

        var activity = activities.create(context.organizationId(), programId, sessionId,
                title, instructions, dueDate, position);
        var createdAssignments = assignments.create(context.organizationId(), programId, activity.id(), uniqueEnrollmentIds);
        auditAfterCommit("PROGRAM_ACTIVITY_ASSIGNED", context.userId(), context.organizationId(), activity.id(), requestId);
        return response(activity, createdAssignments);
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> listForConsultant(String subject, UUID organizationId, UUID programId,
            String requestId) {
        authorizeConsultant(subject, organizationId, programId, "VIEW_PROGRAM_ACTIVITIES", requestId);
        var definitions = activities.list(organizationId, programId);
        var assigned = assignments.listByActivities(organizationId, programId,
                definitions.stream().map(ProgramActivities.Activity::id).toList());
        return definitions.stream().map(activity -> response(activity, assigned.stream()
                .filter(assignment -> assignment.activityId().equals(activity.id())).toList())).toList();
    }

    @Transactional(readOnly = true)
    public List<AssignedActivityResponse> listOwned(String subject, UUID programId, String requestId) {
        CollaboratorAccess.Context context;
        try {
            context = collaboratorAccess.resolve(subject);
        } catch (CollaboratorAccess.Denied exception) {
            denied(null, null, programId, "VIEW_ASSIGNED_ACTIVITIES", requestId);
            throw exception;
        }
        for (var membership : context.memberships().stream()
                .sorted(Comparator.comparing(CollaboratorAccess.Membership::organizationId)).toList()) {
            tenantContext.activate(membership.organizationId());
            var enrollment = enrollments.findOwned(membership.organizationId(), membership.id(), programId);
            if (enrollment.isEmpty()) continue;
            var ownedAssignments = assignments.listOwned(membership.organizationId(), programId, enrollment.get().id());
            var definitions = activities.findAll(membership.organizationId(), programId,
                    ownedAssignments.stream().map(ActivityAssignments.Data::activityId).toList());
            return definitions.stream().map(AssignedActivityResponse::from).toList();
        }
        denied(context.userId(), null, programId, "VIEW_ASSIGNED_ACTIVITIES", requestId);
        throw new MyProgramNotFound();
    }

    private OrganizationAccess.Context authorizeConsultant(String subject, UUID organizationId, UUID programId,
            String operation, String requestId) {
        OrganizationAccess.Context context;
        try {
            context = organizationAccess.resolve(subject, organizationId);
        } catch (OrganizationAccess.Unavailable exception) {
            denied(null, organizationId, programId, operation, requestId);
            throw new ProgramActivities.Missing();
        } catch (OrganizationAccess.Denied exception) {
            denied(null, organizationId, programId, operation, requestId);
            throw exception;
        }
        if (!context.roles().contains("CONSULTANT")) {
            denied(context.userId(), organizationId, programId, operation, requestId);
            throw new OrganizationAccess.Denied();
        }
        tenantContext.activate(context.organizationId());
        if (programs.find(context.organizationId(), programId).isEmpty()) {
            denied(context.userId(), organizationId, programId, operation, requestId);
            throw new ProgramActivities.Missing();
        }
        return context;
    }

    private ActivityResponse response(ProgramActivities.Activity activity,
            List<ActivityAssignments.Data> activityAssignments) {
        var assignees = new ArrayList<AssigneeResponse>(activityAssignments.size());
        for (var assignment : activityAssignments) {
            var enrollment = enrollments.find(activity.organizationId(), activity.programId(), assignment.enrollmentId())
                    .orElseThrow(EnrollmentNotFound::new);
            var participant = participants.participant(activity.organizationId(), enrollment.membershipId());
            assignees.add(new AssigneeResponse(enrollment.id(), participant.email(),
                    participant.firstName(), participant.lastName()));
        }
        return new ActivityResponse(activity.id(), activity.organizationId(), activity.programId(),
                activity.moduleId(), activity.sessionId(), activity.title(), activity.instructions(),
                activity.dueDate(), activity.position(), activity.version(), assignees);
    }

    private static void auditAfterCommit(String action, UUID actor, UUID organizationId,
            UUID activityId, String requestId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(ActivityService.class).info(
                        "action={} actor={} organization={} resource=Activity resourceId={} requestId={} timestamp={} result=SUCCESS",
                        action, actor, organizationId, activityId, requestId, Instant.now());
            }
        });
    }

    private static void denied(UUID actor, UUID organizationId, UUID programId, String operation, String requestId) {
        LoggerFactory.getLogger(ActivityService.class).info(
                "action=AUTHORIZATION_DENIED operation={} actor={} organization={} resource=Program resourceId={} requestId={} timestamp={} result=DENIED",
                operation, actor, organizationId, programId, requestId, Instant.now());
    }

    public record AssigneeResponse(UUID enrollmentId, String email, String firstName, String lastName) {}
    public record ActivityResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId, UUID sessionId,
            String title, String instructions, LocalDate dueDate, int position, long version,
            List<AssigneeResponse> assignees) {
        public ActivityResponse { assignees = List.copyOf(assignees); }
    }
    public record AssignedActivityResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId,
            UUID sessionId, String title, String instructions, LocalDate dueDate, int position, long version) {
        static AssignedActivityResponse from(ProgramActivities.Activity activity) {
            return new AssignedActivityResponse(activity.id(), activity.organizationId(), activity.programId(),
                    activity.moduleId(), activity.sessionId(), activity.title(), activity.instructions(),
                    activity.dueDate(), activity.position(), activity.version());
        }
    }
}
