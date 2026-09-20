package com.reflejatuinterior.identity.domain;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** Immutable application context; separate from the external JWT authentication. */
public record AuthenticatedPrincipal(
        UserIdentity user, List<OrganizationAccess> organizations, UUID activeOrganizationId) {

    public AuthenticatedPrincipal {
        Objects.requireNonNull(user);
        organizations = List.copyOf(organizations);
        if (activeOrganizationId != null && organizations.stream()
                .noneMatch(organization -> organization.id().equals(activeOrganizationId))) {
            throw new IllegalArgumentException("Active organization must belong to the available context");
        }
    }

    public UUID userId() {
        return user.id();
    }

    public String cognitoSubject() {
        return user.cognitoSubject();
    }

    public Set<String> roles() {
        return organizations.stream()
                .filter(organization -> organization.id().equals(activeOrganizationId))
                .findFirst().map(OrganizationAccess::roles).orElse(Set.of());
    }

    /** Role checks never combine memberships or grant a role outside the selected tenant. */
    public boolean hasRole(UUID organizationId, String role) {
        return organizationId != null && organizationId.equals(activeOrganizationId)
                && roles().contains(role);
    }

    public record UserIdentity(
            UUID id, String cognitoSubject, String email, String firstName, String lastName) {
    }

    public record OrganizationAccess(UUID id, String name, Set<String> roles, String profileStatus) {
        public OrganizationAccess {
            roles = Set.copyOf(roles);
        }

        public OrganizationAccess(UUID id, String name, Set<String> roles) {
            this(id, name, roles, "COMPLETE");
        }
    }
}
