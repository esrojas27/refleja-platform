package com.reflejatuinterior.program;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/** Internal metadata API. Callers must first authorize the tenant or invitation owner. */
public interface ProgramDirectory {
    Optional<Summary> find(UUID organizationId, UUID programId);

    /** Serialize a mutation with lifecycle changes, inside the caller's tenant transaction. */
    Optional<Summary> lock(UUID organizationId, UUID programId);

    record Summary(UUID id, UUID organizationId, String name, String description, String status,
                   LocalDate startDate, LocalDate endDate, long version, boolean activated) {
        public void requireEditable() {
            if ("COMPLETED".equals(status) || "CANCELLED".equals(status)) throw new StateConflict("PROGRAM_READ_ONLY");
        }
        public void requireActive() {
            if (!"ACTIVE".equals(status)) throw new StateConflict("PROGRAM_NOT_ACTIVE");
        }
    }

    class StateConflict extends RuntimeException {
        private final String code;
        public StateConflict(String code) { this.code = code; }
        public String code() { return code; }
    }
}
