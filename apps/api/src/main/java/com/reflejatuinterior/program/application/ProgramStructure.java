package com.reflejatuinterior.program.application;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.program.domain.NewProgramModule;
import com.reflejatuinterior.program.domain.NewProgramSession;

public interface ProgramStructure {
    ProgramModuleData createModule(UUID organizationId, UUID programId, NewProgramModule input);
    default List<ProgramModuleData> listModules(UUID organizationId, UUID programId) { return listModules(organizationId, programId, false); }
    List<ProgramModuleData> listModules(UUID organizationId, UUID programId, boolean includeArchived);
    Optional<ProgramModuleData> findModule(UUID organizationId, UUID programId, UUID moduleId);
    ProgramSessionData createSession(UUID organizationId, UUID programId, UUID moduleId, NewProgramSession input);
}
