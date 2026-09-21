package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "activity_evaluations", uniqueConstraints = {
        @UniqueConstraint(name = "uq_activity_evaluations_organization_program_id",
                columnNames = {"organization_id", "program_id", "id"}),
        @UniqueConstraint(name = "uq_activity_evaluations_activity",
                columnNames = {"organization_id", "program_id", "activity_id"})
})
class ActivityEvaluationJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false) private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false) private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false) private UUID programId;
    @Column(name = "activity_id", nullable = false, updatable = false) private UUID activityId;
    @Column(name = "title", nullable = false, length = 255) private String title;
    @Column(name = "instructions", columnDefinition = "text") private String instructions;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version @Column(name = "version", nullable = false) private long version;

    protected ActivityEvaluationJpaEntity() {}
    ActivityEvaluationJpaEntity(UUID organizationId, UUID programId, UUID activityId,
            String title, String instructions) {
        this.organizationId = organizationId; this.programId = programId; this.activityId = activityId;
        this.title = title; this.instructions = instructions;
    }
    UUID id() { return id; }
    UUID organizationId() { return organizationId; }
    UUID programId() { return programId; }
    UUID activityId() { return activityId; }
    String title() { return title; }
    String instructions() { return instructions; }
    long version() { return version; }
}
