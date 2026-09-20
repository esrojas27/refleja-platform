package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.CollaboratorAccess;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationDirectory;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.domain.InvalidEnrollmentInput;
import com.reflejatuinterior.participation.domain.NewCollaborator;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class EnrollmentService {
    private final OrganizationAccess access;
    private final OrganizationDirectory organizations;
    private final ProgramDirectory programs;
    private final CollaboratorInvitations invitations;
    private final CollaboratorAccess collaboratorAccess;
    private final Enrollments enrollments;
    private final OrganizationTenantContext tenantContext;
    private final TransactionTemplate transactions;

    EnrollmentService(OrganizationAccess access, OrganizationDirectory organizations, ProgramDirectory programs,
                      CollaboratorInvitations invitations, CollaboratorAccess collaboratorAccess,
                      Enrollments enrollments, OrganizationTenantContext tenantContext,
                      PlatformTransactionManager transactionManager) {
        this.access = access; this.organizations = organizations; this.programs = programs;
        this.invitations = invitations; this.collaboratorAccess = collaboratorAccess; this.enrollments = enrollments;
        this.tenantContext = tenantContext;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public EnrollmentResponse create(String subject, UUID organizationId, UUID programId,
                                     String email, String firstName, String lastName,
                                     CollaboratorInvitations.InvitedRole role, String requestId) {
        // No external side effect before authorization, resource scoping and validation.
        transactions.execute(status -> authorize(subject, organizationId, programId, requestId));
        var input = new NewCollaborator(email, firstName, lastName);
        var person = new CollaboratorInvitations.Person(input.email(), input.firstName(), input.lastName());
        var invitedRole = role == null ? CollaboratorInvitations.InvitedRole.COLLABORATOR : role;
        var account = invitations.provision(person);
        var created = transactions.execute(status -> {
            // The external round trip must not preserve a stale authorization decision.
            var context = authorize(subject, organizationId, programId, requestId);
            var invitation = invitations.create(organizationId, context.userId(), account, person, invitedRole);
            var enrollment = enrollments.create(organizationId, programId, invitation.membershipId(), invitation.id());
            auditAfterCommit("PROGRAM_PARTICIPANT_INVITED", context.userId(), organizationId, enrollment.id(), requestId);
            return response(enrollment);
        });
        return deliver(created, requestId);
    }

    @Transactional(readOnly = true)
    public EnrollmentPage list(String subject, UUID organizationId, UUID programId, int page, int size, String requestId) {
        authorize(subject, organizationId, programId, requestId);
        validatePage(page, size);
        var result = enrollments.list(organizationId, programId, page, size);
        return new EnrollmentPage(result.items().stream().map(this::response).toList(), page, size,
                result.totalElements(), result.totalPages());
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public EnrollmentResponse retryDelivery(String subject, UUID organizationId, UUID programId,
                                            UUID enrollmentId, String requestId) {
        var existing = transactions.execute(status -> {
            authorize(subject, organizationId, programId, requestId);
            var enrollment = enrollments.find(organizationId, programId, enrollmentId).orElseThrow(EnrollmentNotFound::new);
            if (enrollment.invitationId() == null || !"INVITED".equals(enrollment.status())) throw new EnrollmentConflict();
            return response(enrollment);
        });
        return deliver(existing, requestId);
    }

    @Transactional(readOnly = true)
    public InvitationPage invitations(String subject, int page, int size) {
        validatePage(page, size);
        var result = invitations.listOwned(subject, page, size);
        var items = result.items().stream().map(invitation -> {
            tenantContext.activate(invitation.organizationId());
            var enrollment = enrollments.findByInvitation(invitation.organizationId(), invitation.id()).orElseThrow(EnrollmentNotFound::new);
            var organization = organizations.findSummaries(Set.of(invitation.organizationId())).stream()
                    .findFirst().orElseThrow(EnrollmentNotFound::new);
            var program = programs.find(invitation.organizationId(), enrollment.programId()).orElseThrow(EnrollmentNotFound::new);
            return new InvitationResponse(invitation.id(), organization.id(), organization.name(), program.id(), program.name(),
                    invitation.role().name(), invitation.status(), invitation.expiresAt());
        }).toList();
        return new InvitationPage(items, page, size, result.totalElements(), result.totalPages());
    }

    @Transactional
    public AcceptanceResponse accept(String subject, UUID invitationId, String requestId) {
        // This endpoint intentionally permits INVITED users, but only for their own invitation.
        var owned = invitations.findOwned(subject, invitationId);
        tenantContext.activate(owned.organizationId());
        var enrollment = enrollments.findByInvitation(owned.organizationId(), invitationId).orElseThrow(EnrollmentNotFound::new);
        var organization = organizations.findSummaries(Set.of(owned.organizationId())).stream()
                .filter(o -> "ACTIVE".equals(o.status())).findFirst().orElseThrow(CollaboratorInvitations.Denied::new);
        programs.find(organization.id(), enrollment.programId()).orElseThrow(EnrollmentNotFound::new);
        if (!Set.of("INVITED", "ACTIVE").contains(enrollment.status())) throw new EnrollmentConflict();
        var accepted = invitations.accept(subject, invitationId);
        var activated = enrollments.activate(accepted.organizationId(), invitationId);
        if (!"ACCEPTED".equals(owned.status())) {
            auditAfterCommit("INVITATION_ACCEPTED", accepted.userId(), accepted.organizationId(), activated.id(), requestId);
        }
        return new AcceptanceResponse(accepted.id(), accepted.role().name(), accepted.status(), activated.id(), activated.status());
    }

    @Transactional(readOnly = true)
    public MyProgramPage myPrograms(String subject, int page, int size, String requestId) {
        validatePage(page, size);
        var context = collaboratorContext(subject, requestId, null);
        var memberships = orderedMemberships(context);
        var items = new ArrayList<MyProgramResponse>(size);
        long skipped = (long) page * size;
        long total = 0;

        for (var membership : memberships) {
            long tenantOffset = skipped;
            int remaining = size - items.size();
            tenantContext.activate(membership.organizationId());
            long count = enrollments.countOwned(membership.organizationId(), membership.id());
            TenantPrograms tenantPrograms;
            if (remaining == 0 || tenantOffset >= count) {
                tenantPrograms = new TenantPrograms(count, List.of());
            } else {
                var rows = enrollments.listOwned(
                        membership.organizationId(), membership.id(), (int) tenantOffset, remaining);
                tenantPrograms = new TenantPrograms(count, rows.stream()
                        .map(row -> myProgram(row, membership)).toList());
            }
            total += tenantPrograms.total();
            if (skipped >= tenantPrograms.total()) {
                skipped -= tenantPrograms.total();
            } else {
                skipped = 0;
                items.addAll(tenantPrograms.items());
            }
        }
        long pages = total / size + (total % size == 0 ? 0 : 1);
        return new MyProgramPage(items, page, size, total, (int) Math.min(Integer.MAX_VALUE, pages));
    }

    @Transactional(readOnly = true)
    public MyProgramResponse myProgram(String subject, UUID programId, String requestId) {
        var context = collaboratorContext(subject, requestId, programId);
        for (var membership : orderedMemberships(context)) {
            tenantContext.activate(membership.organizationId());
            Optional<MyProgramResponse> found = enrollments.findOwned(
                            membership.organizationId(), membership.id(), programId)
                    .map(enrollment -> myProgram(enrollment, membership));
            if (found.isPresent()) {
                return found.get();
            }
        }
        deniedProgram(context.userId(), programId, requestId);
        throw new MyProgramNotFound();
    }

    private CollaboratorAccess.Context collaboratorContext(String subject, String requestId, UUID programId) {
        try {
            return collaboratorAccess.resolve(subject);
        } catch (CollaboratorAccess.Denied exception) {
            deniedProgram(null, programId, requestId);
            throw exception;
        }
    }

    private MyProgramResponse myProgram(Enrollments.Data enrollment, CollaboratorAccess.Membership membership) {
        if (!membership.id().equals(enrollment.membershipId())
                || !membership.organizationId().equals(enrollment.organizationId())) {
            throw new MyProgramNotFound();
        }
        var program = programs.find(enrollment.organizationId(), enrollment.programId())
                .orElseThrow(MyProgramNotFound::new);
        return new MyProgramResponse(program.id(), program.organizationId(), membership.organizationName(), program.name(),
                program.description(), program.status(), program.startDate(), program.endDate(), program.version());
    }

    private static List<CollaboratorAccess.Membership> orderedMemberships(CollaboratorAccess.Context context) {
        return context.memberships().stream()
                .sorted(Comparator.comparing(CollaboratorAccess.Membership::organizationId))
                .toList();
    }

    private static void deniedProgram(UUID actor, UUID programId, String requestId) {
        LoggerFactory.getLogger(EnrollmentService.class).info(
                "action=PROGRAM_ACCESS_DENIED actor={} resource=Program resourceId={} requestId={} timestamp={} result=DENIED",
                actor, programId, requestId, Instant.now());
    }

    private OrganizationAccess.Context authorize(String subject, UUID organizationId, UUID programId, String requestId) {
        OrganizationAccess.Context context;
        try { context = access.resolve(subject, organizationId); }
        catch (OrganizationAccess.Unavailable exception) {
            deniedAudit(null, organizationId, programId, requestId);
            throw new EnrollmentNotFound();
        } catch (OrganizationAccess.Denied exception) {
            deniedAudit(null, organizationId, programId, requestId);
            throw exception;
        }
        if (!context.roles().contains("CONSULTANT")) {
            deniedAudit(context.userId(), organizationId, programId, requestId);
            throw new OrganizationAccess.Denied();
        }
        tenantContext.activate(context.organizationId());
        if (programs.find(context.organizationId(), programId).isEmpty()) {
            deniedAudit(context.userId(), organizationId, programId, requestId);
            throw new EnrollmentNotFound();
        }
        return context;
    }

    private EnrollmentResponse response(Enrollments.Data enrollment) {
        var participant = invitations.participant(enrollment.organizationId(), enrollment.membershipId());
        var invitation = enrollment.invitationId() == null ? null
                : invitationInfo(invitations.findInOrganization(enrollment.organizationId(), enrollment.invitationId()));
        return new EnrollmentResponse(enrollment.id(), enrollment.organizationId(), enrollment.programId(), enrollment.status(),
                participant, invitation);
    }

    private EnrollmentResponse deliver(EnrollmentResponse enrollment, String requestId) {
        try {
            var delivered = invitations.dispatch(enrollment.organizationId(), enrollment.invitation().id());
            return new EnrollmentResponse(enrollment.id(), enrollment.organizationId(), enrollment.programId(), enrollment.status(),
                    enrollment.participant(), invitationInfo(delivered));
        } catch (CollaboratorInvitations.DeliveryUnavailable exception) {
            // A completed enrollment must remain discoverable even when AWS or delivery bookkeeping fails.
            LoggerFactory.getLogger(EnrollmentService.class).warn(
                    "action=INVITATION_DELIVERY organization={} resource=Enrollment resourceId={} requestId={} timestamp={} result=NOT_CONFIRMED",
                    enrollment.organizationId(), enrollment.id(), requestId, Instant.now());
            return enrollment;
        }
    }

    private static InvitationInfo invitationInfo(CollaboratorInvitations.Invitation i) {
        return new InvitationInfo(i.id(), i.role().name(), i.status(), i.expiresAt(), i.deliveryStatus());
    }

    private static void validatePage(int page, int size) {
        if (page < 0 || (long) page * size > Integer.MAX_VALUE) throw new InvalidEnrollmentInput("page");
        if (size < 1 || size > 100) throw new InvalidEnrollmentInput("size");
    }

    private static void auditAfterCommit(String action, UUID actor, UUID organizationId, UUID enrollmentId, String requestId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(EnrollmentService.class).info(
                        "action={} actor={} organization={} resource=Enrollment resourceId={} requestId={} timestamp={} result=SUCCESS",
                        action, actor, organizationId, enrollmentId, requestId, Instant.now());
            }
        });
    }

    private static void deniedAudit(UUID actor, UUID organizationId, UUID programId, String requestId) {
        LoggerFactory.getLogger(EnrollmentService.class).info(
                "action=ENROLLMENT_ACCESS_DENIED actor={} organization={} resource=Program resourceId={} requestId={} timestamp={} result=DENIED",
                actor, organizationId, programId, requestId, Instant.now());
    }

    public record InvitationInfo(UUID id, String role, String status, Instant expiresAt, String deliveryStatus) {}
    public record EnrollmentResponse(UUID id, UUID organizationId, UUID programId, String status,
                                     CollaboratorInvitations.Participant participant, InvitationInfo invitation) {}
    public record EnrollmentPage(List<EnrollmentResponse> items, int page, int size, long totalElements, int totalPages) {
        public EnrollmentPage { items = List.copyOf(items); }
    }
    public record InvitationResponse(UUID id, UUID organizationId, String organizationName, UUID programId,
                                     String programName, String role, String status, Instant expiresAt) {}
    public record InvitationPage(List<InvitationResponse> items, int page, int size, long totalElements, int totalPages) {
        public InvitationPage { items = List.copyOf(items); }
    }
    public record AcceptanceResponse(UUID invitationId, String role, String status, UUID enrollmentId, String enrollmentStatus) {}
    public record MyProgramResponse(UUID id, UUID organizationId, String organizationName, String name,
                                    String description, String status, java.time.LocalDate startDate,
                                    java.time.LocalDate endDate, long version) {}
    public record MyProgramPage(List<MyProgramResponse> items, int page, int size, long totalElements, int totalPages) {
        public MyProgramPage { items = List.copyOf(items); }
    }
    private record TenantPrograms(long total, List<MyProgramResponse> items) {}
}
