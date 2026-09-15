package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.program.application.ProgramModuleData;
import com.reflejatuinterior.program.application.ProgramSessionData;
import com.reflejatuinterior.program.application.ProgramStructure;
import com.reflejatuinterior.program.domain.NewProgramModule;
import com.reflejatuinterior.program.domain.NewProgramSession;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaProgramStructure implements ProgramStructure {
    private final ProgramModuleJpaRepository modules;
    private final ProgramSessionJpaRepository sessions;

    JpaProgramStructure(ProgramModuleJpaRepository modules, ProgramSessionJpaRepository sessions) {
        this.modules = modules;
        this.sessions = sessions;
    }

    @Override public ProgramModuleData createModule(UUID organizationId, UUID programId, NewProgramModule input) {
        return moduleData(modules.saveAndFlush(new ProgramModuleJpaEntity(organizationId, programId,
                input.name(), input.description(), input.position())), List.of());
    }

    @Override public List<ProgramModuleData> listModules(UUID organizationId, UUID programId) {
        var allSessions = sessions.findByOrganizationIdAndProgramIdOrderByModuleIdAscPositionAscIdAsc(organizationId, programId);
        return modules.findByOrganizationIdAndProgramIdOrderByPositionAscIdAsc(organizationId, programId).stream()
                .map(module -> moduleData(module, allSessions.stream()
                        .filter(session -> session.moduleId().equals(module.id()))
                        .map(JpaProgramStructure::sessionData).toList()))
                .toList();
    }

    @Override public Optional<ProgramModuleData> findModule(UUID organizationId, UUID programId, UUID moduleId) {
        return modules.findByOrganizationIdAndProgramIdAndId(organizationId, programId, moduleId)
                .map(module -> moduleData(module, List.of()));
    }

    @Override public ProgramSessionData createSession(UUID organizationId, UUID programId, UUID moduleId,
            NewProgramSession input) {
        return sessionData(sessions.saveAndFlush(new ProgramSessionJpaEntity(organizationId, programId, moduleId,
                input.name(), input.description(), input.objective(), input.scheduledDate(), input.position())));
    }

    private static ProgramModuleData moduleData(ProgramModuleJpaEntity entity, List<ProgramSessionData> sessions) {
        return new ProgramModuleData(entity.id(), entity.organizationId(), entity.programId(), entity.name(),
                entity.description(), entity.position(), entity.version(), sessions);
    }

    private static ProgramSessionData sessionData(ProgramSessionJpaEntity entity) {
        return new ProgramSessionData(entity.id(), entity.organizationId(), entity.programId(), entity.moduleId(),
                entity.name(), entity.description(), entity.objective(), entity.scheduledDate(), entity.position(), entity.version());
    }
}
