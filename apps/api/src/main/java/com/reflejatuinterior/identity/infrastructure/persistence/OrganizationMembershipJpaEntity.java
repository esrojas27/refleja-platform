package com.reflejatuinterior.identity.infrastructure.persistence;

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
        name = "organization_memberships",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_organization_memberships_organization_user",
                columnNames = {"organization_id", "user_id"}))
class OrganizationMembershipJpaEntity {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private MembershipStatus status;

    @Column(name = "joined_at")
    private Instant joinedAt;

    @Column(name = "job_title")
    private String jobTitle;

    @Enumerated(EnumType.STRING)
    @Column(name = "profile_status", nullable = false)
    private ProfileStatus profileStatus = ProfileStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected OrganizationMembershipJpaEntity() {
    }

    OrganizationMembershipJpaEntity(
            UUID organizationId,
            UUID userId,
            MembershipStatus status,
            Instant joinedAt) {
        this.organizationId = organizationId;
        this.userId = userId;
        this.status = status;
        this.joinedAt = joinedAt;
    }

    UUID id() {
        return id;
    }

    UUID organizationId() {
        return organizationId;
    }

    MembershipStatus status() {
        return status;
    }

    long version() {
        return version;
    }

    UUID userId() { return userId; }
    String jobTitle() { return jobTitle; }
    ProfileStatus profileStatus() { return profileStatus; }
    void completeProfile(String jobTitle) {
        this.jobTitle = jobTitle;
        this.profileStatus = ProfileStatus.COMPLETE;
    }
    void acceptInvitation(Instant now) {
        if (status == MembershipStatus.PENDING) { status = MembershipStatus.ACTIVE; joinedAt = now; }
    }
}
