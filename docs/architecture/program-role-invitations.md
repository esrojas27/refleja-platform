# Invitaciones por rol de organización

## Decisión de producto

El consultor puede invitar desde un programa a una persona como **Colaborador**,
**Líder** o **RRHH**. Los valores técnicos persistidos son, respectivamente,
`COLLABORATOR`, `LEADER` y `COMPANY_ADMIN`.

RRHH no introduce un rol `HR`: es la etiqueta de producto del rol existente
`COMPANY_ADMIN`. Líder y RRHH son roles de la membresía de organización, no roles
propios del programa. La invitación conserva además la inscripción al programa que
originó el proceso.

## Contrato y persistencia

`POST /api/v1/organizations/{organizationId}/programs/{programId}/enrollments`
acepta el campo opcional `role`. La omisión conserva compatibilidad y equivale a
`COLLABORATOR`. Sólo se aceptan:

- `COLLABORATOR`
- `LEADER`
- `COMPANY_ADMIN`

La migración `V20260915010000__add_invitation_role.sql` agrega
`user_invitations.invited_role VARCHAR NOT NULL`, restringido a esos valores. Las
invitaciones existentes se migran como `COLLABORATOR`. El valor se persiste por
nombre simbólico, nunca como ordinal.

Al aceptar una invitación se activa la inscripción y se garantiza que la membresía
tenga el rol solicitado. Los roles preexistentes no se eliminan. Una invitación no
puede conceder `CONSULTANT` ni `SUPER_ADMIN`.

## Seguridad y límites

Sólo un `CONSULTANT` activo de la organización puede crear o consultar estas
invitaciones. La selección del navegador se valida contra una lista cerrada en el
backend y la organización se deriva de la ruta autorizada. Cognito continúa
aportando identidad, no autorización interna.

Este incremento no agrega visibilidad sobre DISC, evaluaciones, participantes,
reportes ni administración de programas. Tampoco define aún las capacidades
finales de Líder o RRHH. Se conservan únicamente los permisos ya aprobados para
`LEADER` y `COMPANY_ADMIN`; cualquier ampliación deberá ser otro incremento.
