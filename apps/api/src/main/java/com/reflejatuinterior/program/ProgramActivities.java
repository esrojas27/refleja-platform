package com.reflejatuinterior.program;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Internal activity-definition API. Callers must authorize and activate the tenant first. */
public interface ProgramActivities {
    Activity create(UUID organizationId, UUID programId, UUID sessionId, String title,
                    String instructions, String youtubeUrl, LocalDate dueDate, int position);
    List<Activity> list(UUID organizationId, UUID programId);
    List<Activity> findAll(UUID organizationId, UUID programId, Collection<UUID> activityIds);

    record Activity(UUID id, UUID organizationId, UUID programId, UUID moduleId, UUID sessionId,
                    String title, String instructions, String youtubeUrl, LocalDate dueDate,
                    int position, long version) {}

    class Missing extends RuntimeException {}
    class InvalidInput extends RuntimeException {
        private final String field;
        public InvalidInput(String field) { this.field = field; }
        public String field() { return field; }
    }
}
