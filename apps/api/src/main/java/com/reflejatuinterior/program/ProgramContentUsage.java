package com.reflejatuinterior.program;

import java.util.Collection;
import java.util.UUID;

/** Usage boundary: the participation module owns assignment and response data. */
public interface ProgramContentUsage {
    boolean hasAssignments(UUID org, UUID program, Collection<UUID> activityIds);
    boolean hasResponses(UUID org, UUID program, Collection<UUID> activityIds);
}
