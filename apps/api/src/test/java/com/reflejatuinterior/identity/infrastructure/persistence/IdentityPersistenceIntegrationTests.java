package com.reflejatuinterior.identity.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class IdentityPersistenceIntegrationTests extends PostgreSqlIntegrationTestSupport {

    @Autowired
    UserJpaRepository userRepository;

    @Autowired
    OrganizationMembershipJpaRepository membershipRepository;

    @Autowired
    MembershipRoleJpaRepository roleRepository;

    @Test
    void persistsUsersMembershipsAndRolesThroughTheirInternalRepositories() {
        UUID organizationId = uuid7(100);
        insertOrganization(organizationId);

        UserJpaEntity user = userRepository.saveAndFlush(new UserJpaEntity(
                "cognito-subject",
                "Person@Example.test",
                "person@example.test",
                "Test",
                "Person",
                UserStatus.ACTIVE));
        OrganizationMembershipJpaEntity membership = membershipRepository.saveAndFlush(
                new OrganizationMembershipJpaEntity(
                        organizationId,
                        user.id(),
                        MembershipStatus.ACTIVE,
                        Instant.now()));
        MembershipRoleJpaEntity role = roleRepository.saveAndFlush(
                new MembershipRoleJpaEntity(membership.id(), MembershipRole.COLLABORATOR));

        assertThat(user.id().version()).isEqualTo(7);
        assertThat(user.status()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.version()).isZero();
        assertThat(membership.id().version()).isEqualTo(7);
        assertThat(membership.organizationId()).isEqualTo(organizationId);
        assertThat(membership.status()).isEqualTo(MembershipStatus.ACTIVE);
        assertThat(membership.version()).isZero();
        assertThat(role.membershipId()).isEqualTo(membership.id());
        assertThat(role.role()).isEqualTo(MembershipRole.COLLABORATOR);
        assertThat(userRepository.findById(user.id())).containsSame(user);
        assertThat(membershipRepository.findById(membership.id())).containsSame(membership);
        assertThat(roleRepository.findById(
                new MembershipRoleId(membership.id(), MembershipRole.COLLABORATOR)))
                .containsSame(role);
    }

    @Test
    void rejectsASecondMembershipForTheSameOrganizationAndUser() {
        UUID organizationId = uuid7(101);
        UUID userId = uuid7(102);
        insertOrganization(organizationId);
        insertUser(userId);

        membershipRepository.saveAndFlush(new OrganizationMembershipJpaEntity(
                organizationId,
                userId,
                MembershipStatus.PENDING,
                null));

        assertThatThrownBy(() -> membershipRepository.saveAndFlush(
                new OrganizationMembershipJpaEntity(
                        organizationId,
                        userId,
                        MembershipStatus.ACTIVE,
                        Instant.now())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
