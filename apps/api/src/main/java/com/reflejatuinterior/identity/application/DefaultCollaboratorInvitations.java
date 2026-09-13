package com.reflejatuinterior.identity.application;

import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
class DefaultCollaboratorInvitations implements CollaboratorInvitations {
    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\\.[A-Za-z]{2,}");
    private final InvitationGateway gateway;
    private final InvitationStore store;
    DefaultCollaboratorInvitations(InvitationGateway gateway, InvitationStore store) { this.gateway = gateway; this.store = store; }

    @Override
    @Transactional(propagation = Propagation.NEVER)
    public Account provision(Person person) {
        var validated = validate(person);
        store.validateCandidate(validated);
        return gateway.provision(validated);
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public Invitation create(UUID organizationId, UUID actorId, Account account, Person person) {
        return store.create(organizationId, actorId, account, validate(person));
    }
    @Override public Invitation findOwned(String subject, UUID invitationId) { return store.findOwned(subject, invitationId); }
    @Override public Page listOwned(String subject, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw new InvalidInput("page", "size");
        return store.listOwned(subject, page, size);
    }
    @Override public Invitation findInOrganization(UUID organizationId, UUID invitationId) { return store.findInOrganization(organizationId, invitationId); }
    @Override public Participant participant(UUID organizationId, UUID membershipId) { return store.participant(organizationId, membershipId); }
    @Override @Transactional(propagation = Propagation.MANDATORY)
    public Invitation accept(String subject, UUID invitationId) { return store.accept(subject, invitationId); }

    @Override @Transactional(propagation = Propagation.NEVER)
    public Invitation dispatch(UUID organizationId, UUID invitationId) {
        var attempt = store.claim(organizationId, invitationId);
        if (attempt.attemptId() == null) return attempt.invitation();
        try {
            if (attempt.needsWelcome()) {
                gateway.sendWelcomeIfRequired(attempt.invitation());
                if (!store.credentialsSent(organizationId, invitationId, attempt.attemptId())) {
                    return store.findInOrganization(organizationId, invitationId);
                }
            }
            var messageId = gateway.sendInvitation(attempt.invitation());
            return store.finish(organizationId, invitationId, attempt.attemptId(), messageId);
        } catch (RuntimeException exception) {
            // The enrollment already committed. Preserve it and report recoverable delivery state.
            return store.finish(organizationId, invitationId, attempt.attemptId(), null);
        }
    }

    static Person validate(Person person) {
        if (person == null || person.email() == null) throw new InvalidInput("email");
        String email = person.email().strip().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !EMAIL.matcher(email).matches() || email.contains("..")) throw new InvalidInput("email");
        return new Person(email, name(person.firstName(), "firstName"), name(person.lastName(), "lastName"));
    }
    private static String name(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 100 || value.codePoints().anyMatch(Character::isISOControl)) throw new InvalidInput(field);
        return value.strip();
    }
}
