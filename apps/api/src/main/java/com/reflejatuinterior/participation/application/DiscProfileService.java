package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.CollaboratorAccess;
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
    private final ParticipantFileService files;
    private final CollaboratorAccess collaboratorAccess;

    DiscProfileService(OrganizationAccess organizationAccess, CollaboratorInvitations invitations,
            ProgramDirectory programs, Enrollments enrollments, DiscProfiles profiles,
            OrganizationTenantContext tenantContext, ParticipantFileService files, CollaboratorAccess collaboratorAccess) {
        this.organizationAccess = organizationAccess; this.invitations = invitations;
        this.programs = programs; this.enrollments = enrollments;
        this.profiles = profiles; this.tenantContext = tenantContext; this.files = files; this.collaboratorAccess = collaboratorAccess;
    }

    @Transactional(readOnly = true)
    public List<Response> list(String subject, UUID organizationId, UUID programId, String requestId) {
        var context = authorize(subject, organizationId, programId, "VIEW_PROGRAM_DISC", requestId);
        var eligible = eligibleEnrollments(context.organizationId(), programId, context.roles().contains("CONSULTANT"));
        Map<UUID, DiscProfiles.Data> saved = profiles.findAll(context.organizationId(), programId,
                eligible.stream().map(Enrollments.Data::id).toList()).stream()
                .collect(Collectors.toMap(DiscProfiles.Data::enrollmentId, Function.identity()));
        boolean editable = context.roles().contains("CONSULTANT") && programs.find(organizationId, programId)
                .filter(p -> !p.status().equals("COMPLETED") && !p.status().equals("CANCELLED")).isPresent();
        return eligible.stream().map(enrollment -> response(enrollment, saved.get(enrollment.id()), editable)).toList();
    }

    @Transactional(readOnly = true)
    public OwnResponse own(String subject, UUID programId) {
        for (var membership : collaboratorAccess.resolve(subject).memberships()) {
            var org = membership.organizationId();
            tenantContext.activate(org);
            var enrollment = enrollments.findOwned(org, membership.id(), programId);
            if (enrollment.isEmpty()) continue;
            var program = programs.find(org, programId).orElseThrow(MyProgramNotFound::new);
            if (!program.activated()) return new OwnResponse(null);
            var profile = profiles.findAll(org, programId, List.of(enrollment.get().id())).stream().findFirst();
            if (profile.isEmpty()) return new OwnResponse(null);
            var data = profile.get();
            if (data.dominant() == null || data.influential() == null || data.serene() == null || data.conscientious() == null)
                return new OwnResponse(null);
            return new OwnResponse(new Profile(data.id(), data.dominant(), data.influential(), data.serene(),
                    data.conscientious(), data.updatedAt(), data.version(), false));
        }
        throw new MyProgramNotFound();
    }

    @Transactional
    public Response save(String subject, UUID organizationId, UUID programId, UUID enrollmentId,
            Integer dominant, Integer influential, Integer serene, Integer conscientious,
            Long expectedVersion, String requestId) {
        var context = authorize(subject, organizationId, programId, "EDIT_PROGRAM_DISC", requestId);
        programs.lock(context.organizationId(), programId).orElseThrow(ProgramActivities.Missing::new).requireEditable();
        context=authorize(subject,organizationId,programId,"EDIT_PROGRAM_DISC",requestId);
        enrollments.lock(organizationId,programId,enrollmentId);
        var eligible = eligibleEnrollments(context.organizationId(), programId, true).stream()
                .filter(enrollment -> enrollment.id().equals(enrollmentId)).findFirst()
                .orElseThrow(EnrollmentNotFound::new);
        var percentages = new DiscProfiles.Percentages(clean(dominant, "dominant"), clean(influential, "influential"),
                clean(serene, "serene"), clean(conscientious, "conscientious"));
        var saved = profiles.save(context.organizationId(), programId, enrollmentId,
                percentages, expectedVersion, context.userId());
        auditAfterCommit(context.userId(), context.organizationId(), programId, enrollmentId, requestId);
        return response(eligible, saved, true);
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
        boolean reader = context.roles().contains("LEADER") || context.roles().contains("COMPANY_ADMIN");
        if (!consultant && (!reader || !operation.equals("VIEW_PROGRAM_DISC"))) {
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

    private List<Enrollments.Data> eligibleEnrollments(UUID organizationId, UUID programId, boolean includeInvited) {
        var candidates = enrollments.findParticipants(organizationId, programId).stream();
        if (includeInvited) candidates = java.util.stream.Stream.concat(candidates,
                enrollments.findInvited(organizationId, programId).stream());
        return candidates.filter(enrollment -> {
                    if (!"INVITED".equals(enrollment.status())) return invitations
                            .participantRoles(organizationId, enrollment.membershipId()).contains("COLLABORATOR");
                    if (enrollment.invitationId() == null) return false;
                    var invitation = invitations.findInOrganization(organizationId, enrollment.invitationId());
                    return invitation.role() == CollaboratorInvitations.InvitedRole.COLLABORATOR
                            && !"REVOKED".equals(invitation.status());
                })
                .sorted(java.util.Comparator.comparing(Enrollments.Data::id))
                .toList();
    }

    private Response response(Enrollments.Data enrollment, DiscProfiles.Data profile, boolean canEdit) {
        var participant = invitations.participant(enrollment.organizationId(), enrollment.membershipId());
        var details = profile == null ? null : new Profile(profile.id(), profile.dominant(), profile.influential(),
                profile.serene(), profile.conscientious(), profile.updatedAt(), profile.version(), profile.dominant() == null);
        return new Response(enrollment.id(), enrollment.status(), participant.email(), participant.firstName(),
                participant.lastName(), details, canEdit);
    }

    @Transactional
    public ParticipantFiles.Data uploadPdf(String subject,UUID org,UUID program,UUID enrollment,byte[] bytes,String requestId) {
        authorize(subject,org,program,"UPLOAD_DISC_PDF",requestId);
        programs.lock(org,program).orElseThrow(ProgramActivities.Missing::new).requireEditable();
        authorize(subject,org,program,"UPLOAD_DISC_PDF",requestId);
        enrollments.lock(org,program,enrollment);
        if (eligibleEnrollments(org,program,true).stream().noneMatch(e -> e.id().equals(enrollment))) throw new EnrollmentNotFound();
        return files.uploadDisc(subject,org,program,enrollment,bytes,requestId);
    }

    private static Integer clean(Integer value, String field) {
        if (value == null || value < 0 || value > 100) throw new InvalidDiscProfile(field);
        return value;
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

    public record OwnResponse(Profile profile) {}
    public record Profile(UUID id, Integer dominant, Integer influential, Integer serene,
            Integer conscientious, Instant updatedAt, long version, boolean needsUpdate) {}
    public record Response(UUID enrollmentId, String enrollmentStatus, String email,
            String firstName, String lastName, Profile profile, boolean canEdit) {}
}
