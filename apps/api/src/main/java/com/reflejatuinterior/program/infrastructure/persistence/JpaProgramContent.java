package com.reflejatuinterior.program.infrastructure.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.IntConsumer;
import com.reflejatuinterior.program.ProgramActivities;
import com.reflejatuinterior.program.ProgramContent;
import com.reflejatuinterior.program.ProgramContentUsage;
import com.reflejatuinterior.program.domain.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaProgramContent implements ProgramContent {
    private final ProgramModuleJpaRepository dimensions;
    private final ProgramSessionJpaRepository sessions;
    private final ProgramActivityJpaRepository activities;
    private final EntityManager em;
    private final ProgramContentUsage usage;

    JpaProgramContent(ProgramModuleJpaRepository dimensions, ProgramSessionJpaRepository sessions,
            ProgramActivityJpaRepository activities, EntityManager em, ProgramContentUsage usage) {
        this.dimensions = dimensions; this.sessions = sessions; this.activities = activities; this.em = em; this.usage = usage;
    }

    @Override public Node describe(UUID org, UUID program, Kind kind, UUID id) {
        return switch (kind) {
            case DIMENSION -> {
                var item = dimension(org, program, id);
                yield new Node(id, item.version(), item.archived(), false, activityRows(org, program).stream()
                        .filter(a -> a.moduleId().equals(id)).map(ProgramActivityJpaEntity::id).toList());
            }
            case SESSION -> {
                var item = session(org, program, id);
                yield new Node(id, item.version(), item.archived(), dimension(org, program, item.moduleId()).archived(),
                        activityRows(org, program).stream().filter(a -> a.sessionId().equals(id)).map(ProgramActivityJpaEntity::id).toList());
            }
            case ACTIVITY -> {
                var item = activity(org, program, id);
                yield new Node(id, item.version(), item.archived(), session(org, program, item.sessionId()).archived()
                        || dimension(org, program, item.moduleId()).archived(), List.of(id));
            }
        };
    }

    @Override public void editDimension(UUID org, UUID program, UUID id, String name, String description) {
        var item = dimension(org, program, id);
        try { item.edit(new NewProgramModule(name, description, item.position())); }
        catch (InvalidProgramInput e) { throw new ProgramActivities.InvalidInput(e.field()); }
        em.flush();
    }

    @Override public void editSession(UUID org, UUID program, UUID id, String name, String objective, LocalDate date) {
        var item = session(org, program, id);
        try { item.edit(new NewProgramSession(name, item.description(), objective, date, item.position())); }
        catch (InvalidProgramInput e) { throw new ProgramActivities.InvalidInput(e.field()); }
        em.flush();
    }

    @Override public void editActivity(UUID org, UUID program, UUID id, String title, String instructions, String youtubeUrl, LocalDate dueDate) {
        var item = activity(org, program, id);
        try { item.edit(new NewProgramActivity(title, instructions, youtubeUrl, dueDate, item.position())); }
        catch (InvalidProgramInput e) { throw new ProgramActivities.InvalidInput(e.field()); }
        em.flush();
    }

    @Override public void archive(UUID org, UUID program, Kind kind, UUID id, boolean archived) {
        switch (kind) {
            case DIMENSION -> dimension(org, program, id).archive(archived);
            case SESSION -> session(org, program, id).archive(archived);
            case ACTIVITY -> activity(org, program, id).archive(archived);
        }
        em.flush();
    }

    @Override public void move(UUID org, UUID program, Kind kind, UUID id, boolean up) {
        var siblings = siblings(org, program, kind, id).stream().filter(p -> !p.archived()).toList();
        int index = java.util.stream.IntStream.range(0, siblings.size()).filter(i -> siblings.get(i).id().equals(id))
                .findFirst().orElseThrow(ProgramActivities.Missing::new);
        int next = index + (up ? -1 : 1);
        if (next < 0 || next >= siblings.size()) throw new Conflict("CONTENT_ORDER_BOUNDARY");
        String constraint = switch (kind) {
            case DIMENSION -> "uq_program_modules_position";
            case SESSION -> "uq_program_sessions_position";
            case ACTIVITY -> "uq_program_activities_position";
        };
        em.createNativeQuery("SET CONSTRAINTS rti." + constraint + " DEFERRED").executeUpdate();
        var current = siblings.get(index); var neighbor = siblings.get(next);
        current.update().accept(neighbor.position()); neighbor.update().accept(current.position());
        em.flush();
        em.createNativeQuery("SET CONSTRAINTS rti." + constraint + " IMMEDIATE").executeUpdate();
    }

    @Override public void deleteUnassigned(UUID org, UUID program, Kind kind, UUID id) {
        var node = describe(org, program, kind, id);
        // Explicit defense at the persistence boundary, in addition to the service
        // check. Assignment and response foreign keys remain RESTRICT as a backstop.
        if (usage.hasAssignments(org, program, node.activityIds()) || usage.hasResponses(org, program, node.activityIds()))
            throw new Conflict("CONTENT_HAS_ASSIGNMENTS");
        activities.deleteAll(activities.findByOrganizationIdAndProgramIdAndIdIn(org, program, node.activityIds()));
        activities.flush();
        if (kind == Kind.SESSION) {
            sessions.delete(session(org, program, id)); sessions.flush();
        } else if (kind == Kind.DIMENSION) {
            sessions.deleteAll(sessions.findByOrganizationIdAndProgramIdOrderByModuleIdAscPositionAscIdAsc(org, program)
                    .stream().filter(s -> s.moduleId().equals(id)).toList());
            sessions.flush(); dimensions.delete(dimension(org, program, id)); dimensions.flush();
        }
    }

    private List<Positioned> siblings(UUID org, UUID program, Kind kind, UUID id) {
        return switch (kind) {
            case DIMENSION -> dimensions.findByOrganizationIdAndProgramIdOrderByPositionAscIdAsc(org, program).stream()
                    .map(d -> new Positioned(d.id(), d.position(), d.archived(), d::moveTo)).toList();
            case SESSION -> {
                var current = session(org, program, id);
                yield sessions.findByOrganizationIdAndProgramIdOrderByModuleIdAscPositionAscIdAsc(org, program).stream()
                        .filter(s -> s.moduleId().equals(current.moduleId()))
                        .map(s -> new Positioned(s.id(), s.position(), s.archived(), s::moveTo)).toList();
            }
            case ACTIVITY -> {
                var current = activity(org, program, id);
                yield activityRows(org, program).stream().filter(a -> a.sessionId().equals(current.sessionId()))
                        .map(a -> new Positioned(a.id(), a.position(), a.archived(), a::moveTo)).toList();
            }
        };
    }

    private ProgramModuleJpaEntity dimension(UUID org, UUID program, UUID id) {
        return dimensions.findByOrganizationIdAndProgramIdAndId(org, program, id).orElseThrow(ProgramActivities.Missing::new);
    }
    private ProgramSessionJpaEntity session(UUID org, UUID program, UUID id) {
        return sessions.findByOrganizationIdAndProgramIdAndId(org, program, id).orElseThrow(ProgramActivities.Missing::new);
    }
    private ProgramActivityJpaEntity activity(UUID org, UUID program, UUID id) {
        return activities.findByOrganizationIdAndProgramIdAndIdIn(org, program, List.of(id)).stream()
                .findFirst().orElseThrow(ProgramActivities.Missing::new);
    }
    private List<ProgramActivityJpaEntity> activityRows(UUID org, UUID program) {
        return activities.findByOrganizationIdAndProgramIdOrderBySessionIdAscPositionAscIdAsc(org, program);
    }
    private record Positioned(UUID id, int position, boolean archived, IntConsumer update) {}
}
