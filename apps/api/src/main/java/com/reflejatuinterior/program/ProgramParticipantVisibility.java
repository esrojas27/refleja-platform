package com.reflejatuinterior.program;

import java.util.Set;
import java.util.UUID;

/** Participation-owned exclusions for basic metadata access by non-consultants. */
public interface ProgramParticipantVisibility {
    Set<UUID> blockedPrograms(UUID organizationId, UUID membershipId);
}
