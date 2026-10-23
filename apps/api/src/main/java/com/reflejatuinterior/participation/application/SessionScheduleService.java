package com.reflejatuinterior.participation.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import com.reflejatuinterior.identity.*;
import com.reflejatuinterior.organization.OrganizationDirectory;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.program.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly=true)
public class SessionScheduleService {
    private final OrganizationAccess access;
    private final OrganizationTenantContext tenant;
    private final OrganizationDirectory organizations;
    private final ProgramDirectory programs;
    private final ProgramContent content;
    private final ProgramParticipantVisibility visibility;
    private final CollaboratorAccess collaborators;
    private final CollaboratorInvitations people;
    private final Enrollments enrollments;
    private final SessionSchedules schedules;
    private final ActivityAssignments assignments;
    private final Clock clock;
    SessionScheduleService(OrganizationAccess access,OrganizationTenantContext tenant,OrganizationDirectory organizations,
            ProgramDirectory programs,ProgramContent content,ProgramParticipantVisibility visibility,CollaboratorAccess collaborators,
            CollaboratorInvitations people,Enrollments enrollments,SessionSchedules schedules,ActivityAssignments assignments,Clock clock) {
        this.access=access;this.tenant=tenant;this.organizations=organizations;this.programs=programs;this.content=content;
        this.visibility=visibility;this.collaborators=collaborators;this.people=people;this.enrollments=enrollments;this.schedules=schedules;this.assignments=assignments;this.clock=clock;
    }
    public record Target(UUID enrollmentId,Long version) {}
    public record SessionView(SessionSchedules.Session session,List<SessionSchedules.Person> participants) {}
    public record Agenda(boolean canEdit,LocalDate today,LocalDate startDate,LocalDate endDate,List<SessionView> items) {}
    public record History(List<SessionSchedules.Revision> items,int page,int size,long totalElements,int totalPages) {}

    public Agenda list(String subject,UUID org,UUID program) {
        var actor=authorize(subject,org,program,false);
        var info=programs.find(org,program).orElseThrow(ProgramActivities.Missing::new);
        return new Agenda(actor.roles().contains("CONSULTANT")&&!Set.of("COMPLETED","CANCELLED").contains(info.status()),today(org),info.startDate(),info.endDate(),
                schedules.sessions(org,program).stream().map(s->new SessionView(s,schedules.participants(org,program,s.id()))).toList());
    }
    @Transactional
    public Agenda schedule(String subject,UUID org,UUID program,UUID session,LocalDate date,List<Target> selected,String reason,String request) {
        var actor=authorize(subject,org,program,true);
        var info=programs.lock(org,program).orElseThrow(ProgramActivities.Missing::new);info.requireEditable();
        content.describe(org,program,ProgramContent.Kind.SESSION,session).requireVisible();
        if(date==null||date.isBefore(today(org))||info.startDate()==null||date.isBefore(info.startDate())||date.isAfter(LocalDate.of(9999,12,28)))
            throw new ProgramActivities.InvalidInput("scheduledDate");
        if(selected==null||selected.isEmpty()||selected.size()>500||selected.stream().anyMatch(t->t==null||t.enrollmentId()==null)
                ||selected.stream().map(Target::enrollmentId).distinct().count()!=selected.size()) throw new ProgramActivities.InvalidInput("enrollmentIds");
        String clean=reason==null?"":reason.strip();
        if(clean.length()>1000||clean.codePoints().anyMatch(c->Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t')) throw new ProgramActivities.InvalidInput("reason");
        var participants=schedules.participants(org,program,session);
        var targets=selected.stream().map(t->{
            var person=participants.stream().filter(p->p.enrollmentId().equals(t.enrollmentId())).findFirst().orElseThrow(EnrollmentNotFound::new);
            if(!person.enabled()||!Set.of("INVITED","ACTIVE").contains(person.status())) throw new ProgramContent.Conflict("SESSION_PARTICIPANT_READ_ONLY");
            if(!java.util.Objects.equals(person.version(),t.version())) throw new ProgramContent.Conflict("SESSION_SCHEDULE_VERSION_CONFLICT");
            if(person.scheduledDate()!=null&&!date.equals(person.scheduledDate())&&clean.isEmpty()) throw new ProgramActivities.InvalidInput("reason");
            return person;
        }).toList();
        var person=people.participant(org,actor.membershipId());
        var label=java.util.stream.Stream.of(person.firstName(),person.lastName()).filter(s->s!=null&&!s.isBlank()).collect(java.util.stream.Collectors.joining(" "));
        for(var target:targets) if(!date.equals(target.scheduledDate())) schedules.save(org,program,session,target,date,actor.userId(),label.isBlank()?person.email():label,
                target.scheduledDate()==null?"Fecha asignada por el consultor.":clean,request);
        assignments.assignScheduledSession(org,program,session,targets.stream().map(SessionSchedules.Person::enrollmentId).toList());
        return list(subject,org,program);
    }
    public History history(String subject,UUID org,UUID program,UUID session,UUID enrollment,int page,int size) {
        authorize(subject,org,program,false);
        content.describe(org,program,ProgramContent.Kind.SESSION,session);
        enrollments.find(org,program,enrollment).orElseThrow(EnrollmentNotFound::new);
        if(page<0||size<1||size>100||(long)page*size>Integer.MAX_VALUE) throw new ProgramActivities.InvalidInput("page");
        long total=schedules.countHistory(org,program,session,enrollment);
        return new History(schedules.history(org,program,session,enrollment,page*size,size),page,size,total,(int)Math.min(Integer.MAX_VALUE,(total+size-1)/size));
    }
    public List<SessionSchedules.OwnedSession> owned(String subject,UUID program) {
        var context=collaborators.resolve(subject);
        for(var membership:context.memberships()) {
            tenant.activate(membership.organizationId());
            var enrollment=enrollments.findOwned(membership.organizationId(),membership.id(),program);
            if(enrollment.isEmpty()) continue;
            var info=programs.find(membership.organizationId(),program).orElseThrow(MyProgramNotFound::new);
            return info.activated()?schedules.owned(membership.organizationId(),program,enrollment.get().id()):List.of();
        }
        throw new MyProgramNotFound();
    }
    private LocalDate today(UUID org) { return LocalDate.now(clock.withZone(ZoneId.of(organizations.reportInfo(org).orElseThrow(ProgramActivities.Missing::new).timeZone()))); }
    private OrganizationAccess.Context authorize(String subject,UUID org,UUID program,boolean write) {
        OrganizationAccess.Context actor;
        try { actor=access.resolve(subject,org); } catch(OrganizationAccess.Unavailable e) { throw new ProgramActivities.Missing(); }
        if(!actor.roles().contains("CONSULTANT")&&(write||actor.roles().stream().noneMatch(r->r.equals("LEADER")||r.equals("COMPANY_ADMIN")))) throw new OrganizationAccess.Denied();
        tenant.activate(org);
        if(programs.find(org,program).isEmpty()||!actor.roles().contains("CONSULTANT")&&visibility.blockedPrograms(org,actor.membershipId()).contains(program)) throw new ProgramActivities.Missing();
        return actor;
    }
}
