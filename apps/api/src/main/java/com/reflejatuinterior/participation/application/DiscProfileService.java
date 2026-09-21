package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.domain.InvalidDiscProfile;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class DiscProfileService {
    private final OrganizationAccess organizationAccess;
    private final CollaboratorInvitations invitations;
    private final ProgramDirectory programs;
    private final Enrollments enrollments;
    private final DiscProfiles profiles;
    private final OrganizationTenantContext tenantContext;

    DiscProfileService(OrganizationAccess organizationAccess, CollaboratorInvitations invitations,
            ProgramDirectory programs, Enrollments enrollments, DiscProfiles profiles,
            OrganizationTenantContext tenantContext) {
        this.organizationAccess = organizationAccess; this.invitations = invitations;
        this.programs = programs; this.enrollments = enrollments;
        this.profiles = profiles; this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public List<Response> list(String subject, UUID organizationId, UUID programId, String requestId) {
        var context = authorize(subject, organizationId, programId, "VIEW_PROGRAM_DISC", requestId);
        var eligible = eligibleEnrollments(context.organizationId(), programId);
        Map<UUID, DiscProfiles.Data> saved = profiles.findAll(context.organizationId(), programId,
                eligible.stream().map(Enrollments.Data::id).toList()).stream()
                .collect(Collectors.toMap(DiscProfiles.Data::enrollmentId, Function.identity()));
        return eligible.stream().map(enrollment -> response(enrollment, saved.get(enrollment.id()))).toList();
    }

    @Transactional
    public Response save(String subject, UUID organizationId, UUID programId, UUID enrollmentId,
            String dominant, String influential, String serene, String conscientious,
            Long expectedVersion, String requestId) {
        var context = authorize(subject, organizationId, programId, "EDIT_PROGRAM_DISC", requestId);
        var eligible = eligibleEnrollments(context.organizationId(), programId).stream()
                .filter(enrollment -> enrollment.id().equals(enrollmentId)).findFirst()
                .orElseThrow(EnrollmentNotFound::new);
        var texts = new DiscProfiles.Texts(clean(dominant, "dominant"), clean(influential, "influential"),
                clean(serene, "serene"), clean(conscientious, "conscientious"));
        var saved = profiles.save(context.organizationId(), programId, enrollmentId,
                texts, expectedVersion, context.userId());
        auditAfterCommit(context.userId(), context.organizationId(), programId, enrollmentId, requestId);
        return response(eligible, saved);
    }

    private OrganizationAccess.Context authorize(String subject, UUID organizationId, UUID programId,
            String operation, String requestId) {
        OrganizationAccess.Context context;
        try {
            context = organizationAccess.resolve(subject, organizationId);
        } catch (OrganizationAccess.Unavailable exception) {
            denied(null, organizationId, programId, operation, requestId); throw new ProgramActivities.Missing();
        } catch (OrganizationAccess.Denied exception) {
            denied(null, organizationId, programId, operation, requestId); throw exception;
        }
        boolean consultant = context.roles().contains("CONSULTANT");
        boolean leader = context.roles().contains("LEADER");
        if (!consultant && !leader) {
            denied(context.userId(), organizationId, programId, operation, requestId);
            throw new OrganizationAccess.Denied();
        }
        tenantContext.activate(context.organizationId());
        if (programs.find(context.organizationId(), programId).isEmpty()) throw new ProgramActivities.Missing();
        if (!consultant && (context.membershipId() == null
                || enrollments.findOwned(context.organizationId(), context.membershipId(), programId).isEmpty())) {
            denied(context.userId(), organizationId, programId, operation, requestId);
            throw new OrganizationAccess.Denied();
        }
        return context;
    }

    private List<Enrollments.Data> eligibleEnrollments(UUID organizationId, UUID programId) {
        return enrollments.findParticipants(organizationId, programId).stream()
                .filter(enrollment -> invitations.participantRoles(organizationId, enrollment.membershipId())
                        .contains("COLLABORATOR"))
                .toList();
    }

    private Response response(Enrollments.Data enrollment, DiscProfiles.Data profile) {
        var participant = invitations.participant(enrollment.organizationId(), enrollment.membershipId());
        var details = profile == null ? null : new Profile(profile.id(), profile.dominant(), profile.influential(),
                profile.serene(), profile.conscientious(), profile.updatedAt(), profile.version());
        return new Response(enrollment.id(), enrollment.status(), participant.email(), participant.firstName(),
                participant.lastName(), details);
    }

    private static String clean(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 5000) throw new InvalidDiscProfile(field);
        var clean = value.strip();
        if (clean.codePoints().anyMatch(character -> Character.isISOControl(character)
                && character != '\n' && character != '\r' && character != '\t')) throw new InvalidDiscProfile(field);
        return clean;
    }

    private static void auditAfterCommit(UUID actor, UUID organizationId, UUID programId,
            UUID enrollmentId, String requestId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(DiscProfileService.class).info(
                        "action=PROGRAM_DISC_SAVED actor={} organization={} resource=Enrollment resourceId={} program={} requestId={} timestamp={} result=SUCCESS",
                        actor, organizationId, enrollmentId, programId, requestId, Instant.now());
            }
        });
    }

    private static void denied(UUID actor, UUID organizationId, UUID programId, String operation, String requestId) {
        LoggerFactory.getLogger(DiscProfileService.class).info(
                "action=AUTHORIZATION_DENIED operation={} actor={} organization={} resource=Program resourceId={} requestId={} timestamp={} result=DENIED",
                operation, actor, organizationId, programId, requestId, Instant.now());
    }

    public record Profile(UUID id, String dominant, String influential, String serene,
            String conscientious, Instant updatedAt, long version) {}
    public record Response(UUID enrollmentId, String enrollmentStatus, String email,
            String firstName, String lastName, Profile profile) {}
}
