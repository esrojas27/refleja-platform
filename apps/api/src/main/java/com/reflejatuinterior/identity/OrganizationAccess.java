package com.reflejatuinterior.identity;

import java.util.Set;
import java.util.UUID;

/** Public Identity API. Call only after validating the Cognito access token. No cached permissions. */
public interface OrganizationAccess {
    Context resolve(String cognitoSubject, UUID organizationId);

    record Context(UUID userId, UUID membershipId, UUID organizationId, Set<String> roles) {
        public Context { roles = Set.copyOf(roles); }
        public Context(UUID userId, UUID organizationId, Set<String> roles) {
            this(userId, null, organizationId, roles);
        }
    }

    class Denied extends RuntimeException {}
    class Unavailable extends RuntimeException {}
}
