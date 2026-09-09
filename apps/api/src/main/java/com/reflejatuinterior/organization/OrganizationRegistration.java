package com.reflejatuinterior.organization;

import java.util.UUID;

/** Internal write API. Caller must authorize the operator and own the transaction. */
public interface OrganizationRegistration {
    RegisteredOrganization create(String name, String defaultTimeZone);

    record RegisteredOrganization(UUID id, String name, String status, String defaultTimeZone, long version) {}
}
