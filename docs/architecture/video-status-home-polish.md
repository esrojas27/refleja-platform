# Video, estados y acceso desde portada

## Alcance

- Video YouTube embebido y adaptable en contenido y actividades del consultor y
  actividades del colaborador. Enlace externo alternativo, sin reproducción
  automática y sin aceptar HTML ni hosts ajenos a YouTube. Las URLs almacenadas
  no cambian; el iframe se construye a partir de un identificador validado.
- Estados visibles en español: programas mantienen Borrador/Programado/Activo/
  Finalizado/Cancelado; organizaciones muestran Activa e invitaciones muestran
  Pendiente/Aceptada/Vencida/Revocada. Los enums de API y las reglas de acceso
  conservan sus valores técnicos. También se traduce la confirmación de aceptación.
- Los dos accesos de la portada muestran «Volver a mi cuenta» hacia `/account`
  cuando Amplify recupera una sesión Cognito. No depende de permisos de la API.
  Sin sesión muestran sus accesos a `/login`; durante la comprobación no se ofrece
  un enlace incorrecto. Se actualizan al volver a la ventana y ante eventos de auth.

## Validación manual

1. Entrar sin sesión a `/`: comprobar los enlaces a iniciar sesión.
2. Iniciar sesión, volver a `/` por el logo o URL y comprobar ambos accesos a
   «Volver a mi cuenta». Cerrar sesión y volver a comprobar la portada.
3. Abrir una actividad con enlace de YouTube en contenido, actividades del consultor
   y actividades del colaborador. Reproducir y probar pantalla completa; repetir
   en móvil. Las actividades sin video no deben reservar un espacio vacío.
4. Probar un video cuyo propietario no permita inserción: el enlace alternativo
   sigue disponible. No se puede garantizar la reproducción de videos privados,
   eliminados o restringidos por YouTube.
5. Revisar estados de programas, creación de organización e invitaciones, incluida
   la confirmación de aceptación. Deben verse en español, sin alterar permisos.

Las pruebas locales de interfaz usan sesiones sintéticas y servicios simulados;
no envían invitaciones ni modifican cuentas reales. El E2E de Cognito conserva su flujo y exige ahora
«Invitación: Pendiente». Este incremento no requiere migraciones ni cambios de AWS.

## Evidencia local

- 255 pruebas unitarias y de componentes aprobadas.
- 16 pruebas de navegación sin sesión aprobadas en Chromium.
- Portada anónima/autenticada y video dentro del acordeón revisados a 375 y 1440 px,
  sin desbordamiento horizontal. El contenido del iframe se simuló para esta revisión:
  la reproducción y las restricciones de los videos reales deben validarse manualmente.
- No se ejecutó el recorrido autenticado de Cognito contra AWS ni se desplegó DEV.
