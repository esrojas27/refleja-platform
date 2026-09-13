package com.reflejatuinterior.program.application;

import java.time.LocalDate;
import java.util.UUID;

public record ProgramSessionData(UUID id, UUID organizationId, UUID programId, UUID moduleId,
        String name, String description, LocalDate scheduledDate, int position, long version) {}
