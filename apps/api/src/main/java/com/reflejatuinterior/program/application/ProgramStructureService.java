package com.reflejatuinterior.program.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import com.reflejatuinterior.program.domain.NewProgramModule;
import com.reflejatuinterior.program.domain.NewProgramSession;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ProgramStructureService {
    private final ProgramAccessPolicy policy;
    private final Programs programs;
    private final ProgramStructure structure;
    private final OrganizationTenantContext tenantContext;

    ProgramStructureService(ProgramAccessPolicy policy, Programs programs, ProgramStructure structure,
            OrganizationTenantContext tenantContext) {
        this.policy = policy;
        this.programs = programs;
        this.structure = structure;
        this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public List<ProgramModuleData> list(String subject, UUID organizationId, UUID programId, String requestId) {
        var context = policy.authorizeConsultant(subject, organizationId, "VIEW_PROGRAM_STRUCTURE", requestId);
        tenantContext.activate(context.organizationId());
        requireProgram(context.organizationId(), programId);
        return structure.listModules(context.organizationId(), programId);
    }

    @Transactional
    public ProgramModuleData createModule(String subject, UUID organizationId, UUID programId,
            String name, String description, int position, String requestId) {
        var context = policy.authorizeConsultant(subject, organizationId, "CREATE_PROGRAM_MODULE", requestId);
        tenantContext.activate(context.organizationId());
        requireProgram(context.organizationId(), programId);
        var created = structure.createModule(context.organizationId(), programId,
                new NewProgramModule(name, description, position));
        auditAfterCommit("PROGRAM_MODULE_CREATED", context.userId(), context.organizationId(), created.id(), requestId);
        return created;
    }

    @Transactional
    public ProgramSessionData createSession(String subject, UUID organizationId, UUID programId, UUID moduleId,
            String name, String description, String objective, LocalDate scheduledDate, int position, String requestId) {
        var context = policy.authorizeConsultant(subject, organizationId, "CREATE_PROGRAM_SESSION", requestId);
        tenantContext.activate(context.organizationId());
        requireProgram(context.organizationId(), programId);
        if (structure.findModule(context.organizationId(), programId, moduleId).isEmpty()) throw new ProgramNotFound();
        var created = structure.createSession(context.organizationId(), programId, moduleId,
                new NewProgramSession(name, description, objective, scheduledDate, position));
        auditAfterCommit("PROGRAM_SESSION_CREATED", context.userId(), context.organizationId(), created.id(), requestId);
        return created;
    }

    private void requireProgram(UUID organizationId, UUID programId) {
        if (programs.find(organizationId, programId).isEmpty()) throw new ProgramNotFound();
    }

    private void auditAfterCommit(String action, UUID actor, UUID organizationId, UUID resourceId, String requestId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(ProgramStructureService.class).info(
                        "action={} actor={} organization={} resourceId={} requestId={} timestamp={} result=SUCCESS",
                        action, actor, organizationId, resourceId, requestId, Instant.now());
            }
        });
    }
}
