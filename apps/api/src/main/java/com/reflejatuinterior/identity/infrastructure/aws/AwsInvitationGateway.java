package com.reflejatuinterior.identity.infrastructure.aws;

import java.util.List;
import java.util.Locale;
import com.reflejatuinterior.identity.CollaboratorInvitations.*;
import com.reflejatuinterior.identity.application.InvitationGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.*;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;

/** Native AWS clients; no credential generation, logging or persistence in the application. */
class AwsInvitationGateway implements InvitationGateway, AutoCloseable {
    private static final Logger LOGGER = LoggerFactory.getLogger(AwsInvitationGateway.class);
    private final CognitoIdentityProviderClient cognito;
    private final SesV2Client ses;
    private final InvitationAwsConfiguration.Settings settings;
    private final DefaultCredentialsProvider credentials;
    AwsInvitationGateway(CognitoIdentityProviderClient cognito, SesV2Client ses,
                         InvitationAwsConfiguration.Settings settings, DefaultCredentialsProvider credentials) {
        this.cognito = cognito; this.ses = ses; this.settings = settings; this.credentials = credentials;
    }

    @Override public Account provision(Person person) {
        try {
            try { return account(get(person.email()), person.email()); }
            catch (UserNotFoundException missing) {
                try {
                    var created = cognito.adminCreateUser(AdminCreateUserRequest.builder().userPoolId(settings.pool())
                            .username(person.email()).messageAction(MessageActionType.SUPPRESS)
                            .desiredDeliveryMediums(DeliveryMediumType.EMAIL).forceAliasCreation(false)
                            .userAttributes(attribute("email", person.email()), attribute("given_name", person.firstName()), attribute("family_name", person.lastName())).build());
                    var user = created.user();
                    if (user == null) throw new DeliveryUnavailable();
                    return account(user.username(), user.enabled(), user.userStatus(), user.attributes(), person.email());
                } catch (UsernameExistsException concurrent) {
                    // Another request may have provisioned the same email; never migrate its alias.
                    return account(get(person.email()), person.email());
                }
            }
        } catch (Conflict | DeliveryUnavailable exception) { throw exception; }
        catch (RuntimeException exception) { throw deliveryFailure("PROVISION", exception); }
    }

    @Override public void sendWelcomeIfRequired(Invitation invitation) {
        try {
            var user = get(invitation.cognitoUsername());
            var found = account(user, invitation.email());
            if (!found.subject().equals(invitation.cognitoSubject())) throw new Conflict();
            if (found.needsWelcome()) {
                cognito.adminCreateUser(AdminCreateUserRequest.builder().userPoolId(settings.pool())
                        // This pool uses email as its username attribute. Cognito returns an internal UUID
                        // from AdminGetUser, but AdminCreateUser RESEND expects the original email identifier.
                        .username(invitation.email()).messageAction(MessageActionType.RESEND)
                        .desiredDeliveryMediums(DeliveryMediumType.EMAIL).forceAliasCreation(false)
                        .userAttributes(attribute("email", invitation.email())).build());
            }
        } catch (Conflict exception) { throw exception; }
        catch (RuntimeException exception) { throw deliveryFailure("WELCOME", exception); }
    }

    @Override public String sendInvitation(Invitation invitation) {
        try {
            // This link grants nothing. The API lists/accepts only invitations matching the validated Access Token sub.
            String url = settings.webBase().replaceAll("/+$", "") + "/invitations";
            String text = "Tienes una invitación a Refleja Tu Interior.\n\n"
                    + "Rol de acceso: " + roleLabel(invitation.role()) + ".\n\n"
                    + "Inicia sesión con tu cuenta de Cognito y revisa tus invitaciones pendientes:\n" + url + "\n\n"
                    + "Vence el " + invitation.expiresAt() + " (UTC). La invitación no concede acceso hasta que la aceptes.\n"
                    + "Si tu cuenta es nueva, recibirás por separado las instrucciones de acceso administradas por Cognito.\n"
                    + "Si no esperabas esta invitación, no la aceptes.\n";
            var response = ses.sendEmail(SendEmailRequest.builder().fromEmailAddress(settings.sender())
                    .destination(Destination.builder().toAddresses(invitation.email()).build())
                    .content(EmailContent.builder().simple(Message.builder()
                            .subject(Content.builder().data("Invitación a Refleja Tu Interior").charset("UTF-8").build())
                            .body(Body.builder().text(Content.builder().data(text).charset("UTF-8").build()).build()).build()).build()).build());
            if (response.messageId() == null || response.messageId().isBlank()) throw new DeliveryUnavailable();
            return response.messageId();
        } catch (RuntimeException exception) { throw deliveryFailure("INVITATION", exception); }
    }

    private AdminGetUserResponse get(String username) {
        return cognito.adminGetUser(AdminGetUserRequest.builder().userPoolId(settings.pool()).username(username).build());
    }
    private Account account(AdminGetUserResponse user, String email) {
        return account(user.username(), user.enabled(), user.userStatus(), user.userAttributes(), email);
    }
    private Account account(String username, Boolean enabled, UserStatusType status, List<AttributeType> attributes, String email) {
        String actualEmail = value(attributes, "email"); String sub = value(attributes, "sub");
        if (!Boolean.TRUE.equals(enabled) || sub == null || sub.isBlank() || username == null || username.isBlank()
                || actualEmail == null || !actualEmail.strip().toLowerCase(Locale.ROOT).equals(email)
                || (status != UserStatusType.CONFIRMED && status != UserStatusType.FORCE_CHANGE_PASSWORD)) throw new Conflict();
        return new Account(sub, username, status == UserStatusType.FORCE_CHANGE_PASSWORD);
    }
    private static AttributeType attribute(String name, String value) { return AttributeType.builder().name(name).value(value).build(); }
    private static String roleLabel(InvitedRole role) {
        return role == InvitedRole.COMPANY_ADMIN ? "RRHH" : role == InvitedRole.LEADER ? "Líder" : "Colaborador";
    }
    private static String value(List<AttributeType> attributes, String name) {
        return attributes.stream().filter(a -> name.equals(a.name())).map(AttributeType::value).findFirst().orElse(null);
    }
    private static DeliveryUnavailable deliveryFailure(String operation, RuntimeException exception) {
        if (exception instanceof AwsServiceException awsException) {
            var details = awsException.awsErrorDetails();
            LOGGER.warn("action=INVITATION_PROVIDER_FAILURE operation={} provider={} status={} errorCode={} requestId={}",
                    operation, details == null ? "unknown" : details.serviceName(), awsException.statusCode(),
                    details == null ? "unknown" : details.errorCode(), awsException.requestId());
        } else {
            LOGGER.warn("action=INVITATION_PROVIDER_FAILURE operation={} errorType={}",
                    operation, exception.getClass().getSimpleName());
        }
        return new DeliveryUnavailable();
    }
    @Override public void close() { cognito.close(); ses.close(); if (credentials != null) credentials.close(); }
}
