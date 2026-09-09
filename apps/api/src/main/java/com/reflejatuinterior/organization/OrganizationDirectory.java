package com.reflejatuinterior.organization;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Internal module API for IDs already resolved from the caller's memberships. */
public interface OrganizationDirectory {
    List<OrganizationSummary> findSummaries(Set<UUID> organizationIds);

    record OrganizationSummary(UUID id, String name, String status) {
    }
}
