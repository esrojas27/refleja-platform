package com.reflejatuinterior.programtemplate.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "program_templates")
class ProgramTemplateJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "source_organization_id", nullable = false, updatable = false)
    private UUID sourceOrganizationId;
    @Column(name = "source_program_id", nullable = false, updatable = false)
    private UUID sourceProgramId;
    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    private UUID createdByUserId;
    @Column(name = "name", nullable = false)
    private String name;
    @Column(name = "description", columnDefinition = "text")
    private String description;
    @Column(name = "snapshot", nullable = false, columnDefinition = "text", updatable = false)
    private String snapshot;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version @Column(name = "version", nullable = false)
    private long version;

    protected ProgramTemplateJpaEntity() {}

    ProgramTemplateJpaEntity(UUID sourceOrganizationId, UUID sourceProgramId, UUID createdByUserId,
            String name, String description, String snapshot) {
        this.sourceOrganizationId = sourceOrganizationId;
        this.sourceProgramId = sourceProgramId;
        this.createdByUserId = createdByUserId;
        this.name = name;
        this.description = description;
        this.snapshot = snapshot;
    }

    UUID id() { return id; }
    UUID sourceOrganizationId() { return sourceOrganizationId; }
    UUID sourceProgramId() { return sourceProgramId; }
    String name() { return name; }
    String description() { return description; }
    String snapshot() { return snapshot; }
    Instant createdAt() { return createdAt; }
    long version() { return version; }
}
