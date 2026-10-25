package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import java.util.List;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;
import com.reflejatuinterior.participation.domain.QuestionOptions;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
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
    @JdbcTypeCode(SqlTypes.ARRAY) @Column(name = "options", nullable = false, columnDefinition = "text[]")
    private String[] options;
    @Column(name = "position", nullable = false) private int position;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Version @Column(name = "version", nullable = false) private long version;

    protected ActivityEvaluationQuestionJpaEntity() {}
    ActivityEvaluationQuestionJpaEntity(UUID organizationId, UUID programId, UUID evaluationId,
            String prompt, EvaluationQuestionType type, int position, List<String> options) {
        this.organizationId = organizationId; this.programId = programId; this.evaluationId = evaluationId;
        this.prompt = prompt; this.type = type; this.position = position;
        this.options = QuestionOptions.clean(type, options).toArray(String[]::new);
    }
    UUID id() { return id; }
    UUID evaluationId() { return evaluationId; }
    String prompt() { return prompt; }
    EvaluationQuestionType type() { return type; }
    List<String> options() { return List.of(options); }
    int position() { return position; }
    long version() { return version; }
}
