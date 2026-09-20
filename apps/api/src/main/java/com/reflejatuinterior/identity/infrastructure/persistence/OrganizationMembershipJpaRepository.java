package com.reflejatuinterior.identity.infrastructure.persistence;

import java.util.UUID;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface OrganizationMembershipJpaRepository
        extends JpaRepository<OrganizationMembershipJpaEntity, UUID> {
    Optional<OrganizationMembershipJpaEntity> findByOrganizationIdAndUserId(UUID organizationId, UUID userId);
}
