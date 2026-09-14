package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "activity_assignments", uniqueConstraints =
        @UniqueConstraint(name = "uq_activity_assignments_activity_enrollment",
                columnNames = {"organization_id", "activity_id", "enrollment_id"}))
class ActivityAssignmentJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false)
    private UUID programId;
    @Column(name = "activity_id", nullable = false, updatable = false)
    private UUID activityId;
    @Column(name = "enrollment_id", nullable = false, updatable = false)
    private UUID enrollmentId;
    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version @Column(name = "version", nullable = false)
    private long version;

    protected ActivityAssignmentJpaEntity() {}

    ActivityAssignmentJpaEntity(UUID organizationId, UUID programId, UUID activityId, UUID enrollmentId) {
        this.organizationId = organizationId;
        this.programId = programId;
        this.activityId = activityId;
        this.enrollmentId = enrollmentId;
        this.assignedAt = Instant.now();
    }

    UUID id() { return id; }
    UUID organizationId() { return organizationId; }
    UUID programId() { return programId; }
    UUID activityId() { return activityId; }
    UUID enrollmentId() { return enrollmentId; }
}
