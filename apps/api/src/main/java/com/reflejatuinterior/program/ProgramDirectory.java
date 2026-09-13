package com.reflejatuinterior.program;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/** Internal metadata API. Callers must first authorize the tenant or invitation owner. */
public interface ProgramDirectory {
    Optional<Summary> find(UUID organizationId, UUID programId);

    record Summary(UUID id, UUID organizationId, String name, String description, String status,
                   LocalDate startDate, LocalDate endDate, long version) {}
}
