package com.reflejatuinterior.identity.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(schema = "rti", name = "user_invitations")
class UserInvitationJpaEntity {
    @Id @GeneratedValue @UuidGenerator(style = UuidGenerator.Style.VERSION_7) UUID id;
    @Column(name = "organization_id", nullable = false) UUID organizationId;
    @Column(name = "user_id", nullable = false) UUID userId;
    @Column(name = "membership_id", nullable = false) UUID membershipId;
    @Column(name = "invited_by", nullable = false) UUID invitedBy;
    @Column(name = "cognito_username", nullable = false) String cognitoUsername;
    @Enumerated(EnumType.STRING) @Column(nullable = false) InvitationStatus status;
    @Column(name = "expires_at", nullable = false) Instant expiresAt;
    @Column(name = "accepted_at") Instant acceptedAt;
    @Enumerated(EnumType.STRING) @Column(name = "delivery_status", nullable = false) DeliveryStatus deliveryStatus;
    @Column(name = "delivery_lease_until") Instant deliveryLeaseUntil;
    @Column(name = "delivery_attempt_id") UUID deliveryAttemptId;
    @Column(name = "credentials_sent_at") Instant credentialsSentAt;
    @Column(name = "ses_message_id") String sesMessageId;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @Version long version;

    protected UserInvitationJpaEntity() {}
    UserInvitationJpaEntity(UUID organizationId, UUID userId, UUID membershipId, UUID invitedBy,
                            String cognitoUsername, Instant expiresAt) {
        this.organizationId = organizationId; this.userId = userId; this.membershipId = membershipId;
        this.invitedBy = invitedBy; this.cognitoUsername = cognitoUsername; this.expiresAt = expiresAt;
        status = InvitationStatus.PENDING; deliveryStatus = DeliveryStatus.PENDING;
    }
    String effectiveStatus(Instant now) {
        return status == InvitationStatus.PENDING && !now.isBefore(expiresAt) ? InvitationStatus.EXPIRED.name() : status.name();
    }
    enum InvitationStatus { PENDING, ACCEPTED, EXPIRED, REVOKED }
    enum DeliveryStatus { PENDING, SENDING, SENT, FAILED }
}
