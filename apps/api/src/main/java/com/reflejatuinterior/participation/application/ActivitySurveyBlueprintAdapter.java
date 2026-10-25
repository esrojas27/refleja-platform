package com.reflejatuinterior.participation.application;

import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.ActivitySurveyBlueprints;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional(propagation = Propagation.MANDATORY)
class ActivitySurveyBlueprintAdapter implements ActivitySurveyBlueprints {
    private final ActivityEvaluations evaluations;

    ActivitySurveyBlueprintAdapter(ActivityEvaluations evaluations) {
        this.evaluations = evaluations;
    }

    @Override
    public List<Survey> list(UUID organizationId, UUID programId) {
        return evaluations.list(organizationId, programId).stream().map(evaluation -> new Survey(
                evaluation.activityId(), evaluation.title(), evaluation.instructions(), evaluation.questions().stream()
                        .map(question -> new Question(question.prompt(), question.type().name(), question.position(), question.options()))
                        .toList())).toList();
    }

    @Override
    public void create(UUID organizationId, UUID programId, UUID activityId, SurveyDraft survey) {
        evaluations.create(organizationId, programId, activityId, survey.title(), survey.instructions(),
                survey.questions().stream().map(question -> new ActivityEvaluations.QuestionInput(
                        question.prompt(), EvaluationQuestionType.valueOf(question.type()), question.position(), question.options()))
                        .toList());
    }
    @Override public List<SessionSurvey> listSessions(UUID org,UUID program){
        return evaluations.listForSessions(org,program).stream().map(e->new SessionSurvey(e.sessionId(),e.title(),e.instructions(),
            e.questions().stream().map(q->new Question(q.prompt(),q.type().name(),q.position(),q.options())).toList())).toList();
    }
    @Override public void createForSession(UUID org,UUID program,UUID session,SurveyDraft survey){
        evaluations.createForSession(org,program,session,survey.title(),survey.instructions(),survey.questions().stream()
            .map(q->new ActivityEvaluations.QuestionInput(q.prompt(),EvaluationQuestionType.valueOf(q.type()),q.position(),q.options())).toList());
    }
}
