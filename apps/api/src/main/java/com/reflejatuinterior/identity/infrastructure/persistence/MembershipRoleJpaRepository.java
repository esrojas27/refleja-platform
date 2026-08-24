package com.reflejatuinterior.identity.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

interface MembershipRoleJpaRepository
        extends JpaRepository<MembershipRoleJpaEntity, MembershipRoleId> {
}
