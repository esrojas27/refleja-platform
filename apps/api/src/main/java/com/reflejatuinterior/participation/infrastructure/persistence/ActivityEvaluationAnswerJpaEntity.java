package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "activity_evaluation_answers", uniqueConstraints =
        @UniqueConstraint(name = "uq_activity_evaluation_answers_position",
                columnNames = {"organization_id", "response_id", "question_id", "position"}))
class ActivityEvaluationAnswerJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false) private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false) private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false) private UUID programId;
    @Column(name = "response_id", nullable = false, updatable = false) private UUID responseId;
    @Column(name = "question_id", nullable = false, updatable = false) private UUID questionId;
    @Column(name = "answer_value", nullable = false, length = 5000) private String value;
    @Column(name = "position", nullable = false) private int position;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version @Column(name = "version", nullable = false) private long version;

    protected ActivityEvaluationAnswerJpaEntity() {}
    ActivityEvaluationAnswerJpaEntity(UUID organizationId, UUID programId, UUID responseId,
            UUID questionId, String value, int position) {
        this.organizationId = organizationId; this.programId = programId; this.responseId = responseId;
        this.questionId = questionId; this.value = value; this.position = position;
    }
    UUID responseId() { return responseId; }
    UUID questionId() { return questionId; }
    String value() { return value; }
    int position() { return position; }
}
