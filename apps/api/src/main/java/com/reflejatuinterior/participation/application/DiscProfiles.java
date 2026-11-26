package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DiscProfiles {
    List<Data> findAll(UUID organizationId, UUID programId, Collection<UUID> enrollmentIds);

    Data save(UUID organizationId, UUID programId, UUID enrollmentId, Percentages percentages,
            Long expectedVersion, UUID actorId);

    record Percentages(Integer dominant, Integer influential, Integer serene, Integer conscientious) {}

    record Data(UUID id, UUID organizationId, UUID programId, UUID enrollmentId,
            Integer dominant, Integer influential, Integer serene, Integer conscientious,
            UUID createdBy, UUID updatedBy, Instant createdAt, Instant updatedAt, long version) {}
}
