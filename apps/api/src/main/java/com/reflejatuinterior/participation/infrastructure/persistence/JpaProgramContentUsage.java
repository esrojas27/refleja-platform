package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.UUID;
import com.reflejatuinterior.program.ProgramContentUsage;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaProgramContentUsage implements ProgramContentUsage {
    private final ActivityAssignmentJpaRepository assignments;
    private final ActivityEvaluationResponseJpaRepository responses;
    JpaProgramContentUsage(ActivityAssignmentJpaRepository assignments, ActivityEvaluationResponseJpaRepository responses) {
        this.assignments = assignments; this.responses = responses;
    }
    @Override public boolean hasAssignments(UUID org, UUID program, Collection<UUID> ids) {
        return !ids.isEmpty() && assignments.existsByOrganizationIdAndProgramIdAndActivityIdIn(org, program, ids);
    }
    @Override public boolean hasResponses(UUID org, UUID program, Collection<UUID> ids) {
        return !ids.isEmpty() && responses.existsByOrganizationIdAndProgramIdAndActivityIdIn(org, program, ids);
    }
}
