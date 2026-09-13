package com.reflejatuinterior.identity.application;

import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorInvitations.Account;
import com.reflejatuinterior.identity.CollaboratorInvitations.Invitation;
import com.reflejatuinterior.identity.CollaboratorInvitations.Page;
import com.reflejatuinterior.identity.CollaboratorInvitations.Person;
import com.reflejatuinterior.identity.CollaboratorInvitations.Participant;

public interface InvitationStore {
    record Attempt(Invitation invitation, UUID attemptId, boolean needsWelcome) {}
    void validateCandidate(Person person);
    Invitation create(UUID organizationId, UUID actorId, Account account, Person person);
    Invitation findOwned(String subject, UUID invitationId);
    Page listOwned(String subject, int page, int size);
    Invitation findInOrganization(UUID organizationId, UUID invitationId);
    Participant participant(UUID organizationId, UUID membershipId);
    Invitation accept(String subject, UUID invitationId);
    Attempt claim(UUID organizationId, UUID invitationId);
    boolean credentialsSent(UUID organizationId, UUID invitationId, UUID attemptId);
    Invitation finish(UUID organizationId, UUID invitationId, UUID attemptId, String messageId);
}
