package com.reflejatuinterior.identity.application;

import com.reflejatuinterior.identity.CollaboratorInvitations.Account;
import com.reflejatuinterior.identity.CollaboratorInvitations.Invitation;
import com.reflejatuinterior.identity.CollaboratorInvitations.Person;

/** External Cognito/SES boundary; no passwords or bearer tokens cross this interface. */
public interface InvitationGateway {
    Account provision(Person person);
    void sendWelcomeIfRequired(Invitation invitation);
    String sendInvitation(Invitation invitation);
}
