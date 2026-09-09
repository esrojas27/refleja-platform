package com.reflejatuinterior.identity.application;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import com.reflejatuinterior.identity.domain.AuthenticatedPrincipal;
import org.junit.jupiter.api.Test;

class OrganizationCreationPolicyTest {
    private final UUID operator = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();

    private AuthenticatedPrincipal principal(UUID membershipOrg, String role) {
        return new AuthenticatedPrincipal(new AuthenticatedPrincipal.UserIdentity(UUID.randomUUID(), "test-sub", "test@example.test", null, null),
                List.of(new AuthenticatedPrincipal.OrganizationAccess(membershipOrg, "Refleja Tu Interior", Set.of(role))), membershipOrg);
    }

    @Test void onlyConsultantsInTheConfiguredOrganizationAreAllowed() {
        var policy = new OrganizationCreationPolicy(operator.toString());
        assertThat(policy.allows(principal(operator, "CONSULTANT"))).isTrue();
        for (String role : List.of("COMPANY_ADMIN", "LEADER", "COLLABORATOR", "SUPER_ADMIN")) {
            assertThat(policy.allows(principal(operator, role))).isFalse();
        }
        assertThat(policy.allows(principal(other, "CONSULTANT"))).isFalse();
        assertThatThrownBy(() -> policy.authorize(principal(other, "CONSULTANT"))).isInstanceOf(IdentityAccessDeniedException.class);
    }

    @Test void missingConfigurationDeniesAndMalformedConfigurationFails() {
        assertThat(new OrganizationCreationPolicy("").allows(principal(operator, "CONSULTANT"))).isFalse();
        assertThatThrownBy(() -> new OrganizationCreationPolicy("not-a-uuid")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void creationCapabilityDoesNotChangeSelectedTenantRoles() {
        var principal = new AuthenticatedPrincipal(principal(operator, "CONSULTANT").user(),
                List.of(new AuthenticatedPrincipal.OrganizationAccess(operator, "Operator", Set.of("CONSULTANT")),
                        new AuthenticatedPrincipal.OrganizationAccess(other, "Other", Set.of("COLLABORATOR"))), other);
        assertThat(new OrganizationCreationPolicy(operator.toString()).allows(principal)).isTrue();
        assertThat(principal.roles()).containsExactly("COLLABORATOR");
        assertThat(principal.hasRole(other, "CONSULTANT")).isFalse();
    }
}
