package com.reflejatuinterior.identity;

import java.util.Set;
import java.util.UUID;

/** Identity-owned operations. Caller authorizes the consultant, activates the tenant and locks the program. */
public interface ParticipantIdentityAdministration {
    record State(Set<String> roles,long version,String membershipStatus,String userStatus) {
        public State { roles=Set.copyOf(roles); }
    }
    State inspect(UUID org,UUID membership);
    State changeRole(UUID org,UUID membership,long version,CollaboratorInvitations.InvitedRole role);
    CollaboratorInvitations.Invitation revoke(UUID org,UUID invitation);
    CollaboratorInvitations.Invitation renew(UUID org,UUID actor,UUID invitation);
    class Conflict extends RuntimeException {
        private final String code;
        public Conflict(String code) { this.code=code; }
        public String code() { return code; }
    }
}
