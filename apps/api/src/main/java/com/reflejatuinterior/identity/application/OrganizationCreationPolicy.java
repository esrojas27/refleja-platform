package com.reflejatuinterior.identity.application;

import java.util.UUID;
import com.reflejatuinterior.identity.domain.AuthenticatedPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OrganizationCreationPolicy {
    private final UUID operatorOrganizationId;

    public OrganizationCreationPolicy(@Value("${app.security.operator-organization-id:}") String configuredId) {
        // Empty disables creation. A malformed configured ID fails startup, never broadens access.
        operatorOrganizationId = configuredId.isBlank() ? null : UUID.fromString(configuredId);
    }

    public boolean allows(AuthenticatedPrincipal principal) {
        // resolve() supplies only active user, memberships and organizations from PostgreSQL.
        // This capability is distinct from roles in the currently selected tenant.
        return operatorOrganizationId != null && principal.organizations().stream().anyMatch(
                org -> operatorOrganizationId.equals(org.id()) && org.roles().contains("CONSULTANT"));
    }

    public void authorize(AuthenticatedPrincipal principal) {
        if (!allows(principal)) throw new IdentityAccessDeniedException();
    }
}
