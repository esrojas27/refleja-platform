package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(schema="rti",name="enrollment_changes")
class EnrollmentChangeJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style=UuidGenerator.Style.VERSION_7) UUID id;
    @Column(name="organization_id",nullable=false,updatable=false) UUID organizationId;
    @Column(name="program_id",nullable=false,updatable=false) UUID programId;
    @Column(name="enrollment_id",nullable=false,updatable=false) UUID enrollmentId;
    @Column(name="membership_id",nullable=false,updatable=false) UUID membershipId;
    @Column(nullable=false,updatable=false) String action;
    @Column(name="previous_status",updatable=false) String previousStatus;
    @Column(nullable=false,updatable=false) String status;
    @Column(name="previous_roles",nullable=false,updatable=false) String previousRoles;
    @Column(nullable=false,updatable=false) String roles;
    @Column(name="previous_invitation_id",updatable=false) UUID previousInvitationId;
    @Column(name="invitation_id",updatable=false) UUID invitationId;
    @Column(name="actor_id",nullable=false,updatable=false) UUID actorId;
    @Column(name="actor_label",nullable=false,updatable=false,length=255) String actorLabel;
    @Column(nullable=false,updatable=false,length=1000) String reason;
    @Column(name="request_id",nullable=false,updatable=false) UUID requestId;
    @Column(name="enrollment_version",nullable=false,updatable=false) long enrollmentVersion;
    @Column(name="recorded_at",nullable=false,updatable=false) Instant recordedAt;
    protected EnrollmentChangeJpaEntity() {}
}
