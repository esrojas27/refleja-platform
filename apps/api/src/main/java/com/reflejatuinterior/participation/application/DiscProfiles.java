package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DiscProfiles {
    List<Data> findAll(UUID organizationId, UUID programId, Collection<UUID> enrollmentIds);

    Data save(UUID organizationId, UUID programId, UUID enrollmentId, Texts texts,
            Long expectedVersion, UUID actorId);

    record Texts(String dominant, String influential, String serene, String conscientious) {}

    record Data(UUID id, UUID organizationId, UUID programId, UUID enrollmentId,
            String dominant, String influential, String serene, String conscientious,
            UUID createdBy, UUID updatedBy, Instant createdAt, Instant updatedAt, long version) {}
}
