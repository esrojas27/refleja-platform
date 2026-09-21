package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ActivityEvaluationAnswerJpaRepository extends JpaRepository<ActivityEvaluationAnswerJpaEntity, UUID> {
    List<ActivityEvaluationAnswerJpaEntity> findByResponseIdInOrderByResponseIdAscQuestionIdAscPositionAsc(
            Collection<UUID> responseIds);
}
