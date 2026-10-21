package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.identity.ParticipantIdentityAdministration;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.domain.InvalidEnrollmentInput;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class EnrollmentAdministrationService {
    private final OrganizationAccess access;
    private final OrganizationTenantContext tenant;
    private final ProgramDirectory programs;
    private final Enrollments enrollments;
    private final CollaboratorInvitations invitations;
    private final ParticipantIdentityAdministration identities;
    private final EnrollmentChanges changes;
    private final EnrollmentService enrollmentService;
    EnrollmentAdministrationService(OrganizationAccess access,OrganizationTenantContext tenant,ProgramDirectory programs,
            Enrollments enrollments,CollaboratorInvitations invitations,ParticipantIdentityAdministration identities,
            EnrollmentChanges changes,EnrollmentService enrollmentService) {
        this.access=access; this.tenant=tenant; this.programs=programs; this.enrollments=enrollments;
        this.invitations=invitations; this.identities=identities; this.changes=changes; this.enrollmentService=enrollmentService;
    }
    public record Changed(EnrollmentService.EnrollmentResponse enrollment,boolean needsDelivery) {}

    @Transactional
    public Changed change(String subject,UUID org,UUID program,UUID enrollmentId,long expectedVersion,
            String action,String reason,boolean confirmed,CollaboratorInvitations.InvitedRole role,Long roleVersion,String requestId) {
        var actor=authorize(subject,org,program,requestId);
        var state=programs.lock(org,program).orElseThrow(EnrollmentNotFound::new);
        var before=enrollments.lock(org,program,enrollmentId);
        if(before.version()!=expectedVersion) throw conflict("ENROLLMENT_VERSION_CONFLICT");
        if(!confirmed) throw conflict("ENROLLMENT_CONFIRMATION_REQUIRED");
        String clean=reason==null?"":reason.strip();
        if(clean.isEmpty()||clean.length()>1000||clean.codePoints().anyMatch(c->Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t')) throw new InvalidEnrollmentInput("reason");
        if(!Set.of("REVOKE","WITHDRAW","SUSPEND","COMPLETE","REINSTATE","CHANGE_ROLE").contains(action)) throw new InvalidEnrollmentInput("action");
        var identity=identities.inspect(org,before.membershipId());
        if(identity.roles().contains("CONSULTANT")||identity.roles().contains("SUPER_ADMIN")) throw conflict("PARTICIPANT_ADMINISTRATIVE_ACCESS");
        if(role!=null&&!"CHANGE_ROLE".equals(action)) throw new InvalidEnrollmentInput("role");
        UUID newInvitation=null;
        var invitation=before.invitationId()==null?null:invitations.findInOrganization(org,before.invitationId());
        switch(action) {
            case "REVOKE" -> {
                if(!"INVITED".equals(before.status())||invitation==null) throw conflict("ENROLLMENT_TRANSITION_NOT_ALLOWED");
                identities.revoke(org,invitation.id());
            }
            case "REINSTATE" -> {
                state.requireEditable(); requireEnabled(identity);
                if(!Set.of("WITHDRAWN","SUSPENDED","COMPLETED","INVITED").contains(before.status())) throw conflict("ENROLLMENT_TRANSITION_NOT_ALLOWED");
                if(invitation!=null&&!"ACCEPTED".equals(invitation.status())) newInvitation=identities.renew(org,actor.userId(),invitation.id()).id();
                else if("INVITED".equals(before.status())) throw conflict("ENROLLMENT_TRANSITION_NOT_ALLOWED");
            }
            case "COMPLETE" -> {
                if(!Set.of("ACTIVE","COMPLETED").contains(state.status())||!state.activated()) throw conflict("PARTICIPATION_COMPLETION_NOT_AVAILABLE");
            }
            case "CHANGE_ROLE" -> {
                state.requireEditable();
                if(role==null||roleVersion==null||roleVersion<0) throw new InvalidEnrollmentInput("role");
                identities.changeRole(org,before.membershipId(),roleVersion,role);
            }
            default -> { /* Withdrawal and suspension must remain possible after program closure. */ }
        }
        var current=enrollments.change(org,program,enrollmentId,expectedVersion,action,newInvitation);
        var updatedIdentity=identities.inspect(org,before.membershipId());
        changes.record(before,current,action,identity.roles(),updatedIdentity.roles(),actor.userId(),enrollmentService.actorLabel(actor),clean,requestId);
        audit(actor,program,enrollmentId,action,requestId);
        return new Changed(enrollmentService.response(current),newInvitation!=null);
    }
    @Transactional(readOnly=true)
    public EnrollmentChanges.Page history(String subject,UUID org,UUID program,UUID enrollment,int page,int size,String requestId) {
        authorize(subject,org,program,requestId);
        enrollments.find(org,program,enrollment).orElseThrow(EnrollmentNotFound::new);
        if(page<0||size<1||size>100||(long)page*size>Integer.MAX_VALUE) throw new InvalidEnrollmentInput("page");
        return changes.list(org,program,enrollment,page,size);
    }
    private OrganizationAccess.Context authorize(String subject,UUID org,UUID program,String request) {
        OrganizationAccess.Context actor;
        try { actor=access.resolve(subject,org); }
        catch(OrganizationAccess.Unavailable e) { throw new EnrollmentNotFound(); }
        if(!actor.roles().contains("CONSULTANT")) {
            LoggerFactory.getLogger(EnrollmentAdministrationService.class).info("action=AUTHORIZATION_DENIED operation=MANAGE_PARTICIPANT organization={} program={} requestId={}",org,program,request);
            throw new OrganizationAccess.Denied();
        }
        tenant.activate(org);
        if(programs.find(org,program).isEmpty()) throw new EnrollmentNotFound();
        return actor;
    }
    private static EnrollmentAdministrationConflict conflict(String code) { return new EnrollmentAdministrationConflict(code); }
    private static void requireEnabled(ParticipantIdentityAdministration.State state) {
        if(!Set.of("ACTIVE","PENDING").contains(state.membershipStatus())||!Set.of("ACTIVE","INVITED").contains(state.userStatus()))
            throw conflict("PARTICIPANT_IDENTITY_DISABLED");
    }
    private static void audit(OrganizationAccess.Context actor,UUID program,UUID enrollment,String action,String request) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(EnrollmentAdministrationService.class).info(
                        "action=PARTICIPANT_{} actor={} organization={} program={} enrollment={} requestId={} timestamp={} result=SUCCESS",
                        action,actor.userId(),actor.organizationId(),program,enrollment,request,Instant.now());
            }
        });
    }
}
