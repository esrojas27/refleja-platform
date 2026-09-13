package com.reflejatuinterior.program.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "program_modules", uniqueConstraints = {
        @UniqueConstraint(name = "uq_program_modules_organization_program_id", columnNames = {"organization_id", "program_id", "id"}),
        @UniqueConstraint(name = "uq_program_modules_position", columnNames = {"organization_id", "program_id", "position"})
})
class ProgramModuleJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false)
    private UUID programId;
    @Column(name = "name", nullable = false)
    private String name;
    @Column(name = "description", columnDefinition = "text")
    private String description;
    @Column(name = "position", nullable = false)
    private int position;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version @Column(name = "version", nullable = false)
    private long version;

    protected ProgramModuleJpaEntity() {}

    ProgramModuleJpaEntity(UUID organizationId, UUID programId, String name, String description, int position) {
        this.organizationId = organizationId;
        this.programId = programId;
        this.name = name;
        this.description = description;
        this.position = position;
    }

    UUID id() { return id; }
    UUID organizationId() { return organizationId; }
    UUID programId() { return programId; }
    String name() { return name; }
    String description() { return description; }
    int position() { return position; }
    long version() { return version; }
}
