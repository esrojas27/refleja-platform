package com.reflejatuinterior.participation.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import jakarta.persistence.*;

@Entity
@Table(schema = "rti", name = "program_participant_disc_profile_revisions")
class DiscProfileRevisionJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "profile_id", nullable = false, updatable = false)
    private UUID profileId;
    @Column(name = "organization_id", nullable = false, updatable = false)
    private UUID organizationId;
    @Column(name = "program_id", nullable = false, updatable = false)
    private UUID programId;
    @Column(name = "enrollment_id", nullable = false, updatable = false)
    private UUID enrollmentId;
    @Column(name = "dominant_text", nullable = false, updatable = false, length = 5000)
    private String dominant;
    @Column(name = "influential_text", nullable = false, updatable = false, length = 5000)
    private String influential;
    @Column(name = "serene_text", nullable = false, updatable = false, length = 5000)
    private String serene;
    @Column(name = "conscientious_text", nullable = false, updatable = false, length = 5000)
    private String conscientious;
    @Column(name = "action", nullable = false, updatable = false)
    private String action;
    @Column(name = "actor_id", nullable = false, updatable = false)
    private UUID actorId;
    @Column(name = "profile_version", nullable = false, updatable = false)
    private long profileVersion;
    @CreationTimestamp @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;

    protected DiscProfileRevisionJpaEntity() {}

    DiscProfileRevisionJpaEntity(DiscProfileJpaEntity profile, String action, UUID actorId) {
        this.profileId = profile.id(); this.organizationId = profile.organizationId();
        this.programId = profile.programId(); this.enrollmentId = profile.enrollmentId();
        this.dominant = profile.dominant(); this.influential = profile.influential();
        this.serene = profile.serene(); this.conscientious = profile.conscientious();
        this.action = action; this.actorId = actorId; this.profileVersion = profile.version();
    }
}
