package com.reflejatuinterior.identity.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.identity.application.CreatorMemberships;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
class JpaCreatorMemberships implements CreatorMemberships {
    private final EntityManager entities;

    JpaCreatorMemberships(EntityManager entities) { this.entities = entities; }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void addConsultant(UUID organizationId, UUID userId) {
        var membership = new OrganizationMembershipJpaEntity(organizationId, userId, MembershipStatus.ACTIVE, Instant.now());
        entities.persist(membership);
        entities.persist(new MembershipRoleJpaEntity(membership.id(), MembershipRole.CONSULTANT));
        entities.flush();
    }
}
