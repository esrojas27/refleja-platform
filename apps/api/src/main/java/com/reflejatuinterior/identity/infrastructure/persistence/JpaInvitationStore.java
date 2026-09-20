package com.reflejatuinterior.identity.infrastructure.persistence;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorInvitations.*;
import com.reflejatuinterior.identity.application.InvitationStore;
import com.reflejatuinterior.organization.OrganizationDirectory;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import static com.reflejatuinterior.identity.infrastructure.persistence.UserInvitationJpaEntity.DeliveryStatus.*;
import static com.reflejatuinterior.identity.infrastructure.persistence.UserInvitationJpaEntity.InvitationStatus.*;

@Repository
@Transactional(readOnly = true)
class JpaInvitationStore implements InvitationStore {
    private final EntityManager em;
    private final Clock clock;
    private final OrganizationDirectory organizations;
    JpaInvitationStore(EntityManager em, Clock clock, OrganizationDirectory organizations) { this.em = em; this.clock = clock; this.organizations = organizations; }

    @Override public void validateCandidate(Person person) {
        var users = em.createQuery("select u from UserJpaEntity u where u.emailNormalized = :email", UserJpaEntity.class)
                .setParameter("email", person.email()).setMaxResults(2).getResultList();
        if (users.size() > 1) throw new Conflict();
        users.forEach(this::enabled);
    }

    @Override @Transactional(propagation = Propagation.MANDATORY)
    public Invitation create(UUID organizationId, UUID actorId, Account account, Person person, InvitedRole role) {
        activeOrganization(organizationId);
        var membershipRole = MembershipRole.valueOf(role.name());
        if (account == null || account.subject() == null || account.subject().isBlank() || account.username() == null || account.username().isBlank()) throw new Conflict();
        var byEmail = em.createQuery("select u from UserJpaEntity u where u.emailNormalized = :email", UserJpaEntity.class)
                .setParameter("email", person.email()).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        if (byEmail.size() > 1 || byEmail.stream().anyMatch(u -> !u.cognitoSubject().equals(account.subject()))) throw new Conflict();
        var found = em.createQuery("select u from UserJpaEntity u where u.cognitoSubject = :subject", UserJpaEntity.class)
                .setParameter("subject", account.subject()).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        UserJpaEntity user;
        if (found.isEmpty()) {
            user = new UserJpaEntity(account.subject(), person.email(), person.email(), person.firstName(), person.lastName(), UserStatus.INVITED);
            em.persist(user); em.flush();
        } else {
            user = found.getFirst(); enabled(user);
            if (!user.emailNormalized().equals(person.email())) throw new Conflict();
        }
        var memberships = em.createQuery("select m from OrganizationMembershipJpaEntity m where m.organizationId = :org and m.userId = :user", OrganizationMembershipJpaEntity.class)
                .setParameter("org", organizationId).setParameter("user", user.id()).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        OrganizationMembershipJpaEntity member;
        if (memberships.isEmpty()) {
            member = new OrganizationMembershipJpaEntity(organizationId, user.id(), MembershipStatus.PENDING, null);
            em.persist(member); em.flush();
            em.persist(new MembershipRoleJpaEntity(member.id(), membershipRole));
        } else { member = memberships.getFirst(); enabled(member); }
        var invitation = new UserInvitationJpaEntity(organizationId, user.id(), member.id(), membershipRole,
                actorId, account.username(), clock.instant().plus(Duration.ofDays(7)));
        em.persist(invitation); em.flush();
        return data(invitation, user);
    }

    @Override public Invitation findOwned(String subject, UUID invitationId) {
        var user = user(subject, false);
        var invitation = owned(user.id(), invitationId, false);
        return data(invitation, user);
    }
    @Override public Page listOwned(String subject, int page, int size) {
        var user = user(subject, false);
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw new InvalidInput("page", "size");
        var rows = em.createQuery("select i from UserInvitationJpaEntity i where i.userId = :user order by i.id desc", UserInvitationJpaEntity.class)
                .setParameter("user", user.id()).setFirstResult(page * size).setMaxResults(size).getResultList();
        long total = em.createQuery("select count(i) from UserInvitationJpaEntity i where i.userId = :user", Long.class)
                .setParameter("user", user.id()).getSingleResult();
        return new Page(rows.stream().map(row -> data(row, user)).toList(), page, size, total, (int) Math.min(Integer.MAX_VALUE, (total + size - 1) / size));
    }
    @Override public Invitation findInOrganization(UUID organizationId, UUID invitationId) {
        var invitation = scoped(organizationId, invitationId, false);
        return data(invitation, em.find(UserJpaEntity.class, invitation.userId));
    }
    @Override public Participant participant(UUID organizationId, UUID membershipId) {
        var members = em.createQuery("select m from OrganizationMembershipJpaEntity m where m.organizationId = :org and m.id = :id", OrganizationMembershipJpaEntity.class)
                .setParameter("org", organizationId).setParameter("id", membershipId).getResultList();
        if (members.isEmpty()) throw new Unavailable();
        var member = members.getFirst(); var user = em.find(UserJpaEntity.class, member.userId());
        if (user == null) throw new Unavailable();
        return new Participant(user.id(), member.id(), user.email(), user.firstName(), user.lastName());
    }

