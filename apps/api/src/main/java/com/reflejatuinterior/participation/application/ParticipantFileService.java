package com.reflejatuinterior.participation.application;

import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorAccess;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramDirectory;
import com.reflejatuinterior.program.ProgramParticipantVisibility;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ParticipantFileService {
    private final OrganizationAccess access;
    private final CollaboratorAccess collaborators;
    private final CollaboratorInvitations people;
    private final ProgramDirectory programs;
    private final ProgramParticipantVisibility visibility;
    private final Enrollments enrollments;
    private final ParticipantFiles files;
    private final OrganizationTenantContext tenant;
    ParticipantFileService(OrganizationAccess access, CollaboratorAccess collaborators, CollaboratorInvitations people,
            ProgramDirectory programs, ProgramParticipantVisibility visibility, Enrollments enrollments,
            ParticipantFiles files, OrganizationTenantContext tenant) {
        this.access=access;this.collaborators=collaborators;this.people=people;this.programs=programs;
        this.visibility=visibility;this.enrollments=enrollments;this.files=files;this.tenant=tenant;
    }
    @Transactional(readOnly=true)
    public Participants participants(String subject, UUID org, UUID program, int page, int size) {
        var actor = authorize(subject,org,program,false);
        if (page<0 || size<1 || size>100 || (long)page*size>Integer.MAX_VALUE) throw new ParticipantFileFormat.Invalid("page");
        var result=enrollments.list(org,program,page,size);
        var items=result.items().stream().map(e -> {
            var p=people.participant(org,e.membershipId());
            return new Person(e.id(),p.email(),p.firstName(),p.lastName(),e.status());
        }).toList();
        return new Participants(items,page,size,result.totalElements(),result.totalPages(),canManage(actor,org,program));
    }
    @Transactional(readOnly=true)
    public FileList list(String subject,UUID org,UUID program,UUID enrollment) {
        var actor=authorize(subject,org,program,false);
        enrollments.find(org,program,enrollment).orElseThrow(EnrollmentNotFound::new);
        return new FileList(files.list(org,program,enrollment),canManage(actor,org,program),ParticipantFileFormat.MAX_BYTES,10);
    }
    @Transactional
    public ParticipantFiles.Data upload(String subject,UUID org,UUID program,UUID enrollment,String title,byte[] bytes,String requestId) {
        var actor=authorize(subject,org,program,true);
        programs.lock(org,program).orElseThrow(ProgramActivities.Missing::new).requireEditable();
        actor=authorize(subject,org,program,true);
        enrollments.lock(org,program,enrollment);
        var saved=files.create(org,program,enrollment,actor.userId(),ParticipantFileFormat.title(title),ParticipantFileFormat.type(bytes),bytes);
        audit("PARTICIPANT_FILE_UPLOADED",actor.userId(),org,program,enrollment,saved.id(),requestId);
        return saved;
    }
    @Transactional
    public ParticipantFiles.Data uploadDisc(String subject,UUID org,UUID program,UUID enrollment,byte[] bytes,String requestId) {
        var actor=authorize(subject,org,program,true);
        programs.lock(org,program).orElseThrow(ProgramActivities.Missing::new).requireEditable();
        actor=authorize(subject,org,program,true);
        enrollments.lock(org,program,enrollment);
        if (!ParticipantFileFormat.type(bytes).equals("application/pdf")) throw new ParticipantFileFormat.Invalid("file");
        var saved=files.createDisc(org,program,enrollment,actor.userId(),bytes);
        audit("DISC_PDF_UPLOADED",actor.userId(),org,program,enrollment,saved.id(),requestId);
        return saved;
    }
    @Transactional
    public void delete(String subject,UUID org,UUID program,UUID enrollment,UUID file,String requestId) {
        var actor=authorize(subject,org,program,true);
        programs.lock(org,program).orElseThrow(ProgramActivities.Missing::new).requireEditable();
        actor=authorize(subject,org,program,true);
        enrollments.lock(org,program,enrollment);
        if (!files.delete(org,program,enrollment,file)) throw new Missing();
        audit("PARTICIPANT_FILE_DELETED",actor.userId(),org,program,enrollment,file,requestId);
    }
    @Transactional(readOnly=true)
    public ParticipantFiles.Content content(String subject,UUID org,UUID program,UUID enrollment,UUID file) {
        authorize(subject,org,program,false);
        enrollments.find(org,program,enrollment).orElseThrow(EnrollmentNotFound::new);
        return files.content(org,program,enrollment,file).orElseThrow(Missing::new);
    }
    @Transactional(readOnly=true)
    public FileList ownList(String subject,UUID program) {
        var owner=owner(subject,program);
        if (!programs.find(owner.organizationId(),program).orElseThrow(MyProgramNotFound::new).activated())
            return new FileList(List.of(),false,ParticipantFileFormat.MAX_BYTES,10);
        return new FileList(files.list(owner.organizationId(),program,owner.id()),false,ParticipantFileFormat.MAX_BYTES,10);
    }
    @Transactional(readOnly=true)
    public ParticipantFiles.Content ownContent(String subject,UUID program,UUID file) {
        var owner=owner(subject,program);
        if (!programs.find(owner.organizationId(),program).orElseThrow(MyProgramNotFound::new).activated()) throw new Missing();
        return files.content(owner.organizationId(),program,owner.id(),file).orElseThrow(Missing::new);
    }
    private Enrollments.Data owner(String subject,UUID program) {
        for (var m:collaborators.resolve(subject).memberships()) {
            tenant.activate(m.organizationId());
            var found=enrollments.findOwned(m.organizationId(),m.id(),program);
            if(found.isPresent()) return found.get();
        }
        throw new MyProgramNotFound();
    }
    private OrganizationAccess.Context authorize(String subject,UUID org,UUID program,boolean write) {
        OrganizationAccess.Context actor;
        try { actor=access.resolve(subject,org); } catch(OrganizationAccess.Unavailable unavailable) { throw new ProgramActivities.Missing(); }
        boolean consultant=actor.roles().contains("CONSULTANT");
        if(!consultant && (write || actor.roles().stream().noneMatch(r -> r.equals("LEADER") || r.equals("COMPANY_ADMIN")))) throw new OrganizationAccess.Denied();
        tenant.activate(org);
        if(programs.find(org,program).isEmpty() || !consultant && visibility.blockedPrograms(org,actor.membershipId()).contains(program)) throw new ProgramActivities.Missing();
        return actor;
    }
    private boolean canManage(OrganizationAccess.Context actor,UUID org,UUID program) {
        var status=programs.find(org,program).orElseThrow(ProgramActivities.Missing::new).status();
        return actor.roles().contains("CONSULTANT") && !status.equals("COMPLETED") && !status.equals("CANCELLED");
    }
    private static void audit(String action,UUID actor,UUID org,UUID program,UUID enrollment,UUID file,String request) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { LoggerFactory.getLogger(ParticipantFileService.class).info(
                "action={} actor={} organization={} program={} enrollment={} file={} requestId={} result=SUCCESS",action,actor,org,program,enrollment,file,request); }
        });
    }
    public record Person(UUID enrollmentId,String email,String firstName,String lastName,String enrollmentStatus) {}
    public record Participants(List<Person> items,int page,int size,long totalElements,int totalPages,boolean canManage) {}
    public record FileList(List<ParticipantFiles.Data> items,boolean canManage,int maxFileBytes,int maxFiles) {}
    public static class Missing extends RuntimeException {}
    public static class LimitReached extends RuntimeException {}
}
