package com.reflejatuinterior.organization;

import java.util.UUID;

/** Establishes the organization visible to PostgreSQL for the current transaction. */
public interface OrganizationTenantContext {
    void activate(UUID organizationId);
}
