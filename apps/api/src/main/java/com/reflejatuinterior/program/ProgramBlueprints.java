package com.reflejatuinterior.program;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Public program structure API used to snapshot and materialize program templates. */
public interface ProgramBlueprints {
    Optional<Source> find(UUID organizationId, UUID programId);

    Created create(UUID organizationId, ProgramDraft program, List<DimensionDraft> dimensions);

    record Source(UUID id, UUID organizationId, String name, String description,
                  LocalDate startDate, LocalDate endDate, List<Dimension> dimensions) {
        public Source { dimensions = List.copyOf(dimensions); }
    }

    record Dimension(String name, String description, int position, List<Session> sessions) {
        public Dimension { sessions = List.copyOf(sessions); }
    }

    record Session(String name, String description, String objective, LocalDate scheduledDate,
                   int position, List<Activity> activities) {
        public Session { activities = List.copyOf(activities); }
    }

    record Activity(UUID id, String title, String instructions, String youtubeUrl,
                    LocalDate dueDate, int position) {}

    record ProgramDraft(String name, String description, LocalDate startDate, LocalDate endDate) {}

    record DimensionDraft(String name, String description, int position, List<SessionDraft> sessions) {
        public DimensionDraft { sessions = List.copyOf(sessions); }
    }

    record SessionDraft(String name, String description, String objective, LocalDate scheduledDate,
                        int position, List<ActivityDraft> activities) {
        public SessionDraft { activities = List.copyOf(activities); }
    }

    record ActivityDraft(String reference, String title, String instructions, String youtubeUrl,
                         LocalDate dueDate, int position) {}

    record Program(UUID id, UUID organizationId, String name, String description, String status,
                   LocalDate startDate, LocalDate endDate, long version) {}

    record Created(Program program, Map<String, UUID> activityIds) {
        public Created { activityIds = Map.copyOf(activityIds); }
    }

    class InvalidInput extends RuntimeException {
        private final String field;
        public InvalidInput(String field) { this.field = field; }
        public String field() { return field; }
    }
}
