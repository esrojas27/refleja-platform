package com.reflejatuinterior.identity.infrastructure.aws;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.UUID;

import com.reflejatuinterior.identity.CollaboratorInvitations.Invitation;
import com.reflejatuinterior.identity.CollaboratorInvitations.InvitedRole;
import com.reflejatuinterior.identity.CollaboratorInvitations.DeliveryUnavailable;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminCreateUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminCreateUserResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminGetUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminGetUserResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.DeliveryMediumType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.MessageActionType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserStatusType;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import software.amazon.awssdk.services.sesv2.model.SendEmailResponse;

class AwsInvitationGatewayTests {
    @Test
    void resendIncludesEmailRequiredByCognitoDeliveryMedium() {
        var cognito = mock(CognitoIdentityProviderClient.class);
        var ses = mock(SesV2Client.class);
        when(cognito.adminGetUser(any(AdminGetUserRequest.class))).thenReturn(AdminGetUserResponse.builder()
                .username("cognito-username").enabled(true).userStatus(UserStatusType.FORCE_CHANGE_PASSWORD)
                .userAttributes(attribute("sub", "cognito-subject"), attribute("email", "collaborator@example.test"))
                .build());
        when(cognito.adminCreateUser(any(AdminCreateUserRequest.class)))
                .thenReturn(AdminCreateUserResponse.builder().build());
        var gateway = new AwsInvitationGateway(cognito, ses,
                new InvitationAwsConfiguration.Settings("us-east-1", "us-east-1_pool",
                        "sender@example.test", "http://localhost:3000"), null);
        var invitation = new Invitation(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), InvitedRole.COLLABORATOR,
                "cognito-subject", "cognito-username", "collaborator@example.test", "Collab", "Orator",
                "PENDING", Instant.parse("2026-09-20T00:00:00Z"), "FAILED");

        gateway.sendWelcomeIfRequired(invitation);

