package com.reflejatuinterior.program.infrastructure.persistence;

import java.time.Instant;
import java.time.LocalDate;
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
        name = "programs",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_programs_organization_id",
                columnNames = {"organization_id", "id"}))
class ProgramJpaEntity {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ProgramStatus status;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "primary_consultant_membership_id")
    private UUID primaryConsultantMembershipId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected ProgramJpaEntity() {
    }

    ProgramJpaEntity(
            UUID organizationId,
            String name,
            String description,
            ProgramStatus status,
            LocalDate startDate,
            LocalDate endDate,
            UUID primaryConsultantMembershipId) {
        this.organizationId = organizationId;
        this.name = name;
        this.description = description;
        this.status = status;
        this.startDate = startDate;
        this.endDate = endDate;
        this.primaryConsultantMembershipId = primaryConsultantMembershipId;
    }

    UUID id() {
        return id;
    }

    UUID organizationId() {
        return organizationId;
    }

    ProgramStatus status() {
        return status;
    }

    LocalDate startDate() {
        return startDate;
    }

    long version() {
        return version;
    }
}
