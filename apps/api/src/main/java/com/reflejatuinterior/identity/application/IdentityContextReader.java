package com.reflejatuinterior.identity.application;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Read port for Identity-owned data, never a public HTTP or persistence contract. */
public interface IdentityContextReader {
    Optional<UserData> findUserByCognitoSubject(String cognitoSubject);

    List<MembershipData> findMembershipsByUserId(UUID userId);

    record UserData(UUID id, String cognitoSubject, String email,
                    String firstName, String lastName, String status) {
    }

    record MembershipData(UUID organizationId, String status, Set<String> roles) {
        public MembershipData {
            roles = Set.copyOf(roles);
        }
    }
}
