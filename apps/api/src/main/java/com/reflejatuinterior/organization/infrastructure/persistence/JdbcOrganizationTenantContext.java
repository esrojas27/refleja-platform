package com.reflejatuinterior.organization.infrastructure.persistence;

import java.util.Objects;
import java.util.UUID;

import com.reflejatuinterior.organization.OrganizationTenantContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
class JdbcOrganizationTenantContext implements OrganizationTenantContext {
    private final JdbcTemplate jdbc;

    JdbcOrganizationTenantContext(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void activate(UUID organizationId) {
        Objects.requireNonNull(organizationId, "organizationId");
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Tenant context requires an active transaction");
        }
        jdbc.queryForObject(
                "select set_config('app.current_organization_id', ?, true)",
                String.class,
                organizationId.toString());
    }
}
