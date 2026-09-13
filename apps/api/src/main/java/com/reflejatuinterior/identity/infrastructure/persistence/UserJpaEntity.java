package com.reflejatuinterior.identity.infrastructure.persistence;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(schema = "rti", name = "users")
class UserJpaEntity {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "cognito_subject", nullable = false, unique = true)
    private String cognitoSubject;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "email_normalized", nullable = false)
    private String emailNormalized;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private UserStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected UserJpaEntity() {
    }

    UserJpaEntity(
            String cognitoSubject,
            String email,
            String emailNormalized,
            String firstName,
            String lastName,
            UserStatus status) {
        this.cognitoSubject = cognitoSubject;
        this.email = email;
        this.emailNormalized = emailNormalized;
        this.firstName = firstName;
        this.lastName = lastName;
        this.status = status;
    }

    UUID id() {
        return id;
    }

    UserStatus status() {
        return status;
    }

    long version() {
        return version;
    }

    String cognitoSubject() { return cognitoSubject; }
    String email() { return email; }
    String emailNormalized() { return emailNormalized; }
    String firstName() { return firstName; }
    String lastName() { return lastName; }
    void acceptInvitation() { if (status == UserStatus.INVITED) status = UserStatus.ACTIVE; }
}
