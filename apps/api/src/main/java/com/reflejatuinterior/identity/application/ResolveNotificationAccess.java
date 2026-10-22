package com.reflejatuinterior.identity.application;

import com.reflejatuinterior.identity.NotificationAccess;
import org.springframework.stereotype.Service;

@Service
class ResolveNotificationAccess implements NotificationAccess {
    private final IdentityContextService identities;
    ResolveNotificationAccess(IdentityContextService identities) { this.identities = identities; }
    public Context resolve(String subject) {
        try {
            var principal = identities.resolve(subject, null);
            return new Context(principal.userId(), principal.organizations().stream().map(o -> o.id()).toList());
        } catch (IdentityAccessDeniedException exception) { throw new Denied(); }
    }
}
