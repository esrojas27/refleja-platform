package com.reflejatuinterior.program.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.reflejatuinterior.program.domain.InvalidProgramInput;
import com.reflejatuinterior.program.domain.NewProgram;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ProgramService {
    private final ProgramAccessPolicy policy;
    private final Programs programs;
    ProgramService(ProgramAccessPolicy policy, Programs programs) { this.policy = policy; this.programs = programs; }

    @Transactional
    public ProgramData create(String subject, UUID organizationId, String name, String description,
                              LocalDate startDate, LocalDate endDate, String requestId) {
        var context = policy.authorize(subject, organizationId, true, requestId);
        var created = programs.create(context.organizationId(), new NewProgram(name, description, startDate, endDate));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                LoggerFactory.getLogger(ProgramService.class).info(
                        "action=PROGRAM_CREATED actor={} organization={} resource=Program resourceId={} requestId={} timestamp={} result=SUCCESS",
                        context.userId(), context.organizationId(), created.id(), requestId, Instant.now());
            }
        });
        return created;
    }

    @Transactional(readOnly = true)
    public ProgramPage list(String subject, UUID organizationId, int page, int size, String requestId) {
        var context = policy.authorize(subject, organizationId, false, requestId);
        if (page < 0) throw new InvalidProgramInput("page");
        if (size < 1 || size > 100) throw new InvalidProgramInput("size");
        if ((long) page * size > Integer.MAX_VALUE) throw new InvalidProgramInput("page");
        return programs.list(context.organizationId(), page, size);
    }

    @Transactional(readOnly = true)
    public ProgramData detail(String subject, UUID organizationId, UUID programId, String requestId) {
        var context = policy.authorize(subject, organizationId, false, requestId);
        return programs.find(context.organizationId(), programId).orElseThrow(ProgramNotFound::new);
    }
}