    @Override @Transactional(propagation = Propagation.MANDATORY)
    public Invitation accept(String subject, UUID invitationId) {
        var user = user(subject, true);
        var invitation = owned(user.id(), invitationId, true);
        activeOrganization(invitation.organizationId);
        var member = em.find(OrganizationMembershipJpaEntity.class, invitation.membershipId, LockModeType.PESSIMISTIC_WRITE);
        enabled(member);
        if (invitation.status == REVOKED) throw new Unavailable();
        if (invitation.status == ACCEPTED) return data(invitation, user);
        if (!clock.instant().isBefore(invitation.expiresAt) || invitation.status == EXPIRED) throw new Expired();
        user.acceptInvitation(); member.acceptInvitation(clock.instant());
        if (em.find(MembershipRoleJpaEntity.class, new MembershipRoleId(member.id(), invitation.invitedRole)) == null) {
            em.persist(new MembershipRoleJpaEntity(member.id(), invitation.invitedRole));
        }
        invitation.status = ACCEPTED; invitation.acceptedAt = clock.instant();
        em.flush(); return data(invitation, user);
    }

    @Override @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Attempt claim(UUID organizationId, UUID invitationId) {
        var invitation = scoped(organizationId, invitationId, true);
        var user = em.find(UserJpaEntity.class, invitation.userId); enabled(user);
        enabled(em.find(OrganizationMembershipJpaEntity.class, invitation.membershipId));
        activeOrganization(organizationId);
        if (invitation.status == REVOKED) throw new Unavailable();
        if (invitation.status == ACCEPTED) return new Attempt(data(invitation, user), null, false);
        var now = clock.instant();
        if (!now.isBefore(invitation.expiresAt) || invitation.status == EXPIRED) throw new Expired();
        if (invitation.deliveryStatus == SENT || (invitation.deliveryStatus == SENDING && invitation.deliveryLeaseUntil != null && now.isBefore(invitation.deliveryLeaseUntil))) {
            return new Attempt(data(invitation, user), null, false);
        }
        invitation.deliveryStatus = SENDING;
        invitation.deliveryAttemptId = UUID.randomUUID();
        invitation.deliveryLeaseUntil = now.plus(Duration.ofMinutes(5));
        em.flush(); return new Attempt(data(invitation, user), invitation.deliveryAttemptId, invitation.credentialsSentAt == null);
    }

    @Override @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean credentialsSent(UUID organizationId, UUID invitationId, UUID attemptId) {
        var invitation = scoped(organizationId, invitationId, true);
        if (!currentAttempt(invitation, attemptId)) return false;
        invitation.credentialsSentAt = clock.instant();
        return true;
    }
    @Override @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Invitation finish(UUID organizationId, UUID invitationId, UUID attemptId, String messageId) {
        var invitation = scoped(organizationId, invitationId, true);
        if (currentAttempt(invitation, attemptId)) {
            invitation.deliveryStatus = messageId == null ? FAILED : SENT;
            invitation.sesMessageId = messageId;
            invitation.deliveryLeaseUntil = null; invitation.deliveryAttemptId = null;
            em.flush();
        }
        return data(invitation, em.find(UserJpaEntity.class, invitation.userId));
    }

    private boolean currentAttempt(UserInvitationJpaEntity invitation, UUID attemptId) {
        return invitation.deliveryStatus == SENDING && attemptId != null && attemptId.equals(invitation.deliveryAttemptId);
    }
    private UserJpaEntity user(String subject, boolean lock) {
        var query = em.createQuery("select u from UserJpaEntity u where u.cognitoSubject = :sub", UserJpaEntity.class).setParameter("sub", subject);
        if (lock) query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        var rows = query.getResultList(); if (rows.isEmpty()) throw new Denied();
        var user = rows.getFirst(); enabled(user); return user;
    }
    private UserInvitationJpaEntity owned(UUID userId, UUID id, boolean lock) {
        var query = em.createQuery("select i from UserInvitationJpaEntity i where i.id = :id and i.userId = :user", UserInvitationJpaEntity.class)
                .setParameter("id", id).setParameter("user", userId);
        if (lock) query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        return query.getResultStream().findFirst().orElseThrow(Unavailable::new);
    }
    private UserInvitationJpaEntity scoped(UUID org, UUID id, boolean lock) {
        var query = em.createQuery("select i from UserInvitationJpaEntity i where i.organizationId = :org and i.id = :id", UserInvitationJpaEntity.class)
                .setParameter("org", org).setParameter("id", id);
        if (lock) query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        return query.getResultStream().findFirst().orElseThrow(Unavailable::new);
    }
    private void enabled(UserJpaEntity user) {
        if (user == null || (user.status() != UserStatus.INVITED && user.status() != UserStatus.ACTIVE)) throw new Denied();
    }
    private void enabled(OrganizationMembershipJpaEntity member) {
        if (member == null || (member.status() != MembershipStatus.PENDING && member.status() != MembershipStatus.ACTIVE)) throw new Conflict();
    }
    private void activeOrganization(UUID org) {
        if (organizations.findSummaries(Set.of(org)).stream().noneMatch(o -> o.id().equals(org) && "ACTIVE".equals(o.status()))) throw new Unavailable();
    }
    private Invitation data(UserInvitationJpaEntity row, UserJpaEntity user) {
        return new Invitation(row.id, row.organizationId, row.userId, row.membershipId, InvitedRole.valueOf(row.invitedRole.name()),
                user.cognitoSubject(), row.cognitoUsername,
                user.email(), user.firstName(), user.lastName(), row.effectiveStatus(clock.instant()), row.expiresAt, row.deliveryStatus.name());
    }
}
