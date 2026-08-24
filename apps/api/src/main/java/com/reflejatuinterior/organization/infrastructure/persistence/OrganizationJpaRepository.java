package com.reflejatuinterior.organization.infrastructure.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface OrganizationJpaRepository extends JpaRepository<OrganizationJpaEntity, UUID> {
}
