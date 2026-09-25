package com.reflejatuinterior.programtemplate.application;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProgramTemplates {
    Stored create(UUID sourceOrganizationId, UUID sourceProgramId, UUID createdByUserId,
                  String name, String description, ProgramTemplateSnapshot snapshot);
    Page list(int page, int size);
    Optional<Stored> find(UUID templateId);

    record Stored(UUID id, UUID sourceOrganizationId, UUID sourceProgramId, String name, String description,
                  ProgramTemplateSnapshot snapshot, Instant createdAt, long version) {}
    record Page(List<Stored> items, int page, int size, long totalElements, int totalPages) {
        public Page { items = List.copyOf(items); }
    }
}
