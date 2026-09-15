# Estructura inicial de programas

## Propósito

Este incremento agrega el prerrequisito mínimo para que un programa pueda
contener actividades posteriormente. Conserva la jerarquía definida por el
producto: **Programa → Dimensión → Sesión → Actividad**.

El incremento no tiene todavía un identificador oficial de ticket. No forma
parte de VS1 ni modifica sus criterios de cierre.

## Alcance implementado

- espacio de trabajo del programa con navegación responsive;
- sección **Contenido** para consultores autorizados;
- creación y consulta ordenada de dimensiones configurables;
- creación y consulta ordenada de sesiones dentro de cada dimensión;
- nombre y descripción opcional para dimensiones;
- nombre, objetivo opcional y fecha obligatoria para sesiones;
- fecha obligatoria para cada sesión;
- posición calculada al final de la colección visible;
- persistencia PostgreSQL con UUIDv7, auditoría temporal y versión optimista;
- aislamiento por `organization_id`, claves foráneas compuestas y RLS.

No se implementan edición, eliminación, reordenamiento ni plantillas. En
particular, Interior, Exterior y Social no se crean automáticamente: serán valores
iniciales modificables de una futura plantilla de programa.

## Persistencia

La migración `V20260913020000__create_program_structure.sql` crea:

- `rti.program_modules`, perteneciente a una organización y un programa;
- `rti.program_sessions`, perteneciente a la misma organización, programa y
  dimensión (el nombre físico histórico se conserva).

La posición es positiva y única entre hermanos. Las claves compuestas impiden
relacionar una sesión con un módulo de otro programa u organización. Ambas tablas
tienen RLS para el rol `rti_app`; sin contexto transaccional de organización no
son visibles ni modificables.

## API

Rutas autenticadas:

- `GET /api/v1/organizations/{organizationId}/programs/{programId}/modules`
- `POST /api/v1/organizations/{organizationId}/programs/{programId}/modules`
- `POST /api/v1/organizations/{organizationId}/programs/{programId}/modules/{moduleId}/sessions`

Las rutas y los campos `moduleId` se conservan como contrato técnico legado de
API v1. La interfaz y el cliente los adaptan a la terminología de producto
**dimensión**; no se introduce una ruta duplicada ni un cambio incompatible.

La consulta devuelve dimensiones y sesiones en orden ascendente. Sólo una membresía
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
4. Crear una dimensión y comprobar que aparece con su posición.
5. Agregar una sesión con objetivo y fecha dentro de la dimensión.
6. Actualizar la página y comprobar que ambos registros persisten.
7. Revisar que la navegación siga siendo utilizable en ancho móvil.
