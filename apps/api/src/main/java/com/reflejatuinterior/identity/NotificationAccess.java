package com.reflejatuinterior.identity;

import java.util.List;
import java.util.UUID;

/** Current, uncached identity and active tenant memberships for the private inbox. */
public interface NotificationAccess {
    Context resolve(String subject);
    record Context(UUID userId, List<UUID> organizationIds) {
        public Context { organizationIds = List.copyOf(organizationIds); }
    }
    class Denied extends RuntimeException {}
}
