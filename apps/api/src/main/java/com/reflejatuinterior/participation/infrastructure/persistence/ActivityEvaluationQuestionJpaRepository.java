package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ActivityEvaluationQuestionJpaRepository extends JpaRepository<ActivityEvaluationQuestionJpaEntity, UUID> {
    List<ActivityEvaluationQuestionJpaEntity> findByEvaluationIdInOrderByEvaluationIdAscPositionAsc(
            Collection<UUID> evaluationIds);
    List<ActivityEvaluationQuestionJpaEntity> findByEvaluationIdOrderByPositionAsc(UUID evaluationId);
}
