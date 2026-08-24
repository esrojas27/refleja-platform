package com.reflejatuinterior.identity.infrastructure.persistence;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

class MembershipRoleId implements Serializable {

    private static final long serialVersionUID = 1L;

    private UUID membershipId;
    private MembershipRole role;

    protected MembershipRoleId() {
    }

    MembershipRoleId(UUID membershipId, MembershipRole role) {
        this.membershipId = membershipId;
        this.role = role;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof MembershipRoleId that)) {
            return false;
        }
        return Objects.equals(membershipId, that.membershipId) && role == that.role;
    }

    @Override
    public int hashCode() {
        return Objects.hash(membershipId, role);
    }
}
