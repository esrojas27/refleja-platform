package com.reflejatuinterior.identity.api;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.reflejatuinterior.identity.domain.AuthenticatedPrincipal;

public record MeResponse(String cognitoSubject, UserResponse user,
                         List<OrganizationResponse> organizations, UUID activeOrganizationId, Set<String> roles) {
    static MeResponse from(AuthenticatedPrincipal principal) {
        var user = principal.user();
        return new MeResponse(principal.cognitoSubject(),
                new UserResponse(user.id(), user.email(), user.firstName(), user.lastName()),
                principal.organizations().stream().map(org ->
                        new OrganizationResponse(org.id(), org.name(), org.roles())).toList(),
                principal.activeOrganizationId(), principal.roles());
    }

    public record UserResponse(UUID id, String email, String firstName, String lastName) {
    }

    public record OrganizationResponse(UUID id, String name, Set<String> roles) {
    }
}
