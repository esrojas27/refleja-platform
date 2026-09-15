package com.reflejatuinterior.program.infrastructure.persistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "program_sessions", uniqueConstraints = {
        @UniqueConstraint(name = "uq_program_sessions_organization_id", columnNames = {"organization_id", "id"}),
        @UniqueConstraint(name = "uq_program_sessions_position", columnNames = {"organization_id", "module_id", "position"})
})
class ProgramSessionJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false)
    private UUID programId;
    @Column(name = "module_id", nullable = false, updatable = false)
    private UUID moduleId;
    @Column(name = "name", nullable = false)
    private String name;
    @Column(name = "description", columnDefinition = "text")
    private String description;
    @Column(name = "objective", columnDefinition = "text")
    private String objective;
    @Column(name = "scheduled_date", nullable = false)
    private LocalDate scheduledDate;
    @Column(name = "position", nullable = false)
    private int position;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version @Column(name = "version", nullable = false)
    private long version;

    protected ProgramSessionJpaEntity() {}

    ProgramSessionJpaEntity(UUID organizationId, UUID programId, UUID moduleId, String name,
            String description, String objective, LocalDate scheduledDate, int position) {
        this.organizationId = organizationId;
        this.programId = programId;
        this.moduleId = moduleId;
        this.name = name;
        this.description = description;
        this.objective = objective;
        this.scheduledDate = scheduledDate;
        this.position = position;
    }

    UUID id() { return id; }
    UUID organizationId() { return organizationId; }
    UUID programId() { return programId; }
    UUID moduleId() { return moduleId; }
    String name() { return name; }
    String description() { return description; }
    String objective() { return objective; }
    LocalDate scheduledDate() { return scheduledDate; }
    int position() { return position; }
    long version() { return version; }
}
