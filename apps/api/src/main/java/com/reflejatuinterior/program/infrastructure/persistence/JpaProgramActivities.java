package com.reflejatuinterior.program.infrastructure.persistence;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.domain.InvalidProgramInput;
import com.reflejatuinterior.program.domain.NewProgramActivity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaProgramActivities implements ProgramActivities {
    private final ProgramSessionJpaRepository sessions;
    private final ProgramActivityJpaRepository activities;

    JpaProgramActivities(ProgramSessionJpaRepository sessions, ProgramActivityJpaRepository activities) {
        this.sessions = sessions;
        this.activities = activities;
    }

    @Override
    public Activity create(UUID organizationId, UUID programId, UUID sessionId, String title,
            String instructions, LocalDate dueDate, int position) {
        var session = sessions.findByOrganizationIdAndProgramIdAndId(organizationId, programId, sessionId)
                .orElseThrow(Missing::new);
        NewProgramActivity input;
        try {
            input = new NewProgramActivity(title, instructions, dueDate, position);
        } catch (InvalidProgramInput exception) {
            throw new InvalidInput(exception.field());
        }
        return data(activities.saveAndFlush(new ProgramActivityJpaEntity(organizationId, programId,
                session.moduleId(), session.id(), input.title(), input.instructions(), input.dueDate(), input.position())));
    }

    @Override
    public List<Activity> list(UUID organizationId, UUID programId) {
        return activities.findByOrganizationIdAndProgramIdOrderBySessionIdAscPositionAscIdAsc(organizationId, programId)
                .stream().map(JpaProgramActivities::data).toList();
    }

    @Override
    public List<Activity> findAll(UUID organizationId, UUID programId, Collection<UUID> activityIds) {
        if (activityIds.isEmpty()) return List.of();
        return activities.findByOrganizationIdAndProgramIdAndIdIn(organizationId, programId, activityIds)
                .stream().map(JpaProgramActivities::data)
                .sorted(Comparator.comparing(Activity::dueDate).thenComparing(Activity::position).thenComparing(Activity::id))
                .toList();
    }

    private static Activity data(ProgramActivityJpaEntity entity) {
        return new Activity(entity.id(), entity.organizationId(), entity.programId(), entity.moduleId(),
                entity.sessionId(), entity.title(), entity.instructions(), entity.dueDate(),
                entity.position(), entity.version());
    }
}
