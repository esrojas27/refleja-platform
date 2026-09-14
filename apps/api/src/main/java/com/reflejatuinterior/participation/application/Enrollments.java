package com.reflejatuinterior.participation.application;

import java.util.List;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface Enrollments {
    Data create(UUID organizationId, UUID programId, UUID membershipId, UUID invitationId);
    Page list(UUID organizationId, UUID programId, int page, int size);
    Optional<Data> find(UUID organizationId, UUID programId, UUID enrollmentId);
    Optional<Data> findByInvitation(UUID organizationId, UUID invitationId);
    Data activate(UUID organizationId, UUID invitationId);
    long countOwned(UUID organizationId, UUID membershipId);
    List<Data> listOwned(UUID organizationId, UUID membershipId, int offset, int limit);
    Optional<Data> findOwned(UUID organizationId, UUID membershipId, UUID programId);
    List<Data> findActive(UUID organizationId, UUID programId, Collection<UUID> enrollmentIds);

    record Data(UUID id, UUID organizationId, UUID programId, UUID membershipId, UUID invitationId, String status) {}
    record Page(List<Data> items, int page, int size, long totalElements, int totalPages) {
        public Page { items = List.copyOf(items); }
    }
}
