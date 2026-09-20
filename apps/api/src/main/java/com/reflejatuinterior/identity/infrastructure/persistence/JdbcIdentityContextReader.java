package com.reflejatuinterior.identity.infrastructure.persistence;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.reflejatuinterior.identity.application.IdentityContextReader;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Actor-scoped read projections permitted by ADR-004; no cross-module SQL joins. */
@Repository
class JdbcIdentityContextReader implements IdentityContextReader {
    private final JdbcTemplate jdbcTemplate;

    JdbcIdentityContextReader(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<UserData> findUserByCognitoSubject(String cognitoSubject) {
        return jdbcTemplate.query("""
                select id, cognito_subject, email, first_name, last_name, status
                from rti.users where cognito_subject = ?
                """, (rs, row) -> new UserData(
                        rs.getObject("id", UUID.class), rs.getString("cognito_subject"),
                        rs.getString("email"), rs.getString("first_name"),
                        rs.getString("last_name"), rs.getString("status")), cognitoSubject)
                .stream().findFirst();
    }

    @Override
    public List<MembershipData> findMembershipsByUserId(UUID userId) {
        var rows = jdbcTemplate.query("""
                select m.id as membership_id, m.organization_id, m.status, m.profile_status, r.role
                from rti.organization_memberships m
                left join rti.membership_roles r on r.membership_id = m.id
                where m.user_id = ?
                order by m.organization_id, r.role
                """, (rs, row) -> new MembershipRow(
                        rs.getObject("membership_id", UUID.class),
                        rs.getObject("organization_id", UUID.class),
                        rs.getString("status"), rs.getString("profile_status"), rs.getString("role")), userId);
        var roles = new LinkedHashMap<UUID, Set<String>>();
        var statuses = new LinkedHashMap<UUID, String>();
        var profileStatuses = new LinkedHashMap<UUID, String>();
        var membershipIds = new LinkedHashMap<UUID, UUID>();
        for (var row : rows) {
            membershipIds.put(row.organizationId(), row.id());
            statuses.put(row.organizationId(), row.status());
            profileStatuses.put(row.organizationId(), row.profileStatus());
            var organizationRoles = roles.computeIfAbsent(row.organizationId(), ignored -> new LinkedHashSet<>());
            if (row.role() != null) {
                organizationRoles.add(row.role());
            }
        }
        return roles.entrySet().stream().map(entry -> new MembershipData(
                membershipIds.get(entry.getKey()), entry.getKey(), statuses.get(entry.getKey()),
                profileStatuses.get(entry.getKey()), entry.getValue())).toList();
    }

    private record MembershipRow(UUID id, UUID organizationId, String status, String profileStatus, String role) {
    }
}
