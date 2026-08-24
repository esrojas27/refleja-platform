package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface ProgramJpaRepository extends JpaRepository<ProgramJpaEntity, UUID> {
}
