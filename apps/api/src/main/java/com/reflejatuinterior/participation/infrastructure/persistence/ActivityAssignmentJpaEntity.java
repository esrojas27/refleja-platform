package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityWorkflowConflict;
import com.reflejatuinterior.participation.domain.ActivityAssignmentStatus;
import com.reflejatuinterior.participation.domain.ActivityReviewDecision;
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
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ActivityAssignmentStatus status;
    @Column(name = "response_text")
    private String responseText;
    @Column(name = "submitted_at")
    private Instant submittedAt;
    @Column(name = "review_comment")
    private String reviewComment;
    @Column(name = "reviewed_at")
    private Instant reviewedAt;
    @Column(name = "reviewed_by")
    private UUID reviewedBy;
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
        this.status = ActivityAssignmentStatus.ASSIGNED;
    }

    void submit(String responseText) {
        if (status != ActivityAssignmentStatus.ASSIGNED
                && status != ActivityAssignmentStatus.CHANGES_REQUESTED) {
            throw new ActivityWorkflowConflict();
        }
        this.responseText = responseText;
        this.submittedAt = Instant.now();
        this.status = ActivityAssignmentStatus.SUBMITTED;
        this.reviewComment = null;
        this.reviewedAt = null;
        this.reviewedBy = null;
    }

    void review(ActivityReviewDecision decision, String comment, UUID reviewerId) {
        if (status != ActivityAssignmentStatus.SUBMITTED) throw new ActivityWorkflowConflict();
        status = decision == ActivityReviewDecision.APPROVE
                ? ActivityAssignmentStatus.COMPLETED : ActivityAssignmentStatus.CHANGES_REQUESTED;
        reviewComment = comment;
        reviewedAt = Instant.now();
        reviewedBy = reviewerId;
    }

    UUID id() { return id; }
    UUID organizationId() { return organizationId; }
    UUID programId() { return programId; }
    UUID activityId() { return activityId; }
    UUID enrollmentId() { return enrollmentId; }
    ActivityAssignmentStatus status() { return status; }
    String responseText() { return responseText; }
    Instant submittedAt() { return submittedAt; }
    String reviewComment() { return reviewComment; }
    Instant reviewedAt() { return reviewedAt; }
    UUID reviewedBy() { return reviewedBy; }
    long version() { return version; }
}
