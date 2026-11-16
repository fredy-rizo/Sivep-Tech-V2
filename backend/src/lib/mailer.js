import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter;

const LOGO_CID = "sivep-logo@sivep.tech";
const LOGO_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../frontend/public/brand/sivep-tech-01-monograma-brote-vino.png",
);

const SERIF = "Georgia, 'Times New Roman', 'Palatino Linotype', serif";
const SANS = "-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/** El envío de correo solo se activa cuando hay usuario y contraseña SMTP. */
export function isMailEnabled() {
  return Boolean(config.mail.user && config.mail.pass);
}

function getTransporter() {
  if (!isMailEnabled()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
  }
  return transporter;
}

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDate = (date) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date);

const firstName = (name = "") => name.trim().split(/\s+/)[0] || "la persona";

const detailRow = (label, value, href) => {
  if (!value) return "";
  const content = href
    ? `<a href="${escapeHtml(href)}" style="color:#8b1e3f;text-decoration:none;">${escapeHtml(value)}</a>`
    : escapeHtml(value);
  return `
    <tr>
      <td width="118" valign="top" style="padding:10px 0;border-top:1px solid #efeae2;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;color:#9a938a;">
        ${label}
      </td>
      <td valign="top" style="padding:10px 0;border-top:1px solid #efeae2;font-family:${SANS};font-size:13.5px;line-height:1.5;color:#23211e;word-break:break-word;">
        ${content}
      </td>
    </tr>`;
};

/**
 * Arma asunto, texto plano y HTML del correo de una idea de sistema.
 * Se exporta para poder previsualizar o probar la plantilla.
 */
export function buildIdeaEmail(idea, receivedAt = new Date()) {
  const fecha = formatDate(receivedAt);
  const shortName = firstName(idea.name);
  const summary = `${idea.name} dejó una idea de sistema${
    idea.business ? ` para ${idea.business}` : ""
  }.`;
  const subject = `Nueva idea de sistema — ${idea.name}${
    idea.business ? ` · ${idea.business}` : ""
  }`;

  const replyHref = `mailto:${idea.email}?subject=${encodeURIComponent(
    `Re: tu idea para SIVEP Tech`,
  )}`;
  const phoneHref = idea.phone
    ? `tel:${String(idea.phone).replace(/[^\d+]/g, "")}`
    : "";
  const messageHtml = escapeHtml(idea.message).replace(/\n/g, "<br />");
  const hasLogo = fs.existsSync(LOGO_PATH);

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f3ee;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(summary)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f3ee;">
      <tr>
        <td align="center" style="padding:36px 14px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

            <!-- Cabecera de marca -->
            <tr>
              <td style="background-color:#8b1e3f;border-radius:12px 12px 0 0;padding:22px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    ${
                      hasLogo
                        ? `<td width="46" valign="middle">
                            <img src="cid:${LOGO_CID}" width="44" height="44" alt="SIVEP Tech"
                              style="display:block;width:44px;height:44px;border-radius:9px;border:1px solid rgba(251,249,245,0.28);" />
                          </td>`
                        : ""
                    }
                    <td valign="middle" style="padding-left:${hasLogo ? "14px" : "0"};font-family:${SERIF};font-size:23px;line-height:1;color:#fbf9f5;">
                      SIVEP <em style="font-style:italic;color:#f0d8df;">Tech</em>
                    </td>
                    <td align="right" valign="middle" style="font-family:${SANS};font-size:8.5px;font-weight:600;letter-spacing:2.4px;text-transform:uppercase;color:rgba(251,249,245,0.62);">
                      Nueva idea
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Contenido -->
            <tr>
              <td style="background-color:#ffffff;border-left:1px solid #e3ddd3;border-right:1px solid #e3ddd3;padding:34px 30px 30px;">
                <p style="margin:0 0 9px;font-family:${SANS};font-size:9.5px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:#8b1e3f;">
                  Formulario de la página web
                </p>
                <h1 style="margin:0 0 10px;font-family:${SERIF};font-weight:400;font-size:30px;line-height:1.12;color:#23211e;">
                  Llegó una idea nueva.
                </h1>
                <p style="margin:0 0 22px;font-family:${SANS};font-size:13px;line-height:1.65;color:#716b63;">
                  ${escapeHtml(summary)} Responde a este correo para escribirle directo.
                </p>
                ${
                  idea.businessType
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
                        <tr>
                          <td style="background-color:#eef3ea;border:1px solid #d3e0cc;border-radius:100px;padding:5px 12px;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;color:#4a7340;">
                            ${escapeHtml(idea.businessType)}
                          </td>
                        </tr>
                      </table>`
                    : ""
                }

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;">
                  ${detailRow("Nombre", idea.name)}
                  ${detailRow("Negocio", idea.business)}
                  ${detailRow("Correo", idea.email, `mailto:${idea.email}`)}
                  ${detailRow("Teléfono", idea.phone, phoneHref)}
                  ${detailRow("Recibida", fecha)}
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:#fbf9f5;border-left:3px solid #8b1e3f;border-radius:0 8px 8px 0;">
                  <tr>
                    <td style="padding:18px 22px 20px;">
                      <p style="margin:0 0 7px;font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8b1e3f;">
                        La idea
                      </p>
                      <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.72;color:#2f2a25;">
                        ${messageHtml}
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
                  <tr>
                    <td style="background-color:#8b1e3f;border-radius:6px;">
                      <a href="${escapeHtml(replyHref)}"
                        style="display:inline-block;padding:13px 22px;font-family:${SANS};font-size:13px;font-weight:600;line-height:1;color:#fbf9f5;text-decoration:none;">
                        Responder a ${escapeHtml(shortName)} &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Pie -->
            <tr>
              <td style="background-color:#fbf9f5;border:1px solid #e3ddd3;border-top:0;border-radius:0 0 12px 12px;padding:17px 30px;">
                <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:#9a938a;">
                  Enviado desde el formulario de <strong style="color:#716b63;">sivep.tech</strong>
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:16px 0 0;font-family:${SANS};font-size:10px;letter-spacing:0.4px;color:#9a938a;">
            SIVEP Tech · Sistemas a la medida
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "SIVEP TECH — NUEVA IDEA DE SISTEMA",
    fecha,
    "",
    `Nombre: ${idea.name}`,
    idea.business ? `Negocio: ${idea.business}` : null,
    `Correo: ${idea.email}`,
    idea.phone ? `Teléfono: ${idea.phone}` : null,
    idea.businessType ? `Tipo de negocio: ${idea.businessType}` : null,
    "",
    "LA IDEA",
    "----------------------------------------",
    idea.message,
    "----------------------------------------",
    "",
    `Responde a ${idea.email} para escribirle directo.`,
    "",
    // "Enviado desde el formulario de sivep.tech · Bogotá, Colombia",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const attachments = hasLogo
    ? [
        {
          filename: "sivep-tech.png",
          path: LOGO_PATH,
          cid: LOGO_CID,
        },
      ]
    : [];

  return { subject, text, html, attachments };
}

/**
 * Envía al buzón de SIVEP Tech la idea de sistema que dejó una persona.
 * Devuelve false si el correo aún no está configurado.
 */
export async function sendContactIdea(idea) {
  const mailer = getTransporter();
  if (!mailer) return false;

  const { subject, text, html, attachments } = buildIdeaEmail(idea);

  await mailer.sendMail({
    from: `"${config.mail.fromName}" <${config.mail.user}>`,
    to: config.mail.to,
    replyTo: idea.email,
    subject,
    text,
    html,
    attachments,
  });

  return true;
}
