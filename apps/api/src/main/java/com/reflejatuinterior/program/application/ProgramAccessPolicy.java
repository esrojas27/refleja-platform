package com.reflejatuinterior.program.application;

import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.identity.OrganizationAccess;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class ProgramAccessPolicy {
    private final OrganizationAccess access;
    ProgramAccessPolicy(OrganizationAccess access) { this.access = access; }

    OrganizationAccess.Context authorize(String subject, UUID organizationId, boolean write, String requestId) {
        UUID actor = null;
        try {
            var context = access.resolve(subject, organizationId);
            actor = context.userId();
            boolean permitted = context.roles().contains("CONSULTANT") || (!write &&
                    (context.roles().contains("COMPANY_ADMIN") || context.roles().contains("LEADER")));
            // Basic program metadata only. Collaborator's enrolled-program access belongs to VS1-011.
            if (!permitted) throw new OrganizationAccess.Denied();
            return context;
        } catch (OrganizationAccess.Unavailable exception) {
            logDenied(actor, organizationId, write, requestId);
            throw new ProgramNotFound();
        } catch (OrganizationAccess.Denied exception) {
            logDenied(actor, organizationId, write, requestId);
            throw exception;
        }
    }

    OrganizationAccess.Context authorizeConsultant(String subject, UUID organizationId, String operation, String requestId) {
        UUID actor = null;
        try {
            var context = access.resolve(subject, organizationId);
            actor = context.userId();
            if (!context.roles().contains("CONSULTANT")) throw new OrganizationAccess.Denied();
            return context;
        } catch (OrganizationAccess.Unavailable exception) {
            logDenied(actor, organizationId, operation, requestId);
            throw new ProgramNotFound();
        } catch (OrganizationAccess.Denied exception) {
            logDenied(actor, organizationId, operation, requestId);
            throw exception;
        }
    }

    private void logDenied(UUID actor, UUID organizationId, boolean write, String requestId) {
        LoggerFactory.getLogger(ProgramAccessPolicy.class).warn(
                "action=AUTHORIZATION_DENIED operation={} actor={} organization={} resource=Program requestId={} timestamp={} result=DENIED",
                write ? "CREATE_PROGRAM" : "VIEW_PROGRAM", actor, organizationId, requestId, Instant.now());
    }

    private void logDenied(UUID actor, UUID organizationId, String operation, String requestId) {
        LoggerFactory.getLogger(ProgramAccessPolicy.class).warn(
                "action=AUTHORIZATION_DENIED operation={} actor={} organization={} resource=Program requestId={} timestamp={} result=DENIED",
                operation, actor, organizationId, requestId, Instant.now());
    }
}
