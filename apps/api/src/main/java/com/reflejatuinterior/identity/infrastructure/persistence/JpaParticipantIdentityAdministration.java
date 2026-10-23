package com.reflejatuinterior.identity.infrastructure.persistence;

import java.time.Clock;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.ParticipantIdentityAdministration;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation=Propagation.MANDATORY)
class JpaParticipantIdentityAdministration implements ParticipantIdentityAdministration {
    private final EntityManager em;
    private final Clock clock;
    private final JpaInvitationStore invitations;
    JpaParticipantIdentityAdministration(EntityManager em,Clock clock,JpaInvitationStore invitations) {
        this.em=em; this.clock=clock; this.invitations=invitations;
    }
    @Override public State inspect(UUID org,UUID membership) { return state(member(org,membership,false)); }
    @Override public State changeRole(UUID org,UUID membership,long version,CollaboratorInvitations.InvitedRole target) {
        if(target==null) throw new Conflict("PARTICIPANT_ROLE_INVALID");
        var snapshot=member(org,membership,false);
        // Serialize role changes with invitation acceptance/creation for the same user.
        var user=em.find(UserJpaEntity.class,snapshot.userId(),LockModeType.PESSIMISTIC_WRITE); em.refresh(user);
        var member=member(org,membership,true); var before=state(member); enabled(before);
        if(before.version()!=version) throw new Conflict("MEMBERSHIP_VERSION_CONFLICT");
        if(before.roles().contains("CONSULTANT")||before.roles().contains("SUPER_ADMIN")) throw new Conflict("PARTICIPANT_ADMINISTRATIVE_ACCESS");
        var selected=MembershipRole.valueOf(target.name());
        var existing=em.createQuery("select r from MembershipRoleJpaEntity r where r.membershipId=:id",MembershipRoleJpaEntity.class)
                .setParameter("id",membership).getResultList();
        if(before.roles().equals(Set.of(target.name()))) throw new Conflict("PARTICIPANT_ROLE_UNCHANGED");
        // Only the three inviteable business roles may be replaced, on the verified tenant membership.
        for(var row:existing) if(Set.of(MembershipRole.COLLABORATOR,MembershipRole.LEADER,MembershipRole.COMPANY_ADMIN).contains(row.role())&&row.role()!=selected) em.remove(row);
        if(!before.roles().contains(target.name())) em.persist(new MembershipRoleJpaEntity(membership,selected));
        // Pending invitations must not silently re-grant an obsolete role later.
        var pending=em.createQuery("""
                select i from UserInvitationJpaEntity i where i.organizationId=:org and i.membershipId=:member and i.status<>:status
                """,UserInvitationJpaEntity.class).setParameter("org",org).setParameter("member",membership)
                .setParameter("status",UserInvitationJpaEntity.InvitationStatus.ACCEPTED).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        pending.forEach(i->i.invitedRole=selected);
        member.rolesChanged(); em.flush(); return state(member);
    }
    @Override public CollaboratorInvitations.Invitation revoke(UUID org,UUID id) {
        var row=invitation(org,id,true);
        if(row.status==UserInvitationJpaEntity.InvitationStatus.ACCEPTED) throw new Conflict("INVITATION_ALREADY_ACCEPTED");
        if(row.status==UserInvitationJpaEntity.InvitationStatus.REVOKED) throw new Conflict("INVITATION_ALREADY_REVOKED");
        row.status=UserInvitationJpaEntity.InvitationStatus.REVOKED;
        // An email already handed to the provider cannot be recalled; invalidate this link and lease.
        row.deliveryAttemptId=null; row.deliveryLeaseUntil=null;
        if(row.deliveryStatus==UserInvitationJpaEntity.DeliveryStatus.SENDING) row.deliveryStatus=UserInvitationJpaEntity.DeliveryStatus.FAILED;
        em.flush(); return invitations.findInOrganization(org,id);
    }
    @Override public CollaboratorInvitations.Invitation renew(UUID org,UUID actor,UUID id) {
        var snapshot=invitation(org,id,false);
        var user=em.find(UserJpaEntity.class,snapshot.userId,LockModeType.PESSIMISTIC_WRITE); em.refresh(user);
        var member=member(org,snapshot.membershipId,true); enabled(state(member));
        var previous=invitation(org,id,true);
        if(!Set.of("EXPIRED","REVOKED").contains(previous.effectiveStatus(clock.instant()))) throw new Conflict("INVITATION_RENEWAL_NOT_ALLOWED");
        if(previous.status!=UserInvitationJpaEntity.InvitationStatus.REVOKED) previous.status=UserInvitationJpaEntity.InvitationStatus.EXPIRED;
        previous.deliveryAttemptId=null; previous.deliveryLeaseUntil=null;
        var fresh=new UserInvitationJpaEntity(org,previous.userId,previous.membershipId,previous.invitedRole,actor,previous.cognitoUsername,null);
        em.persist(fresh); em.flush(); return invitations.findInOrganization(org,fresh.id);
    }
    private OrganizationMembershipJpaEntity member(UUID org,UUID id,boolean lock) {
        var query=em.createQuery("select m from OrganizationMembershipJpaEntity m where m.organizationId=:org and m.id=:id",OrganizationMembershipJpaEntity.class)
                .setParameter("org",org).setParameter("id",id);
        if(lock) query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        var member=query.getResultStream().findFirst().orElseThrow(CollaboratorInvitations.Unavailable::new);
        if(lock) em.refresh(member); return member;
    }
    private UserInvitationJpaEntity invitation(UUID org,UUID id,boolean lock) {
        var query=em.createQuery("select i from UserInvitationJpaEntity i where i.organizationId=:org and i.id=:id",UserInvitationJpaEntity.class)
                .setParameter("org",org).setParameter("id",id);
        if(lock) query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        var row=query.getResultStream().findFirst().orElseThrow(CollaboratorInvitations.Unavailable::new);
        if(lock) em.refresh(row); return row;
    }
    private State state(OrganizationMembershipJpaEntity member) {
        var roles=em.createQuery("select r.role from MembershipRoleJpaEntity r where r.membershipId=:id",MembershipRole.class)
                .setParameter("id",member.id()).getResultList().stream().map(Enum::name).collect(Collectors.toUnmodifiableSet());
        return new State(roles,member.version(),member.status().name(),em.find(UserJpaEntity.class,member.userId()).status().name());
    }
    private static void enabled(State state) {
        if(!Set.of("ACTIVE","PENDING").contains(state.membershipStatus())||!Set.of("ACTIVE","INVITED").contains(state.userStatus()))
            throw new Conflict("PARTICIPANT_IDENTITY_DISABLED");
    }
}
