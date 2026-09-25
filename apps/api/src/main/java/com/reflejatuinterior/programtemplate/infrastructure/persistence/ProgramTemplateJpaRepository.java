package com.reflejatuinterior.programtemplate.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ProgramTemplateJpaRepository extends JpaRepository<ProgramTemplateJpaEntity, UUID> {}
