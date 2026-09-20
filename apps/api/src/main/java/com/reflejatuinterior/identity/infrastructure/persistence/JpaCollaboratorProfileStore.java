package com.reflejatuinterior.identity.infrastructure.persistence;

import java.util.UUID;
import java.util.stream.Stream;

import com.reflejatuinterior.identity.application.CollaboratorProfileStore;
import com.reflejatuinterior.identity.application.CollaboratorProfileUnavailable;
import org.springframework.stereotype.Repository;

@Repository
class JpaCollaboratorProfileStore implements CollaboratorProfileStore {
    private final UserJpaRepository users;
    private final OrganizationMembershipJpaRepository memberships;

    JpaCollaboratorProfileStore(UserJpaRepository users, OrganizationMembershipJpaRepository memberships) {
        this.users = users;
        this.memberships = memberships;
    }

    @Override
    public ProfileData find(UUID userId, UUID organizationId) {
        var user = users.findById(userId).orElseThrow(CollaboratorProfileUnavailable::new);
        var membership = memberships.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseThrow(CollaboratorProfileUnavailable::new);
        return profile(organizationId, user, membership);
    }

    @Override
    public ProfileData complete(UUID userId, UUID organizationId, ProfileUpdate update) {
        var user = users.findById(userId).orElseThrow(CollaboratorProfileUnavailable::new);
        var membership = memberships.findByOrganizationIdAndUserId(organizationId, userId)
                .orElseThrow(CollaboratorProfileUnavailable::new);
        user.completeProfile(update.fullName(), update.dateOfBirth(), update.phone(), update.city(), update.country());
        membership.completeProfile(update.jobTitle());
        users.save(user);
        memberships.saveAndFlush(membership);
        return profile(organizationId, user, membership);
    }

    private ProfileData profile(UUID organizationId, UserJpaEntity user, OrganizationMembershipJpaEntity membership) {
        String suggestedName = Stream.of(user.firstName(), user.lastName())
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + " " + right).orElse(user.email());
        return new ProfileData(organizationId, user.email(),
                user.fullName() == null ? suggestedName : user.fullName(), user.dateOfBirth(), user.phone(),
                user.city(), user.country(), membership.jobTitle(), membership.profileStatus().name());
    }
}
