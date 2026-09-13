package com.reflejatuinterior.identity.application;

import java.util.function.Function;
import java.util.stream.Collectors;

import com.reflejatuinterior.identity.CollaboratorAccess;
import com.reflejatuinterior.organization.OrganizationDirectory;
import org.springframework.stereotype.Service;

@Service
class ResolveCollaboratorAccess implements CollaboratorAccess {
    private final IdentityContextReader identities;
    private final OrganizationDirectory organizations;

    ResolveCollaboratorAccess(IdentityContextReader identities, OrganizationDirectory organizations) {
        this.identities = identities;
        this.organizations = organizations;
    }

    @Override
    public Context resolve(String subject) {
        var user = identities.findUserByCognitoSubject(subject)
                .filter(candidate -> "ACTIVE".equals(candidate.status()))
                .orElseThrow(Denied::new);
        var memberships = identities.findMembershipsByUserId(user.id()).stream()
                .filter(membership -> "ACTIVE".equals(membership.status()))
                .filter(membership -> membership.roles().contains("COLLABORATOR"))
                .toList();
        var organizationsById = organizations.findSummaries(memberships.stream()
                        .map(IdentityContextReader.MembershipData::organizationId).collect(Collectors.toSet())).stream()
                .filter(organization -> "ACTIVE".equals(organization.status()))
                .collect(Collectors.toMap(OrganizationDirectory.OrganizationSummary::id, Function.identity()));
        var available = memberships.stream()
                .filter(membership -> organizationsById.containsKey(membership.organizationId()))
                .map(membership -> new Membership(membership.id(), membership.organizationId(),
                        organizationsById.get(membership.organizationId()).name()))
                .toList();
        if (available.isEmpty()) {
            throw new Denied();
        }
        return new Context(user.id(), available);
    }
}
