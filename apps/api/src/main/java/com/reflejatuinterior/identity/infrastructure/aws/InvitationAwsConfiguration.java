package com.reflejatuinterior.identity.infrastructure.aws;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import com.reflejatuinterior.identity.CollaboratorInvitations.*;
import com.reflejatuinterior.identity.application.InvitationGateway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.retries.StandardRetryStrategy;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.sesv2.SesV2Client;

@Configuration(proxyBeanMethods = false)
class InvitationAwsConfiguration {
    @Bean Clock rtiInvitationClock() { return Clock.systemUTC(); }

    @Bean InvitationGateway invitationGateway(
            @Value("${app.invitations.enabled:false}") boolean enabled,
            @Value("${app.invitations.aws-region:}") String region,
            @Value("${app.invitations.user-pool-id:}") String pool,
            @Value("${app.invitations.ses-from:}") String sender,
            @Value("${app.invitations.web-base-url:}") String webBase,
            @Value("${app.security.cognito.issuer-uri:}") String issuer) {
        var settings = new Settings(region, pool, sender, webBase);
        if (!enabled || !settings.valid() || !issuer.equals("https://cognito-idp." + region + ".amazonaws.com/" + pool)) {
            return new DisabledGateway();
        }
        var credentials = DefaultCredentialsProvider.builder().build();
        var overrides = ClientOverrideConfiguration.builder().apiCallTimeout(Duration.ofSeconds(30))
                .apiCallAttemptTimeout(Duration.ofSeconds(10))
                // These APIs have external side effects. Retries are explicit at the workflow boundary.
                .retryStrategy(StandardRetryStrategy.builder().maxAttempts(1).build()).build();
        var cognito = CognitoIdentityProviderClient.builder().region(Region.of(region)).credentialsProvider(credentials)
                .overrideConfiguration(overrides).httpClientBuilder(UrlConnectionHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(5)).socketTimeout(Duration.ofSeconds(10))).build();
        var ses = SesV2Client.builder().region(Region.of(region)).credentialsProvider(credentials)
                .overrideConfiguration(overrides).httpClientBuilder(UrlConnectionHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(5)).socketTimeout(Duration.ofSeconds(10))).build();
        return new AwsInvitationGateway(cognito, ses, settings, credentials);
    }

    record Settings(String region, String pool, String sender, String webBase) {
        boolean valid() {
            try {
                URI uri = URI.create(webBase);
                return !region.isBlank() && pool.startsWith(region + "_") && sender.length() <= 254
                        && sender.matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+")
                        && uri.getHost() != null && uri.getUserInfo() == null && uri.getQuery() == null && uri.getFragment() == null
                        && ("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) && "localhost".equals(uri.getHost())))
                        && (uri.getPath().isEmpty() || "/".equals(uri.getPath()));
            } catch (IllegalArgumentException exception) { return false; }
        }
    }
    private static class DisabledGateway implements InvitationGateway {
        @Override public Account provision(Person person) { throw new DeliveryUnavailable(); }
        @Override public void sendWelcomeIfRequired(Invitation invitation) { throw new DeliveryUnavailable(); }
        @Override public String sendInvitation(Invitation invitation) { throw new DeliveryUnavailable(); }
    }
}
