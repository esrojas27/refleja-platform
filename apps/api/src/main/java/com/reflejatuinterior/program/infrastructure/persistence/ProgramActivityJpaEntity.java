package com.reflejatuinterior.program.infrastructure.persistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "program_activities", uniqueConstraints = {
        @UniqueConstraint(name = "uq_program_activities_organization_program_id",
                columnNames = {"organization_id", "program_id", "id"}),
        @UniqueConstraint(name = "uq_program_activities_position",
                columnNames = {"organization_id", "session_id", "position"})
})
class ProgramActivityJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false)
    private UUID programId;
    @Column(name = "module_id", nullable = false, updatable = false)
    private UUID moduleId;
    @Column(name = "session_id", nullable = false, updatable = false)
    private UUID sessionId;
    @Column(name = "title", nullable = false)
    private String title;
    @Column(name = "instructions", nullable = false, columnDefinition = "text")
    private String instructions;
    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;
    @Column(name = "position", nullable = false)
    private int position;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Version @Column(name = "version", nullable = false)
    private long version;

    protected ProgramActivityJpaEntity() {}

    ProgramActivityJpaEntity(UUID organizationId, UUID programId, UUID moduleId, UUID sessionId,
            String title, String instructions, LocalDate dueDate, int position) {
        this.organizationId = organizationId;
        this.programId = programId;
        this.moduleId = moduleId;
        this.sessionId = sessionId;
        this.title = title;
        this.instructions = instructions;
        this.dueDate = dueDate;
        this.position = position;
    }

    UUID id() { return id; }
    UUID organizationId() { return organizationId; }
    UUID programId() { return programId; }
    UUID moduleId() { return moduleId; }
    UUID sessionId() { return sessionId; }
    String title() { return title; }
    String instructions() { return instructions; }
    LocalDate dueDate() { return dueDate; }
    int position() { return position; }
    long version() { return version; }
}
