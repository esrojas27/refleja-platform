package com.reflejatuinterior.identity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Identity-owned invitation workflow. Call provision/create/dispatch only after scoped authorization. */
public interface CollaboratorInvitations {
    enum InvitedRole { COLLABORATOR, LEADER, COMPANY_ADMIN }
    record Person(String email, String firstName, String lastName) {}
    record Account(String subject, String username, boolean needsWelcome) {}
    record Participant(UUID userId, UUID membershipId, String email, String firstName, String lastName) {}
    record Invitation(UUID id, UUID organizationId, UUID userId, UUID membershipId, InvitedRole role,
                      String cognitoSubject, String cognitoUsername, String email, String firstName,
                      String lastName, String status, Instant expiresAt, String deliveryStatus) {}
    record Page(List<Invitation> items, int page, int size, long totalElements, int totalPages) {
        public Page { items = List.copyOf(items); }
    }

    Account provision(Person person);
    Invitation create(UUID organizationId, UUID actorId, Account account, Person person, InvitedRole role);
    Invitation findOwned(String subject, UUID invitationId);
    Page listOwned(String subject, int page, int size);
    Invitation findInOrganization(UUID organizationId, UUID invitationId);
    Participant participant(UUID organizationId, UUID membershipId);
    Invitation accept(String subject, UUID invitationId);
    Invitation dispatch(UUID organizationId, UUID invitationId);

    class Denied extends RuntimeException {}
    class Unavailable extends RuntimeException {}
    class Conflict extends RuntimeException {}
    class Expired extends RuntimeException {}
    class DeliveryUnavailable extends RuntimeException {}
    class InvalidInput extends RuntimeException {
        private final List<String> fields;
        public InvalidInput(String... fields) { this.fields = List.of(fields); }
        public List<String> fields() { return fields; }
    }
}
