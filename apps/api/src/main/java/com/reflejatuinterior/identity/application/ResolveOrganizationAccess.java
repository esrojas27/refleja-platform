package com.reflejatuinterior.identity.application;

import java.util.Objects;
import java.util.UUID;
import com.reflejatuinterior.identity.OrganizationAccess;
import org.springframework.stereotype.Service;

@Service
class ResolveOrganizationAccess implements OrganizationAccess {
    private final IdentityContextService contexts;
    ResolveOrganizationAccess(IdentityContextService contexts) { this.contexts = contexts; }

    @Override
    public Context resolve(String subject, UUID organizationId) {
        Objects.requireNonNull(organizationId);
        try {
            var principal = contexts.resolve(subject, organizationId);
            return new Context(principal.userId(), principal.activeOrganizationId(), principal.roles());
        } catch (IdentityAccessDeniedException exception) {
            throw new Denied();
        } catch (OrganizationUnavailableException exception) {
            throw new Unavailable();
        }
    }
}
