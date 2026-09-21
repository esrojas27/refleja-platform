package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "activity_evaluation_questions", uniqueConstraints =
        @UniqueConstraint(name = "uq_activity_evaluation_questions_position",
                columnNames = {"organization_id", "evaluation_id", "position"}))
class ActivityEvaluationQuestionJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false) private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false) private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false) private UUID programId;
    @Column(name = "evaluation_id", nullable = false, updatable = false) private UUID evaluationId;
    @Column(name = "prompt", nullable = false, length = 500) private String prompt;
    @Enumerated(EnumType.STRING) @Column(name = "question_type", nullable = false, length = 32)
    private EvaluationQuestionType type;
    @Column(name = "position", nullable = false) private int position;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version @Column(name = "version", nullable = false) private long version;

    protected ActivityEvaluationQuestionJpaEntity() {}
    ActivityEvaluationQuestionJpaEntity(UUID organizationId, UUID programId, UUID evaluationId,
            String prompt, EvaluationQuestionType type, int position) {
        this.organizationId = organizationId; this.programId = programId; this.evaluationId = evaluationId;
        this.prompt = prompt; this.type = type; this.position = position;
    }
    UUID id() { return id; }
    UUID evaluationId() { return evaluationId; }
    String prompt() { return prompt; }
    EvaluationQuestionType type() { return type; }
    int position() { return position; }
    long version() { return version; }
}
