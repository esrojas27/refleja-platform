package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.program.ProgramBlueprints;
import com.reflejatuinterior.program.domain.NewProgram;
import com.reflejatuinterior.program.domain.NewProgramActivity;
import com.reflejatuinterior.program.domain.NewProgramModule;
import com.reflejatuinterior.program.domain.NewProgramSession;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaProgramBlueprints implements ProgramBlueprints {
    private final ProgramJpaRepository programs;
    private final ProgramModuleJpaRepository dimensions;
    private final ProgramSessionJpaRepository sessions;
    private final ProgramActivityJpaRepository activities;

    JpaProgramBlueprints(ProgramJpaRepository programs, ProgramModuleJpaRepository dimensions,
            ProgramSessionJpaRepository sessions, ProgramActivityJpaRepository activities) {
        this.programs = programs;
        this.dimensions = dimensions;
        this.sessions = sessions;
        this.activities = activities;
    }

    @Override
    public Optional<Source> find(UUID organizationId, UUID programId) {
        return programs.findByOrganizationIdAndId(organizationId, programId).map(program -> {
            var storedSessions = sessions.findByOrganizationIdAndProgramIdOrderByModuleIdAscPositionAscIdAsc(
                    organizationId, programId);
            var storedActivities = activities.findByOrganizationIdAndProgramIdOrderBySessionIdAscPositionAscIdAsc(
                    organizationId, programId);
            var storedDimensions = dimensions.findByOrganizationIdAndProgramIdOrderByPositionAscIdAsc(
                    organizationId, programId).stream().map(dimension -> new Dimension(
                            dimension.name(), dimension.description(), dimension.position(),
                            storedSessions.stream().filter(session -> session.moduleId().equals(dimension.id()))
                                    .map(session -> new Session(session.name(), session.description(),
                                            session.objective(), session.scheduledDate(), session.position(),
                                            storedActivities.stream()
                                                    .filter(activity -> activity.sessionId().equals(session.id()))
                                                    .map(activity -> new Activity(activity.id(), activity.title(),
                                                            activity.instructions(), activity.youtubeUrl(),
                                                            activity.dueDate(), activity.position()))
                                                    .toList()))
                                    .toList())).toList();
            return new Source(program.id(), program.organizationId(), program.name(), program.description(),
                    program.startDate(), program.endDate(), storedDimensions);
        });
    }

    @Override
    public Created create(UUID organizationId, ProgramDraft input, List<DimensionDraft> dimensionDrafts) {
        try {
            return createValidated(organizationId, input, dimensionDrafts);
        } catch (com.reflejatuinterior.program.domain.InvalidProgramInput exception) {
            throw new InvalidInput(exception.field());
        }
    }

    private Created createValidated(UUID organizationId, ProgramDraft input, List<DimensionDraft> dimensionDrafts) {
        var newProgram = new NewProgram(input.name(), input.description(), input.startDate(), input.endDate());
        var program = programs.saveAndFlush(new ProgramJpaEntity(organizationId, newProgram.name(),
                newProgram.description(), ProgramStatus.valueOf(newProgram.initialStatus()),
                newProgram.startDate(), newProgram.endDate(), null));
        var activityIds = new LinkedHashMap<String, UUID>();
        for (var dimensionDraft : dimensionDrafts) {
            var dimensionInput = new NewProgramModule(dimensionDraft.name(), dimensionDraft.description(),
                    dimensionDraft.position());
            var dimension = dimensions.saveAndFlush(new ProgramModuleJpaEntity(organizationId, program.id(),
                    dimensionInput.name(), dimensionInput.description(), dimensionInput.position()));
            for (var sessionDraft : dimensionDraft.sessions()) {
                var sessionInput = new NewProgramSession(sessionDraft.name(), sessionDraft.description(),
                        sessionDraft.objective(), sessionDraft.scheduledDate(), sessionDraft.position());
                var session = sessions.saveAndFlush(new ProgramSessionJpaEntity(organizationId, program.id(),
                        dimension.id(), sessionInput.name(), sessionInput.description(), sessionInput.objective(),
                        sessionInput.scheduledDate(), sessionInput.position()));
                var storedActivities = new ArrayList<ProgramActivityJpaEntity>();
                for (var activityDraft : sessionDraft.activities()) {
                    var activityInput = new NewProgramActivity(activityDraft.title(), activityDraft.instructions(),
                            activityDraft.youtubeUrl(), activityDraft.dueDate(), activityDraft.position());
                    storedActivities.add(new ProgramActivityJpaEntity(organizationId, program.id(), dimension.id(),
                            session.id(), activityInput.title(), activityInput.instructions(),
                            activityInput.youtubeUrl(), activityInput.dueDate(), activityInput.position()));
                }
                var savedActivities = activities.saveAllAndFlush(storedActivities);
                for (int index = 0; index < savedActivities.size(); index++) {
                    var reference = sessionDraft.activities().get(index).reference();
                    if (reference == null || activityIds.put(reference, savedActivities.get(index).id()) != null) {
                        throw new IllegalArgumentException("Duplicate activity template reference");
                    }
                }
            }
        }
        return new Created(new Program(program.id(), program.organizationId(), program.name(), program.description(),
                program.status().name(), program.startDate(), program.endDate(), program.version()), activityIds);
    }
}