        var request = ArgumentCaptor.forClass(AdminCreateUserRequest.class);
        verify(cognito).adminCreateUser(request.capture());
        assertThat(request.getValue().username()).isEqualTo("collaborator@example.test");
        assertThat(request.getValue().messageAction()).isEqualTo(MessageActionType.RESEND);
        assertThat(request.getValue().desiredDeliveryMediums()).containsExactly(DeliveryMediumType.EMAIL);
        assertThat(request.getValue().userAttributes())
                .anySatisfy(value -> {
                    assertThat(value.name()).isEqualTo("email");
                    assertThat(value.value()).isEqualTo("collaborator@example.test");
                });
    }

    @Test
    void invitationUsesThePersonalizedWelcomeTemplateInTextAndHtml() {
        var cognito = mock(CognitoIdentityProviderClient.class);
        var ses = mock(SesV2Client.class);
        when(ses.sendEmail(any(SendEmailRequest.class)))
                .thenReturn(SendEmailResponse.builder().messageId("ses-message-id").build());
        var gateway = new AwsInvitationGateway(cognito, ses,
                new InvitationAwsConfiguration.Settings("us-east-1", "us-east-1_pool",
                        "sender@example.test", "http://localhost:3000/"), null);
        var invitation = new Invitation(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                InvitedRole.COLLABORATOR, "secret-cognito-subject", "secret-cognito-username",
                "collaborator@example.test", "Collab &", "<Orator>", "PENDING",
                Instant.parse("2026-09-20T00:00:00Z"), "PENDING");

        assertThat(gateway.sendInvitation(invitation)).isEqualTo("ses-message-id");

        var request = ArgumentCaptor.forClass(SendEmailRequest.class);
        verify(ses).sendEmail(request.capture());
        var message = request.getValue().content().simple();
        assertThat(message.subject().data()).isEqualTo("Tu espacio en Refleja Tu Interior ya está disponible");
        assertThat(request.getValue().fromEmailAddress()).isEqualTo("sender@example.test");
        assertThat(request.getValue().destination().toAddresses()).containsExactly("collaborator@example.test");
        assertThat(message.attachments()).isEmpty();
        assertThat(message.body().text().data())
                .contains("Hola, Collab & <Orator>:")
                .contains("¡Tu espacio en Refleja Tu Interior ya está disponible!")
                .contains("programa Coach Ejecutivo")
                .contains("[VER GUÍA DEL COLABORADOR]\n" + CollaboratorWelcomeEmail.GUIDE_URL)
                .contains("[CREAR MI USUARIO]\nhttp://localhost:3000/invitations")
                .contains("30 de octubre de 2026")
                .contains("Utiliza el mismo correo electrónico en el que recibiste esta invitación")
                .contains("marcayconexion@paularojas.com.co")
                .contains("Equipo Refleja Tu Interior")
                .contains("Tu historia, tu mayor diferencial.")
                .doesNotContain("secret-cognito-subject", "secret-cognito-username", "adjunta", "20 de septiembre de 2026");
        assertThat(message.body().html().data())
                .contains("Hola, <strong>Collab &amp; &lt;Orator&gt;</strong>")
                .contains("href=\"" + CollaboratorWelcomeEmail.GUIDE_URL + "\" target=\"_blank\" rel=\"noopener noreferrer\"")
                .contains(">VER GUÍA DEL COLABORADOR</a>")
                .contains("href=\"http://localhost:3000/invitations\"")
                .contains(">CREAR MI USUARIO</a>")
                .contains("30 de octubre de 2026")
                .contains("href=\"mailto:marcayconexion@paularojas.com.co\"")
                .contains("#111111", "#f5e7ed", "#e8b8ca", "#444144")
                .doesNotContain("secret-cognito-subject", "secret-cognito-username", "adjunta", "#922f3b", "<Orator>");
    }

    @Test
    void welcomeKeepsTheAccessUrlBoundToTheConfiguredEnvironment() {
        for (String base : new String[]{"http://localhost:3000", "https://rti-dev.18-210-172-252.nip.io/", "https://plataforma.example.test"}) {
            var ses = mock(SesV2Client.class);
            when(ses.sendEmail(any(SendEmailRequest.class))).thenReturn(SendEmailResponse.builder().messageId("sent").build());
            var gateway = new AwsInvitationGateway(mock(CognitoIdentityProviderClient.class), ses,
                    new InvitationAwsConfiguration.Settings("us-east-1", "us-east-1_pool", "sender@example.test", base), null);
            gateway.sendInvitation(invitation(InvitedRole.COLLABORATOR));
            var request = ArgumentCaptor.forClass(SendEmailRequest.class);
            verify(ses).sendEmail(request.capture());
            String target = base.replaceAll("/+$", "") + "/invitations";
            assertThat(request.getValue().content().simple().body().text().data()).contains("[CREAR MI USUARIO]\n" + target);
            assertThat(request.getValue().content().simple().body().html().data()).contains("href=\"" + target + "\"");
        }
    }

    @Test
    void leaderAndHrKeepTheirAccessInvitationWithoutTheCollaboratorPilotGuide() {
        for (var role : new InvitedRole[]{InvitedRole.LEADER, InvitedRole.COMPANY_ADMIN}) {
            var ses = mock(SesV2Client.class);
            when(ses.sendEmail(any(SendEmailRequest.class))).thenReturn(SendEmailResponse.builder().messageId("sent").build());
            var gateway = new AwsInvitationGateway(mock(CognitoIdentityProviderClient.class), ses,
                    new InvitationAwsConfiguration.Settings("us-east-1", "us-east-1_pool", "sender@example.test", "https://app.example.test"), null);
            gateway.sendInvitation(invitation(role));
            var request = ArgumentCaptor.forClass(SendEmailRequest.class);
            verify(ses).sendEmail(request.capture());
            var message = request.getValue().content().simple();
            assertThat(message.subject().data()).isEqualTo("Invitación a Refleja Tu Interior");
            assertThat(message.body().html()).isNull();
            assertThat(message.body().text().data()).contains(role == InvitedRole.LEADER ? "Líder" : "RRHH")
                    .contains("https://app.example.test/invitations", "2026-11-02T12:00:00Z")
                    .doesNotContain(CollaboratorWelcomeEmail.GUIDE_URL, "Coach Ejecutivo", "30 de octubre");
        }
    }

    @Test
    void welcomeEscapesAllPersonalizedHtmlAndContainsTheApprovedBenefits() {
        var html = CollaboratorWelcomeEmail.html("Ana <script>alert('x')</script> & \"Equipo\"", "https://app.example.test/invitations");
        assertThat(html).contains("Ana &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;Equipo&quot;")
                .doesNotContain("<script>");
        String text = CollaboratorWelcomeEmail.text("Ana Martínez", "https://app.example.test/invitations");
        for (String benefit : new String[]{"Consultar tu progreso.", "Acceder a las sesiones y actividades asignadas.",
                "Compartir tus reflexiones y comentarios.", "Recibir retroalimentación de tu consultor.",
                "Reconocer tus aprendizajes y avances durante el proceso."}) {
            assertThat(text).contains(benefit);
            assertThat(html).contains(benefit);
        }
    }

    @Test
    void missingProviderMessageIdIsNotReportedAsSuccessfulDelivery() {
        var ses = mock(SesV2Client.class);
        when(ses.sendEmail(any(SendEmailRequest.class))).thenReturn(SendEmailResponse.builder().build());
        var gateway = new AwsInvitationGateway(mock(CognitoIdentityProviderClient.class), ses,
                new InvitationAwsConfiguration.Settings("us-east-1", "us-east-1_pool", "sender@example.test", "https://app.example.test"), null);
        assertThatThrownBy(() -> gateway.sendInvitation(invitation(InvitedRole.COLLABORATOR))).isInstanceOf(DeliveryUnavailable.class);
    }

    private static Invitation invitation(InvitedRole role) {
        return new Invitation(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), role,
                "subject-not-in-email", "username-not-in-email", "collaborator@example.test", "Ana", "Martínez", "PENDING",
                Instant.parse("2026-11-02T12:00:00Z"), "PENDING");
    }

    private static AttributeType attribute(String name, String value) {
        return AttributeType.builder().name(name).value(value).build();
    }
}
