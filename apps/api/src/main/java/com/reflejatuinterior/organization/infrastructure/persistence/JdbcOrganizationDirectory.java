package com.reflejatuinterior.organization.infrastructure.persistence;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.reflejatuinterior.organization.OrganizationDirectory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcOrganizationDirectory implements OrganizationDirectory {
    private final JdbcTemplate jdbcTemplate;

    JdbcOrganizationDirectory(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<OrganizationSummary> findSummaries(Set<UUID> organizationIds) {
        if (organizationIds.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", Collections.nCopies(organizationIds.size(), "?"));
        return jdbcTemplate.query(
                "select id, name, status from rti.organizations where id in ("
                        + placeholders + ") order by name, id",
                (rs, row) -> new OrganizationSummary(
                        rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("status")),
                organizationIds.toArray());
    }
}
