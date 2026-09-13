# Fundación visual y navegación del producto

## Propósito

Este incremento convierte el frontend técnico de VS1 en una base de producto
coherente que pueda evolucionar mediante validaciones con usuarios. No sustituye
los ADR aceptados ni define la identidad de marca final.

## Alcance

- tokens visuales para color, tipografía, radios, superficies y foco;
- marca textual provisional y portada orientada al propósito del producto;
- experiencia de acceso consistente con Cognito y sin campos de credenciales;
- shell responsive para las rutas autenticadas, con acceso al contenido,
  navegación principal y pie de página;
- estilos reutilizables para acciones, enlaces, campos, tarjetas y mensajes;
- adaptación visual de Cuenta, organizaciones, programas, invitaciones y
  colaboradores sin cambiar sus contratos ni permisos;
- comprobación de navegación accesible y conservación de los smoke tests.

## Límites

La navegación es una ayuda de experiencia, no una frontera de seguridad. Los
permisos continúan resolviéndose en el backend y por organización. Mostrar un
enlace no concede acceso ni sustituye las respuestas 401, 403 y 404 existentes.

Este incremento no agrega actividades, seguimiento de progreso, evaluaciones,
dashboards, datos ficticios, endpoints, migraciones, autenticación adicional ni
infraestructura de despliegue. Tampoco declara definitivos el símbolo, la paleta,
la tipografía o los textos de marca: deberán validarse con usuarios y con la
identidad corporativa antes de una versión pública.

## Continuación esperada

El detalle del programa ya dispone de un espacio de trabajo y el incremento de
[estructura inicial](program-structure-foundation.md) incorpora módulos y sesiones.
La siguiente capacidad funcional debe agregar actividades dentro de una sesión
mediante un ticket independiente. El modelo de progreso debe derivarse después de
reglas explícitas sobre finalización de actividades; las evaluaciones requieren su
propio contrato funcional.

## Backlog de experiencia

- Hacer que la portada reconozca una sesión vigente y ofrezca **Volver a mi
  cuenta** en lugar de iniciar de nuevo el flujo de Cognito. La comprobación debe
  integrarse con el estado real de Amplify sin duplicar el callback OAuth.
- Agregar destinos de actividades, progreso o evaluaciones únicamente cuando sus
  rutas y capacidades reales hayan sido implementadas.
