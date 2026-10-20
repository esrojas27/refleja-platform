package com.reflejatuinterior.program.application;

import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.program.domain.NewProgram;

public interface Programs {
    ProgramData create(UUID organizationId, NewProgram input);
    ProgramPage list(UUID organizationId, int page, int size);
    Optional<ProgramData> find(UUID organizationId, UUID programId);
    ChangedStatus transition(UUID organizationId, UUID programId, String target, long expectedVersion);
    void requireEditable(UUID organizationId, UUID programId);

    record ChangedStatus(String previousStatus, ProgramData program) {}
}
