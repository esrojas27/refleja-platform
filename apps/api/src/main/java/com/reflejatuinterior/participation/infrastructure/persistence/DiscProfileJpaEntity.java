package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "program_participant_disc_profiles",
        uniqueConstraints = @UniqueConstraint(name = "uq_disc_profiles_program_enrollment",
                columnNames = {"organization_id", "program_id", "enrollment_id"}))
class DiscProfileJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false)
    private UUID programId;
    @Column(name = "enrollment_id", nullable = false, updatable = false)
    private UUID enrollmentId;
    @Column(name = "dominant_text", nullable = false, length = 5000)
    private String dominant;
    @Column(name = "influential_text", nullable = false, length = 5000)
    private String influential;
    @Column(name = "serene_text", nullable = false, length = 5000)
    private String serene;
    @Column(name = "conscientious_text", nullable = false, length = 5000)
    private String conscientious;
    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;
    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version @Column(name = "version", nullable = false)
    private long version;

    protected DiscProfileJpaEntity() {}

    DiscProfileJpaEntity(UUID organizationId, UUID programId, UUID enrollmentId,
            String dominant, String influential, String serene, String conscientious, UUID actorId) {
        this.organizationId = organizationId;
        this.programId = programId;
        this.enrollmentId = enrollmentId;
        update(dominant, influential, serene, conscientious, actorId);
        this.createdBy = actorId;
    }

    void update(String dominant, String influential, String serene, String conscientious, UUID actorId) {
        this.dominant = dominant;
        this.influential = influential;
        this.serene = serene;
        this.conscientious = conscientious;
        this.updatedBy = actorId;
    }

    UUID id() { return id; }
    UUID organizationId() { return organizationId; }
    UUID programId() { return programId; }
    UUID enrollmentId() { return enrollmentId; }
    String dominant() { return dominant; }
    String influential() { return influential; }
    String serene() { return serene; }
    String conscientious() { return conscientious; }
    UUID createdBy() { return createdBy; }
    UUID updatedBy() { return updatedBy; }
    Instant createdAt() { return createdAt; }
    Instant updatedAt() { return updatedAt; }
    long version() { return version; }
}
