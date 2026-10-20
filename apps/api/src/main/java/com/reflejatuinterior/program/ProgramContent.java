package com.reflejatuinterior.program;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Internal definition administration. Callers authorize, activate the tenant and lock the program. */
public interface ProgramContent {
    Node describe(UUID org, UUID program, Kind kind, UUID id);
    void editDimension(UUID org, UUID program, UUID id, String name, String description);
    void editSession(UUID org, UUID program, UUID id, String name, String objective, LocalDate date);
    void editActivity(UUID org, UUID program, UUID id, String title, String instructions, String youtubeUrl, LocalDate dueDate);
    void archive(UUID org, UUID program, Kind kind, UUID id, boolean archived);
    void move(UUID org, UUID program, Kind kind, UUID id, boolean up);
    /** Refuses deletion whenever any descendant has assignments or survey responses. */
    void deleteUnassigned(UUID org, UUID program, Kind kind, UUID id);

    record Node(UUID id, long version, boolean archived, boolean parentArchived, List<UUID> activityIds) {
        public Node { activityIds = List.copyOf(activityIds); }
        public void expect(long expected) {
            if (version != expected) throw new Conflict("CONTENT_VERSION_CONFLICT");
        }
        public void requireVisible() {
            if (archived || parentArchived) throw new Conflict("CONTENT_ARCHIVED");
        }
    }
    enum Kind {
        DIMENSION, SESSION, ACTIVITY;
        public static Kind parse(String path) {
            return switch (path) {
                case "dimensions" -> DIMENSION; case "sessions" -> SESSION; case "activities" -> ACTIVITY;
                default -> throw new ProgramActivities.InvalidInput("kind");
            };
        }
    }
    class Conflict extends RuntimeException {
        private final String code;
        public Conflict(String code) { this.code = code; }
        public String code() { return code; }
    }
}
