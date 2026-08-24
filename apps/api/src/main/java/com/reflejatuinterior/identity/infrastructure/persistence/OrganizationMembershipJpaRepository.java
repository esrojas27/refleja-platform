package com.reflejatuinterior.identity.infrastructure.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface OrganizationMembershipJpaRepository
        extends JpaRepository<OrganizationMembershipJpaEntity, UUID> {
}
