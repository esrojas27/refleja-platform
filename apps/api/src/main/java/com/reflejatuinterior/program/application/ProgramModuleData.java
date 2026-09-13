package com.reflejatuinterior.program.application;

import java.util.List;
import java.util.UUID;

public record ProgramModuleData(UUID id, UUID organizationId, UUID programId, String name,
        String description, int position, long version, List<ProgramSessionData> sessions) {
    public ProgramModuleData {
        sessions = List.copyOf(sessions);
    }
}
