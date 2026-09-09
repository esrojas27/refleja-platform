package com.reflejatuinterior.organization.infrastructure.persistence;

import com.reflejatuinterior.organization.OrganizationRegistration;
import com.reflejatuinterior.organization.domain.NewOrganization;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
class JpaOrganizationRegistration implements OrganizationRegistration {
    private final OrganizationJpaRepository organizations;

    JpaOrganizationRegistration(OrganizationJpaRepository organizations) { this.organizations = organizations; }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public RegisteredOrganization create(String name, String defaultTimeZone) {
        var draft = new NewOrganization(name, defaultTimeZone);
        var entity = organizations.saveAndFlush(new OrganizationJpaEntity(draft.name(), null,
                OrganizationStatus.valueOf(draft.initialStatus()), null, draft.defaultTimeZone()));
        return new RegisteredOrganization(entity.id(), draft.name(), entity.status().name(),
                entity.defaultTimeZone(), entity.version());
    }
}
