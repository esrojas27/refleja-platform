package com.reflejatuinterior.organization;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Internal module API for IDs already resolved from the caller's memberships. */
public interface OrganizationDirectory {
    List<OrganizationSummary> findSummaries(Set<UUID> organizationIds);

    /** Caller must authorize the organization before requesting reporting metadata. */
    java.util.Optional<ReportInfo> reportInfo(UUID organizationId);

    record ReportInfo(String name, String timeZone) {}

    record OrganizationSummary(UUID id, String name, String status) {
    }
}
