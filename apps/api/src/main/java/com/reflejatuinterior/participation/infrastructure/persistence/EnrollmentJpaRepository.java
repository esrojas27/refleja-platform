package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface EnrollmentJpaRepository extends JpaRepository<EnrollmentJpaEntity, UUID> {
}
