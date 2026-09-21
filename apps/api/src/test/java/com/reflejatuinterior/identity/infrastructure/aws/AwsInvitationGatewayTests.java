package com.reflejatuinterior.identity.infrastructure.aws;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.UUID;

import com.reflejatuinterior.identity.CollaboratorInvitations.Invitation;
import com.reflejatuinterior.identity.CollaboratorInvitations.InvitedRole;
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
        assertThat(message.subject().data()).isEqualTo("Bienvenido(a) a tu espacio en Refleja Tu Interior");
        assertThat(message.body().text().data())
                .contains("Hola, Collab & <Orator>:")
                .contains("¡Te damos la bienvenida a Refleja Tu Interior!")
                .contains("[CREAR MI USUARIO]\nhttp://localhost:3000/invitations")
                .contains("20 de septiembre de 2026")
                .contains("Equipo Refleja Tu Interior")
                .doesNotContain("secret-cognito-subject", "secret-cognito-username");
        assertThat(message.body().html().data())
                .contains("Hola, <strong>Collab &amp; &lt;Orator&gt;</strong>")
                .contains("href=\"http://localhost:3000/invitations\"")
                .contains(">CREAR MI USUARIO</a>")
                .contains("20 de septiembre de 2026")
                .doesNotContain("secret-cognito-subject", "secret-cognito-username");
    }

    private static AttributeType attribute(String name, String value) {
        return AttributeType.builder().name(name).value(value).build();
    }
}
