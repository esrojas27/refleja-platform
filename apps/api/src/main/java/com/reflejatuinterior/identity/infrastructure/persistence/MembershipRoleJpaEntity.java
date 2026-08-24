package com.reflejatuinterior.identity.infrastructure.persistence;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

@Entity
@IdClass(MembershipRoleId.class)
@Table(schema = "rti", name = "membership_roles")
class MembershipRoleJpaEntity {

    @Id
    @Column(name = "membership_id", nullable = false)
    private UUID membershipId;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private MembershipRole role;

    protected MembershipRoleJpaEntity() {
    }

    MembershipRoleJpaEntity(UUID membershipId, MembershipRole role) {
        this.membershipId = membershipId;
        this.role = role;
    }

    UUID membershipId() {
        return membershipId;
    }

    MembershipRole role() {
        return role;
    }
}
