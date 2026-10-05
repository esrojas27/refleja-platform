# ADR-006 — Despliegue DEV con presupuesto máximo de USD 20

- Estado: Accepted
- Fecha: 2026-10-04
- Alcance: entorno compartido de desarrollo

## Contexto

El producto necesita un ambiente demostrable en AWS con un costo mensual máximo
de USD 20. Dentro de ese límite no es viable mantener balanceador, cómputo
redundante y base de datos administrada Multi-AZ encendidos permanentemente.

## Decisión

DEV usará inicialmente una sola instancia Graviton `t4g.small`, programable y
reconstruible, con cuatro contenedores: Caddy, Next.js, Spring Boot y PostgreSQL.
Sólo Caddy publica puertos; API, web y base de datos permanecen en la red privada
de Docker. Cognito y SES continúan como servicios administrados existentes.

El límite combinado de memoria de los contenedores es 1.375 GiB:

| Servicio | Límite |
| --- | ---: |
| Caddy | 64 MiB |
| Next.js | 320 MiB |
| Spring Boot | 640 MiB |
| PostgreSQL | 384 MiB |

Quedan aproximadamente 640 MiB de una instancia de 2 GiB para Linux, Docker y
picos operativos. El despliegue sólo será aceptado después de una prueba de
arranque, salud y recorrido básico bajo esos límites.

## Objetivos operativos

- Presupuesto: alertas en USD 10, 15, 18 y 20.
- RPO inicial: 24 horas.
- RTO inicial: 60 minutos.
- Disponibilidad: horario laboral de Bogotá y encendido bajo demanda.
- Acceso administrativo futuro: AWS Systems Manager, sin SSH público.
- PostgreSQL nunca publica el puerto 5432.
- Secretos fuera de Git y, en AWS, obtenidos desde Parameter Store.
- Imágenes inmutables ARM64 en ECR y rollback al tag anterior.

## Consecuencias

DEV será seguro y recuperable, pero no tendrá alta disponibilidad ni cero
interrupciones. La pérdida de la instancia podrá causar hasta 60 minutos de
indisponibilidad mientras se reconstruye y restaura el respaldo. Producción deberá
reevaluar base de datos administrada, redundancia multi-AZ y balanceo.

No se incorporan en esta fase ALB, NAT Gateway, ECS ni RDS Multi-AZ porque sus
costos fijos comprometerían el límite. Aurora Serverless v2 queda como experimento
posterior si una prueba con JPA, red privada y auto-pause demuestra menor costo y
complejidad aceptable.
