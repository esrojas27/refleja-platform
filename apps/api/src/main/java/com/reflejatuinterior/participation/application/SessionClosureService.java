package com.reflejatuinterior.participation.application;

import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorAccess;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.program.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.slf4j.LoggerFactory;

@Service
@Transactional(readOnly=true)
public class SessionClosureService {
    private final OrganizationAccess access; private final CollaboratorAccess collaborators;
    private final OrganizationTenantContext tenant;private final ProgramDirectory programs;
    private final ProgramContent content;private final Enrollments enrollments;private final SessionSchedules schedules;
    private final ActivityEvaluations forms;private final ActivityEvaluationResponses responses;private final SessionForms closures;
    SessionClosureService(OrganizationAccess access,CollaboratorAccess collaborators,OrganizationTenantContext tenant,ProgramDirectory programs,
        ProgramContent content,Enrollments enrollments,SessionSchedules schedules,ActivityEvaluations forms,ActivityEvaluationResponses responses,SessionForms closures){
        this.access=access;this.collaborators=collaborators;this.tenant=tenant;this.programs=programs;this.content=content;this.enrollments=enrollments;
        this.schedules=schedules;this.forms=forms;this.responses=responses;this.closures=closures;
    }
    public record Closure(UUID sessionId,String sessionName,String dimensionName,String status,String closingComment,
        int activityCount,int submittedCount,double completionPercentage,ActivityEvaluations.Evaluation survey,List<ActivityEvaluationResponses.Answer> answers){}
    public record Configuration(List<ActivityEvaluations.Evaluation> items,List<UUID> closedSessionIds,List<UUID> startedSessionIds){}
    public Configuration definitions(String subject,UUID org,UUID program){
        consultant(subject,org,program,false);var items=forms.listForSessions(org,program);
        return new Configuration(items,items.stream().map(ActivityEvaluations.Evaluation::sessionId).filter(id->closures.hasClosed(org,program,id)).toList(),
            items.stream().map(ActivityEvaluations.Evaluation::sessionId).filter(id->closures.hasStarted(org,program,id)).toList());
    }
    @Transactional public ActivityEvaluations.Evaluation save(String subject,UUID org,UUID program,UUID session,Long version,String title,String instructions,List<ActivityEvaluations.QuestionInput> questions,String requestId){
        consultant(subject,org,program,true);content.describe(org,program,ProgramContent.Kind.SESSION,session).requireVisible();
        if(closures.hasStarted(org,program,session)) throw new ProgramContent.Conflict("SESSION_CLOSURE_STARTED");
        var saved=version==null?forms.createForSession(org,program,session,title,instructions,questions)
            :forms.replaceForSession(org,program,session,version,title,instructions,questions);
        audit("SESSION_CLOSING_SURVEY_SAVED",subject,org,session,requestId);
        return saved;
    }
    public List<Closure> owned(String subject,UUID program){
        var owner=owner(subject,program,false);
        if(!programs.find(owner.org(),program).orElseThrow(MyProgramNotFound::new).activated()) return List.of();
        return schedules.owned(owner.org(),program,owner.enrollment()).stream().map(s->view(owner,program,s)).toList();
    }
    @Transactional public Closure acknowledge(String subject,UUID program,UUID session,String requestId){
        var owner=owner(subject,program,true);var scheduled=scheduled(owner,program,session);
        requireAllSubmitted(owner,program,session);closures.acknowledge(owner.org(),program,session,owner.enrollment());
        audit("SESSION_CLOSING_COMMENT_ACKNOWLEDGED",subject,owner.org(),session,requestId);
        return view(owner,program,scheduled);
    }
    @Transactional public Closure submit(String subject,UUID program,UUID session,List<ActivityEvaluationResponses.AnswerInput> input,String requestId){
        var owner=owner(subject,program,true);var scheduled=scheduled(owner,program,session);requireAllSubmitted(owner,program,session);
        var state=closures.state(owner.org(),program,session,owner.enrollment());
        if(!state.acknowledged()||state.completed()) throw new ProgramContent.Conflict("SESSION_CLOSURE_NOT_AVAILABLE");
        var form=forms.findForSession(owner.org(),program,session).orElseThrow(ProgramActivities.Missing::new);
        var answers=ActivityEvaluationService.validate(form,input);
        responses.createForSession(owner.org(),program,session,form.id(),owner.enrollment(),answers);
        audit("SESSION_COMPLETED",subject,owner.org(),session,requestId);
        return view(owner,program,scheduled);
    }
    private Closure view(Owner owner,UUID program,SessionSchedules.OwnedSession scheduled){
        var s=scheduled.session();var state=closures.state(owner.org(),program,s.id(),owner.enrollment());
        String status=state.completed()?"COMPLETED":!state.readyToClose()?"LOCKED":state.acknowledged()?"PENDING":"COMMENT";
        var survey=state.readyToClose()&&state.acknowledged()?forms.findForSession(owner.org(),program,s.id()).orElse(null):null;
        var answer=responses.findForSession(owner.org(),program,s.id(),owner.enrollment());
        return new Closure(s.id(),s.name(),s.dimensionName(),status,state.readyToClose()?s.objective():null,state.activityCount(),state.submittedCount(),state.percentage(),survey,
            answer.map(ActivityEvaluationResponses.Response::answers).orElse(List.of()));
    }
    private void requireAllSubmitted(Owner owner,UUID program,UUID session){
        var missing=closures.missing(owner.org(),program,session);
        if(!missing.isEmpty()) throw new ProgramContent.Conflict(missing);
        if(!closures.state(owner.org(),program,session,owner.enrollment()).readyToClose()) throw new ProgramContent.Conflict("SESSION_ACTIVITIES_PENDING");
    }
    private SessionSchedules.OwnedSession scheduled(Owner owner,UUID program,UUID session){
        return schedules.owned(owner.org(),program,owner.enrollment()).stream().filter(s->s.session().id().equals(session)).findFirst().orElseThrow(ActivityAssignmentNotFound::new);
    }
    private void consultant(String subject,UUID org,UUID program,boolean write){
        OrganizationAccess.Context actor;
        try{actor=access.resolve(subject,org);}catch(OrganizationAccess.Unavailable e){throw new ProgramActivities.Missing();}
        if(!actor.roles().contains("CONSULTANT"))throw new OrganizationAccess.Denied();tenant.activate(org);
        var info=write?programs.lock(org,program):programs.find(org,program);var existing=info.orElseThrow(ProgramActivities.Missing::new);
        if(write)existing.requireEditable();
    }
    private Owner owner(String subject,UUID program,boolean write){
        var actor=collaborators.resolve(subject);
        for(var m:actor.memberships()){
            tenant.activate(m.organizationId());var e=enrollments.findOwned(m.organizationId(),m.id(),program);if(e.isEmpty())continue;
            var info=(write?programs.lock(m.organizationId(),program):programs.find(m.organizationId(),program)).orElseThrow(MyProgramNotFound::new);
            if(write){info.requireActive();var locked=enrollments.lock(m.organizationId(),program,e.get().id());
                if(!"ACTIVE".equals(locked.status()))throw new EnrollmentAdministrationConflict("PARTICIPATION_READ_ONLY");}
            return new Owner(m.organizationId(),e.get().id());
        }throw new MyProgramNotFound();
    }
    private static void audit(String action,String actor,UUID org,UUID session,String requestId){
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization(){
                @Override public void afterCommit(){LoggerFactory.getLogger(SessionClosureService.class).info(
                    "action={} actor={} organization={} resource=Session resourceId={} requestId={} timestamp={} result=SUCCESS",
                    action,actor,org,session,requestId,java.time.Instant.now());}
            });
    }
    private record Owner(UUID org,UUID enrollment){}
}
