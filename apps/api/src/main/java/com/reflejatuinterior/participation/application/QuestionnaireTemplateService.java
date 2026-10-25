package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.Comparator;
import java.util.UUID;
import java.util.stream.Stream;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.participation.domain.InvalidActivityEvaluation;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramDirectory;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Transactional(readOnly = true)
public class QuestionnaireTemplateService {
    private final OrganizationAccess access;
    private final OrganizationTenantContext tenant;
    private final ProgramDirectory programs;
    private final ActivityEvaluations evaluations;
    private final QuestionnaireTemplates templates;

    QuestionnaireTemplateService(OrganizationAccess access,OrganizationTenantContext tenant,ProgramDirectory programs,
        ActivityEvaluations evaluations,QuestionnaireTemplates templates) {
        this.access=access;this.tenant=tenant;this.programs=programs;this.evaluations=evaluations;this.templates=templates;
    }
    public QuestionnaireTemplates.Page list(String subject, UUID org, int page, int size) {
        authorize(subject,org);
        if(page<0||size<1||size>100)throw new InvalidActivityEvaluation("page");
        return templates.list(page,size);
    }
    public QuestionnaireTemplates.Stored find(String subject,UUID org,UUID id) {
        authorize(subject,org);return templates.find(id).orElseThrow(ProgramActivities.Missing::new);
    }
    @Transactional
    public QuestionnaireTemplates.Stored create(String subject,UUID org,UUID program,UUID evaluationId,String name,String description,String requestId) {
        var actor=authorize(subject,org);
        programs.lock(org,program).orElseThrow(ProgramActivities.Missing::new);
        var cleanName=text(name,255,"name",true);
        var cleanDescription=text(description,2000,"description",false);
        var source=Stream.concat(evaluations.list(org,program).stream(),evaluations.listForSessions(org,program).stream())
            .filter(e->e.id().equals(evaluationId)).findFirst().orElseThrow(ProgramActivities.Missing::new);
        var snapshot=new QuestionnaireTemplates.Snapshot(source.title(),source.instructions(),source.questions().stream()
            .sorted(Comparator.comparingInt(ActivityEvaluations.Question::position))
            .map(q->new QuestionnaireTemplates.Question(q.prompt(),q.type(),q.position(),q.options())).toList());
        var saved=templates.create(org,program,evaluationId,actor.userId(),cleanName,cleanDescription,snapshot);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
            @Override public void afterCommit(){LoggerFactory.getLogger(QuestionnaireTemplateService.class).info(
                "action=QUESTIONNAIRE_TEMPLATE_CREATED actor={} organization={} resourceId={} requestId={} timestamp={} result=SUCCESS",
                actor.userId(),org,saved.summary().id(),requestId,Instant.now());}
        });
        return saved;
    }
    private OrganizationAccess.Context authorize(String subject,UUID org) {
        OrganizationAccess.Context actor;
        try{actor=access.resolve(subject,org);}catch(OrganizationAccess.Unavailable e){throw new ProgramActivities.Missing();}
        if(!actor.roles().contains("CONSULTANT"))throw new OrganizationAccess.Denied();
        tenant.activate(org);return actor;
    }
    private static String text(String value,int limit,String field,boolean required) {
        var clean=value==null?"":value.strip();
        if(clean.length()>limit||clean.codePoints().anyMatch(c->Character.isISOControl(c)&&(required||c!='\n'&&c!='\r'&&c!='\t'))||required&&clean.isEmpty())throw new InvalidActivityEvaluation(field);
        return clean.isEmpty()?null:clean;
    }
}
