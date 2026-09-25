package com.reflejatuinterior.program.infrastructure.persistence;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
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
    private final ProgramModuleJpaRepository modules;
    private final ProgramActivityJpaRepository activities;

    JpaProgramActivities(ProgramSessionJpaRepository sessions, ProgramModuleJpaRepository modules,
            ProgramActivityJpaRepository activities) {
        this.sessions = sessions;
        this.modules = modules;
        this.activities = activities;
    }

    @Override
    public Activity create(UUID organizationId, UUID programId, UUID sessionId, String title,
            String instructions, String youtubeUrl, LocalDate dueDate, int position) {
        var session = sessions.findByOrganizationIdAndProgramIdAndId(organizationId, programId, sessionId)
                .orElseThrow(Missing::new);
        NewProgramActivity input;
        try {
            input = new NewProgramActivity(title, instructions, youtubeUrl, dueDate, position);
        } catch (InvalidProgramInput exception) {
            throw new InvalidInput(exception.field());
        }
        var module = modules.findByOrganizationIdAndProgramIdAndId(organizationId, programId, session.moduleId())
                .orElseThrow(Missing::new);
        return data(activities.saveAndFlush(new ProgramActivityJpaEntity(organizationId, programId,
                session.moduleId(), session.id(), input.title(), input.instructions(), input.youtubeUrl(),
                input.dueDate(), input.position())), module.name(), module.position(),
                session.name(), session.position());
    }

    @Override
    public List<Activity> list(UUID organizationId, UUID programId) {
        return contextualize(organizationId, programId,
                activities.findByOrganizationIdAndProgramIdOrderBySessionIdAscPositionAscIdAsc(
                        organizationId, programId));
    }

    @Override
    public List<Activity> findAll(UUID organizationId, UUID programId, Collection<UUID> activityIds) {
        if (activityIds.isEmpty()) return List.of();
        return contextualize(organizationId, programId,
                activities.findByOrganizationIdAndProgramIdAndIdIn(organizationId, programId, activityIds));
    }

    private List<Activity> contextualize(UUID organizationId, UUID programId,
            List<ProgramActivityJpaEntity> entities) {
        if (entities.isEmpty()) return List.of();
        Map<UUID, ProgramModuleJpaEntity> dimensions = modules
                .findByOrganizationIdAndProgramIdOrderByPositionAscIdAsc(organizationId, programId).stream()
                .collect(Collectors.toMap(ProgramModuleJpaEntity::id, Function.identity()));
        Map<UUID, ProgramSessionJpaEntity> programSessions = sessions
                .findByOrganizationIdAndProgramIdOrderByModuleIdAscPositionAscIdAsc(organizationId, programId).stream()
                .collect(Collectors.toMap(ProgramSessionJpaEntity::id, Function.identity()));
        return entities.stream().map(entity -> {
            var dimension = dimensions.get(entity.moduleId());
            var session = programSessions.get(entity.sessionId());
            if (dimension == null || session == null) throw new Missing();
            return data(entity, dimension.name(), dimension.position(), session.name(), session.position());
        }).sorted(Comparator.comparingInt(Activity::dimensionPosition)
                .thenComparing(Activity::moduleId)
                .thenComparingInt(Activity::sessionPosition)
                .thenComparing(Activity::sessionId)
                .thenComparingInt(Activity::position)
                .thenComparing(Activity::id)).toList();
    }

    private static Activity data(ProgramActivityJpaEntity entity, String dimensionName, int dimensionPosition,
            String sessionName, int sessionPosition) {
        return new Activity(entity.id(), entity.organizationId(), entity.programId(), entity.moduleId(),
                entity.sessionId(), dimensionName, dimensionPosition, sessionName, sessionPosition,
                entity.title(), entity.instructions(), entity.youtubeUrl(), entity.dueDate(),
                entity.position(), entity.version());
    }
}
