package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

@Entity
@Table(
        schema = "rti",
        name = "enrollments",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_enrollments_organization_program_participant",
                columnNames = {
                    "organization_id", "program_id", "participant_membership_id"
                }))
class EnrollmentJpaEntity {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "program_id", nullable = false)
    private UUID programId;

    @Column(name = "participant_membership_id", nullable = false)
    private UUID participantMembershipId;

    @Column(name = "invitation_id")
    private UUID invitationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private EnrollmentStatus status;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected EnrollmentJpaEntity() {
    }

    EnrollmentJpaEntity(
            UUID organizationId,
            UUID programId,
            UUID participantMembershipId,
            EnrollmentStatus status,
            Instant approvedAt,
            Instant startedAt,
            Instant completedAt,
            Instant withdrawnAt) {
        this.organizationId = organizationId;
        this.programId = programId;
        this.participantMembershipId = participantMembershipId;
        this.status = status;
        this.approvedAt = approvedAt;
        this.startedAt = startedAt;
        this.completedAt = completedAt;
        this.withdrawnAt = withdrawnAt;
    }

    UUID id() {
        return id;
    }

    UUID organizationId() {
        return organizationId;
    }

    UUID programId() { return programId; }

    UUID participantMembershipId() { return participantMembershipId; }

    UUID invitationId() { return invitationId; }

    void attachInvitation(UUID invitationId) { this.invitationId = invitationId; }

    void activate() {
        if (status != EnrollmentStatus.INVITED && status != EnrollmentStatus.ACTIVE) {
            throw new com.reflejatuinterior.participation.application.EnrollmentConflict();
        }
        // Activation grants enrollment access, not program attendance or progress.
        status = EnrollmentStatus.ACTIVE;
    }

    EnrollmentStatus status() {
        return status;
    }

    long version() {
        return version;
    }
}
