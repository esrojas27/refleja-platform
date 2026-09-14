package com.reflejatuinterior.participation.application;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ActivityAssignments {
    List<Data> create(UUID organizationId, UUID programId, UUID activityId, Collection<UUID> enrollmentIds);
    List<Data> listByActivities(UUID organizationId, UUID programId, Collection<UUID> activityIds);
    List<Data> listOwned(UUID organizationId, UUID programId, UUID enrollmentId);

    record Data(UUID id, UUID organizationId, UUID programId, UUID activityId, UUID enrollmentId) {}
}
