package com.reflejatuinterior.identity;

import java.util.List;
import java.util.UUID;

/** Public Identity API for self-service collaborator use cases after JWT validation. */
public interface CollaboratorAccess {
    Context resolve(String cognitoSubject);

    record Context(UUID userId, List<Membership> memberships) {
        public Context { memberships = List.copyOf(memberships); }
    }

    record Membership(UUID id, UUID organizationId, String organizationName) {}

    class Denied extends RuntimeException {}
}
