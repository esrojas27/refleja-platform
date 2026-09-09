package com.reflejatuinterior.identity.application;

import java.time.Instant;
import com.reflejatuinterior.organization.OrganizationRegistration;
import com.reflejatuinterior.organization.OrganizationRegistration.RegisteredOrganization;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class CreateOrganization {
    private static final Logger audit = LoggerFactory.getLogger(CreateOrganization.class);
    private final IdentityContextService contexts;
    private final OrganizationCreationPolicy policy;
    private final OrganizationRegistration organizations;
    private final CreatorMemberships memberships;

    public CreateOrganization(IdentityContextService contexts, OrganizationCreationPolicy policy,
                              OrganizationRegistration organizations, CreatorMemberships memberships) {
        this.contexts = contexts;
        this.policy = policy;
        this.organizations = organizations;
        this.memberships = memberships;
    }

    /** Identity coordinates membership creation using the Organization public API; no cyclic module dependency. */
    @Transactional
    public RegisteredOrganization execute(String subject, String name, String timeZone, String requestId) {
        var principal = contexts.resolve(subject, null);
        if (!policy.allows(principal)) {
            audit.warn("action=AUTHORIZATION_DENIED operation=CREATE_ORGANIZATION actor={} requestId={} timestamp={} result=DENIED",
                    principal.userId(), requestId, Instant.now());
            policy.authorize(principal);
        }
        var created = organizations.create(name, timeZone);
        memberships.addConsultant(created.id(), principal.userId());
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                audit.info("action=ORGANIZATION_CREATED actor={} organization={} resource=Organization resourceId={} role=CONSULTANT requestId={} timestamp={} result=SUCCESS",
                        principal.userId(), created.id(), created.id(), requestId, Instant.now());
            }
        });
        return created;
    }
}
