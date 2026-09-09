package com.reflejatuinterior.identity.application;

import java.util.UUID;

public interface CreatorMemberships {
    void addConsultant(UUID organizationId, UUID userId);
}
