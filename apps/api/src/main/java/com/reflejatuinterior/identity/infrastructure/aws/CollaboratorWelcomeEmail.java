package com.reflejatuinterior.identity.infrastructure.aws;

/** Temporary editorial content approved for the IFX / Coach Ejecutivo pilot only. */
final class CollaboratorWelcomeEmail {
    static final String GUIDE_URL = "https://drive.google.com/file/d/1kky3u0KHF4fN1g1DALHx6wT2Nexi-pVA/view?usp=sharing";
    static final String SUPPORT_EMAIL = "marcayconexion@paularojas.com.co";
    static final String SUBJECT = "Tu espacio en Refleja Tu Interior ya está disponible";

    private CollaboratorWelcomeEmail() {}

    // The registration date is editorial, not the expiration or an authorization rule.
    // Parameterize this pilot content before invitations for another organization/cohort.
    static String text(String name, String accessUrl) {
        return """
                Hola, %s:

                ¡Tu espacio en Refleja Tu Interior ya está disponible!

                Hemos creado un espacio digital para acompañarte durante el programa Coach Ejecutivo. En tu dashboard podrás:

                - Consultar tu progreso.
                - Acceder a las sesiones y actividades asignadas.
                - Compartir tus reflexiones y comentarios.
                - Recibir retroalimentación de tu consultor.
                - Reconocer tus aprendizajes y avances durante el proceso.

                Para comenzar:

                1. Consulta la Guía del colaborador haciendo clic en el siguiente enlace. Allí encontrarás las instrucciones para crear tu usuario, completar tu perfil, desarrollar las actividades y responder las encuestas.

                [VER GUÍA DEL COLABORADOR]
                %s

                2. Ingresa al dashboard haciendo clic en el siguiente enlace:

                [CREAR MI USUARIO]
                %s

                3. Utiliza el mismo correo electrónico en el que recibiste esta invitación y completa los datos solicitados en tu perfil.

                Te invitamos a completar tu registro antes del 30 de octubre de 2026.

                Este espacio complementará las sesiones con Paula y te permitirá dar continuidad a tu proceso, revisar lo vivido y reconocer la evolución que vayas alcanzando.

                Si tienes alguna dificultad para ingresar o completar tu registro, escríbenos a %s.

                Nos alegra acompañarte en este camino de autoconocimiento, crecimiento y fortalecimiento de tu marca personal.

                Cordial saludo,

                Equipo Refleja Tu Interior
                Tu historia, tu mayor diferencial.
                """.formatted(name, GUIDE_URL, accessUrl, SUPPORT_EMAIL);
    }

    static String html(String name, String accessUrl) {
        return """
                <!doctype html>
                <html lang="es">
                  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
                  <body style="margin:0;background:#f5e7ed;color:#111111;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f5e7ed;">
                      <tr><td align="center" style="padding:24px 12px;">
                        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e8b8ca;border-radius:20px;">
                          <tr><td style="padding:28px 24px;line-height:1.65;font-size:16px;">
                            <p style="margin:0 0 22px;font-size:18px;">Hola, <strong>%s</strong>:</p>
                            <h1 style="margin:0 0 22px;color:#111111;font-family:Georgia,serif;font-size:28px;line-height:1.25;">¡Tu espacio en Refleja Tu Interior ya está disponible!</h1>
                            <p>Hemos creado un espacio digital para acompañarte durante el programa <strong>Coach Ejecutivo</strong>. En tu dashboard podrás:</p>
                            <ul style="padding-left:22px;color:#444144;">
                              <li>Consultar tu progreso.</li>
                              <li>Acceder a las sesiones y actividades asignadas.</li>
                              <li>Compartir tus reflexiones y comentarios.</li>
                              <li>Recibir retroalimentación de tu consultor.</li>
                              <li>Reconocer tus aprendizajes y avances durante el proceso.</li>
                            </ul>
                            <h2 style="margin:28px 0 16px;font-size:20px;">Para comenzar:</h2>
                            <p><strong>1.</strong> Consulta la <strong>Guía del colaborador</strong> haciendo clic en el siguiente enlace. Allí encontrarás las instrucciones para crear tu usuario, completar tu perfil, desarrollar las actividades y responder las encuestas.</p>
                            <p style="margin:20px 0 28px;text-align:center;"><a href="%s" target="_blank" rel="noopener noreferrer" style="display:inline-block;border:1px solid #111111;border-radius:14px;background:#f5e7ed;color:#111111;padding:13px 18px;font-size:14px;font-weight:bold;text-decoration:none;">VER GUÍA DEL COLABORADOR</a></p>
                            <p><strong>2.</strong> Ingresa al dashboard haciendo clic en el siguiente botón:</p>
                            <p style="margin:20px 0 28px;text-align:center;"><a href="%s" style="display:inline-block;border:1px solid #111111;border-radius:14px;background:#111111;color:#ffffff;padding:13px 22px;font-size:14px;font-weight:bold;text-decoration:none;">CREAR MI USUARIO</a></p>
                            <p><strong>3.</strong> Utiliza el mismo correo electrónico en el que recibiste esta invitación y completa los datos solicitados en tu perfil.</p>
                            <p style="padding:16px;background:#f5e7ed;border-left:3px solid #e8b8ca;">Te invitamos a completar tu registro antes del <strong>30 de octubre de 2026</strong>.</p>
                            <p>Este espacio complementará las sesiones con Paula y te permitirá dar continuidad a tu proceso, revisar lo vivido y reconocer la evolución que vayas alcanzando.</p>
                            <p>Si tienes alguna dificultad para ingresar o completar tu registro, escríbenos a <a href="mailto:%s" style="color:#111111;overflow-wrap:anywhere;word-break:break-word;"><strong>%s</strong></a>.</p>
                            <p>Nos alegra acompañarte en este camino de autoconocimiento, crecimiento y fortalecimiento de tu marca personal.</p>
                            <p style="margin:28px 0 0;">Cordial saludo,</p>
                            <p style="margin:8px 0 0;"><strong>Equipo Refleja Tu Interior</strong><br><em>Tu historia, tu mayor diferencial.</em></p>
                          </td></tr>
                        </table>
                      </td></tr>
                    </table>
                  </body>
                </html>
                """.formatted(escapeHtml(name), escapeHtml(GUIDE_URL), escapeHtml(accessUrl), SUPPORT_EMAIL, SUPPORT_EMAIL);
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }
}
