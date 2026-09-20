package com.reflejatuinterior.identity.application;

import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.reflejatuinterior.identity.domain.AuthenticatedPrincipal;
import com.reflejatuinterior.identity.domain.AuthenticatedPrincipal.OrganizationAccess;
import com.reflejatuinterior.identity.domain.AuthenticatedPrincipal.UserIdentity;
import com.reflejatuinterior.organization.OrganizationDirectory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityContextService {
    private final IdentityContextReader identities;
    private final OrganizationDirectory organizations;

    public IdentityContextService(IdentityContextReader identities, OrganizationDirectory organizations) {
        this.identities = identities;
        this.organizations = organizations;
    }

    /** Called for each /me request after Spring Security has validated the JWT. No authorization cache. */
    @Transactional(readOnly = true)
    public AuthenticatedPrincipal resolve(String cognitoSubject, UUID requestedOrganizationId) {
        var user = identities.findUserByCognitoSubject(cognitoSubject)
                .filter(candidate -> "ACTIVE".equals(candidate.status()))
                .orElseThrow(IdentityAccessDeniedException::new);
        var activeMemberships = identities.findMembershipsByUserId(user.id()).stream()
                .filter(membership -> "ACTIVE".equals(membership.status()))
                .collect(Collectors.toMap(IdentityContextReader.MembershipData::organizationId, Function.identity()));
        var available = organizations.findSummaries(activeMemberships.keySet()).stream()
                .filter(organization -> "ACTIVE".equals(organization.status()))
                .map(organization -> new OrganizationAccess(organization.id(), organization.name(),
                        activeMemberships.get(organization.id()).roles(),
                        activeMemberships.get(organization.id()).profileStatus()))
                .toList();

        UUID selected = requestedOrganizationId;
        if (selected != null && available.stream().noneMatch(org -> org.id().equals(requestedOrganizationId))) {
            throw new OrganizationUnavailableException();
        }
        if (selected == null && available.size() == 1) {
            selected = available.getFirst().id();
        }
        return new AuthenticatedPrincipal(new UserIdentity(
                user.id(), user.cognitoSubject(), user.email(), user.firstName(), user.lastName()),
                available, selected);
    }
}
