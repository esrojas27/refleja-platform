package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import com.reflejatuinterior.participation.application.EnrollmentChanges;
import com.reflejatuinterior.participation.application.Enrollments;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation=Propagation.MANDATORY)
class JpaEnrollmentChanges implements EnrollmentChanges {
    private final EntityManager em;
    JpaEnrollmentChanges(EntityManager em) { this.em=em; }
    @Override public void record(Enrollments.Data previous, Enrollments.Data current, String action,
            Set<String> previousRoles, Set<String> roles, UUID actor, String label, String reason, String request) {
        var row=new EnrollmentChangeJpaEntity();
        row.organizationId=current.organizationId(); row.programId=current.programId(); row.enrollmentId=current.id();
        row.membershipId=current.membershipId();
        row.action=action; row.previousStatus=previous==null?null:previous.status(); row.status=current.status();
        row.previousRoles=String.join(",",previousRoles.stream().sorted().toList()); row.roles=String.join(",",roles.stream().sorted().toList());
        row.previousInvitationId=previous==null?null:previous.invitationId(); row.invitationId=current.invitationId();
        row.actorId=actor; row.actorLabel=label; row.reason=reason; row.requestId=UUID.fromString(request);
        row.enrollmentVersion=current.version(); row.recordedAt=Instant.now(); em.persist(row); em.flush();
    }
    @Override public Page list(UUID org, UUID program, UUID enrollment, int page, int size) {
        var rows=em.createQuery("""
                select h from EnrollmentChangeJpaEntity h where h.organizationId=:org and
                ((h.programId=:program and h.enrollmentId=:enrollment) or
                 (h.action='CHANGE_ROLE' and h.enrollmentId in
                    (select e.id from EnrollmentJpaEntity e where e.organizationId=:org and e.participantMembershipId=
                        (select own.participantMembershipId from EnrollmentJpaEntity own
                         where own.organizationId=:org and own.programId=:program and own.id=:enrollment))))
                order by h.recordedAt desc,h.id desc
                """,EnrollmentChangeJpaEntity.class).setParameter("org",org).setParameter("program",program)
                .setParameter("enrollment",enrollment).setFirstResult(page*size).setMaxResults(size).getResultList();
        long total=em.createQuery("""
                select count(h) from EnrollmentChangeJpaEntity h where h.organizationId=:org and
                ((h.programId=:program and h.enrollmentId=:enrollment) or
                 (h.action='CHANGE_ROLE' and h.enrollmentId in
                    (select e.id from EnrollmentJpaEntity e where e.organizationId=:org and e.participantMembershipId=
                        (select own.participantMembershipId from EnrollmentJpaEntity own
                         where own.organizationId=:org and own.programId=:program and own.id=:enrollment))))
                """,Long.class).setParameter("org",org).setParameter("program",program).setParameter("enrollment",enrollment).getSingleResult();
        return new Page(rows.stream().map(h->new Entry(h.id,h.programId,h.action,h.previousStatus,h.status,roles(h.previousRoles),roles(h.roles),
                h.previousInvitationId,h.invitationId,h.actorId,h.actorLabel,h.reason,h.requestId.toString(),h.enrollmentVersion,h.recordedAt)).toList(),
                page,size,total,(int)Math.min(Integer.MAX_VALUE,(total+size-1)/size));
    }
    private static Set<String> roles(String csv) { return Arrays.stream(csv.split(",")).filter(s->!s.isBlank()).collect(Collectors.toUnmodifiableSet()); }
}
