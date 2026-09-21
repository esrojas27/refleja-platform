package com.reflejatuinterior.identity.infrastructure.aws;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
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
    private static final DateTimeFormatter INVITATION_DATE = DateTimeFormatter
            .ofPattern("d 'de' MMMM 'de' uuuu", Locale.forLanguageTag("es-CO"))
            .withZone(ZoneOffset.UTC);
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
            boolean collaborator = invitation.role() == InvitedRole.COLLABORATOR;
            String text = collaborator ? invitationText(invitation, url) : accessInvitationText(invitation, url);
            var body = Body.builder().text(Content.builder().data(text).charset("UTF-8").build());
            if (collaborator) {
                body.html(Content.builder().data(invitationHtml(invitation, url)).charset("UTF-8").build());
            }
            var response = ses.sendEmail(SendEmailRequest.builder().fromEmailAddress(settings.sender())
                    .destination(Destination.builder().toAddresses(invitation.email()).build())
                    .content(EmailContent.builder().simple(Message.builder()
                            .subject(Content.builder().data(collaborator
                                    ? "Bienvenido(a) a tu espacio en Refleja Tu Interior"
                                    : "Invitación a Refleja Tu Interior").charset("UTF-8").build())
                            .body(body.build()).build()).build()).build());
            if (response.messageId() == null || response.messageId().isBlank()) throw new DeliveryUnavailable();
            return response.messageId();
        } catch (RuntimeException exception) { throw deliveryFailure("INVITATION", exception); }
    }

    private static String invitationText(Invitation invitation, String url) {
        return """
                Hola, %s:

                ¡Te damos la bienvenida a Refleja Tu Interior!

                Hemos creado un espacio personal para acompañarte durante todo este proceso. En tu dashboard podrás:

                - Consultar el avance de tu proceso.
                - Acceder a las sesiones y actividades asignadas.
                - Compartir tus reflexiones y comentarios.
                - Recibir retroalimentación sobre las actividades realizadas.
                - Revisar tus aprendizajes y la evolución alcanzada durante la consultoría.

                De esta manera, el acompañamiento no estará presente únicamente en las sesiones con Paula. También contarás con un espacio digital que te permitirá dar continuidad al proceso, hacer una mirada retrospectiva de lo vivido y reconocer los avances que vayas alcanzando.

                Para comenzar, haz clic en el siguiente enlace:

                [CREAR MI USUARIO]
                %s

                Una vez ingreses, crea tu usuario y completa los datos solicitados en tu perfil. Esto nos permitirá conocerte mejor y brindarte una experiencia más cercana y personalizada.

                Te invitamos a completar tu registro antes del %s.

                Nos alegra acompañarte en este camino de autoconocimiento, crecimiento y fortalecimiento de tu marca personal.

                Cordial saludo,

                Equipo Refleja Tu Interior
                Tu historia, tu mayor diferencial
                """.formatted(invitationName(invitation), url, invitationDate(invitation));
    }

    private static String accessInvitationText(Invitation invitation, String url) {
        return "Tienes una invitación a Refleja Tu Interior.\n\n"
                + "Rol de acceso: " + roleLabel(invitation.role()) + ".\n\n"
                + "Inicia sesión con tu cuenta de Cognito y revisa tus invitaciones pendientes:\n" + url + "\n\n"
                + "Vence el " + invitation.expiresAt() + " (UTC). La invitación no concede acceso hasta que la aceptes.\n"
                + "Si tu cuenta es nueva, recibirás por separado las instrucciones de acceso administradas por Cognito.\n"
                + "Si no esperabas esta invitación, no la aceptes.\n";
    }

    private static String invitationHtml(Invitation invitation, String url) {
        String name = escapeHtml(invitationName(invitation));
        String safeUrl = escapeHtml(url);
        String date = escapeHtml(invitationDate(invitation));
        return """
                <!doctype html>
                <html lang="es">
                  <body style="margin:0;background:#f7f2ee;color:#2b1b19;font-family:Arial,sans-serif;">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f7f2ee;padding:32px 16px;">
                      <tr><td align="center">
                        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdfa;border:1px solid #ead8cd;border-radius:24px;overflow:hidden;">
                          <tr><td style="padding:40px 44px;line-height:1.6;">
                            <p style="margin:0 0 24px;font-size:18px;">Hola, <strong>%s</strong>:</p>
                            <h1 style="margin:0 0 24px;color:#922f3b;font-size:28px;line-height:1.25;">¡Te damos la bienvenida a Refleja Tu Interior!</h1>
                            <p>Hemos creado un espacio personal para acompañarte durante todo este proceso. En tu dashboard podrás:</p>
                            <ul style="padding-left:22px;">
                              <li>Consultar el avance de tu proceso.</li>
                              <li>Acceder a las sesiones y actividades asignadas.</li>
                              <li>Compartir tus reflexiones y comentarios.</li>
                              <li>Recibir retroalimentación sobre las actividades realizadas.</li>
                              <li>Revisar tus aprendizajes y la evolución alcanzada durante la consultoría.</li>
                            </ul>
                            <p>De esta manera, el acompañamiento no estará presente únicamente en las sesiones con Paula. También contarás con un espacio digital que te permitirá dar continuidad al proceso, hacer una mirada retrospectiva de lo vivido y reconocer los avances que vayas alcanzando.</p>
                            <p style="margin-top:28px;">Para comenzar, haz clic en el siguiente enlace:</p>
                            <p style="margin:24px 0;text-align:center;"><a href="%s" style="display:inline-block;border-radius:999px;background:#922f3b;color:#ffffff;padding:14px 28px;font-weight:bold;text-decoration:none;">CREAR MI USUARIO</a></p>
                            <p>Una vez ingreses, crea tu usuario y completa los datos solicitados en tu perfil. Esto nos permitirá conocerte mejor y brindarte una experiencia más cercana y personalizada.</p>
                            <p>Te invitamos a completar tu registro antes del <strong>%s</strong>.</p>
                            <p>Nos alegra acompañarte en este camino de autoconocimiento, crecimiento y fortalecimiento de tu marca personal.</p>
                            <p style="margin:28px 0 0;">Cordial saludo,</p>
                            <p style="margin:8px 0 0;"><strong>Equipo Refleja Tu Interior</strong><br>Tu historia, tu mayor diferencial</p>
                          </td></tr>
                        </table>
                      </td></tr>
                    </table>
                  </body>
                </html>
                """.formatted(name, safeUrl, date);
    }

    private static String invitationName(Invitation invitation) {
        return (invitation.firstName() + " " + invitation.lastName()).strip();
    }

    private static String invitationDate(Invitation invitation) {
        return INVITATION_DATE.format(invitation.expiresAt());
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
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
