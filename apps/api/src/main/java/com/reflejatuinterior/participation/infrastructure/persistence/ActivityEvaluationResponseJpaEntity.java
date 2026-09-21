package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "activity_evaluation_responses", uniqueConstraints =
        @UniqueConstraint(name = "uq_activity_evaluation_responses_assignment",
                columnNames = {"organization_id", "program_id", "assignment_id"}))
class ActivityEvaluationResponseJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false) private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false) private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false) private UUID programId;
    @Column(name = "activity_id", nullable = false, updatable = false) private UUID activityId;
    @Column(name = "evaluation_id", nullable = false, updatable = false) private UUID evaluationId;
    @Column(name = "assignment_id", nullable = false, updatable = false) private UUID assignmentId;
    @Column(name = "enrollment_id", nullable = false, updatable = false) private UUID enrollmentId;
    @Column(name = "completed_at", nullable = false, updatable = false) private Instant completedAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version @Column(name = "version", nullable = false) private long version;

    protected ActivityEvaluationResponseJpaEntity() {}
    ActivityEvaluationResponseJpaEntity(UUID organizationId, UUID programId, UUID activityId,
            UUID evaluationId, UUID assignmentId, UUID enrollmentId) {
        this.organizationId = organizationId; this.programId = programId; this.activityId = activityId;
        this.evaluationId = evaluationId; this.assignmentId = assignmentId; this.enrollmentId = enrollmentId;
        this.completedAt = Instant.now();
    }
    UUID id() { return id; }
    UUID evaluationId() { return evaluationId; }
    UUID assignmentId() { return assignmentId; }
    UUID enrollmentId() { return enrollmentId; }
    Instant completedAt() { return completedAt; }
    long version() { return version; }
}
