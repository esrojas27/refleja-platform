package com.reflejatuinterior.organization.infrastructure.persistence;

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
import jakarta.persistence.Version;

@Entity
@Table(schema = "rti", name = "organizations")
class OrganizationJpaEntity {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "slug")
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private OrganizationStatus status;

    @Column(name = "logo_s3_key")
    private String logoS3Key;

    @Column(name = "default_time_zone", nullable = false)
    private String defaultTimeZone;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected OrganizationJpaEntity() {
    }

    OrganizationJpaEntity(
            String name,
            String slug,
            OrganizationStatus status,
            String logoS3Key,
            String defaultTimeZone) {
        this.name = name;
        this.slug = slug;
        this.status = status;
        this.logoS3Key = logoS3Key;
        this.defaultTimeZone = defaultTimeZone;
    }

    UUID id() {
        return id;
    }

    OrganizationStatus status() {
        return status;
    }

    String defaultTimeZone() {
        return defaultTimeZone;
    }

    long version() {
        return version;
    }
}
