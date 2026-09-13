# Estructura inicial de programas

## Propósito

Este incremento agrega el prerrequisito mínimo para que un programa pueda
contener actividades posteriormente. Conserva la jerarquía definida por el
producto: **Programa → Módulo → Sesión → Actividad**.

El incremento no tiene todavía un identificador oficial de ticket. No forma
parte de VS1 ni modifica sus criterios de cierre.

## Alcance implementado

- espacio de trabajo del programa con navegación responsive;
- sección **Contenido** para consultores autorizados;
- creación y consulta ordenada de módulos;
- creación y consulta ordenada de sesiones dentro de cada módulo;
- nombre y descripción opcional para módulos y sesiones;
- fecha obligatoria para cada sesión;
- posición calculada al final de la colección visible;
- persistencia PostgreSQL con UUIDv7, auditoría temporal y versión optimista;
- aislamiento por `organization_id`, claves foráneas compuestas y RLS.

No se implementan edición, eliminación, reordenamiento, publicación, actividades,
asignaciones, entregas, archivos, comentarios, evaluaciones ni progreso.

## Persistencia

La migración `V20260913020000__create_program_structure.sql` crea:

- `rti.program_modules`, perteneciente a una organización y un programa;
- `rti.program_sessions`, perteneciente a la misma organización, programa y
  módulo.

La posición es positiva y única entre hermanos. Las claves compuestas impiden
relacionar una sesión con un módulo de otro programa u organización. Ambas tablas
tienen RLS para el rol `rti_app`; sin contexto transaccional de organización no
son visibles ni modificables.

## API

Rutas autenticadas:

- `GET /api/v1/organizations/{organizationId}/programs/{programId}/modules`
- `POST /api/v1/organizations/{organizationId}/programs/{programId}/modules`
- `POST /api/v1/organizations/{organizationId}/programs/{programId}/modules/{moduleId}/sessions`

La consulta devuelve módulos y sesiones en orden ascendente. Sólo una membresía
activa con rol `CONSULTANT` en la organización solicitada puede utilizar estas
operaciones. Recursos inexistentes o fuera del tenant se representan con el
mismo `404 PROGRAM_NOT_FOUND`.

## Continuación

El siguiente incremento puede crear actividades dentro de una sesión. Antes de
implementarlas deberá cerrar explícitamente su contrato mínimo: estado de
publicación, audiencia o asignación, fecha límite y tipo de respuesta admitida.
La finalización por el colaborador pertenece al módulo `participation`, no a la
persistencia estructural del módulo `program`.

## Validación manual

1. Iniciar el entorno con `dev.cmd` desde la raíz.
2. Ingresar como consultor y seleccionar una organización activa.
3. Abrir un programa y entrar en **Contenido**.
4. Crear un módulo y comprobar que aparece con su posición.
5. Agregar una sesión con fecha dentro del módulo.
6. Actualizar la página y comprobar que ambos registros persisten.
7. Revisar que la navegación siga siendo utilizable en ancho móvil.
