const nodemailer = require('nodemailer');
const smsAlerts = require('./smsAlerts');

let transporter = null;
let warnedDisabled = false;

// Static recipients from backend/.env (admin / village officer inboxes).
const envRecipients = () =>
  String(process.env.ALERT_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const isConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false }
    });
  }
  return transporter;
};

const row = (label, value) =>
  `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0;background:#f8fafc;">${label}</td>` +
  `<td style="padding:6px 12px;border:1px solid #e2e8f0;font-weight:600;">${value}</td></tr>`;

const recommendationsBlock = (recommendations = []) => {
  if (!recommendations.length) return '';
  const items = recommendations
    .map(
      (r) => `
      <li style="margin:0 0 8px;">
        <strong>${r.en}</strong><br/>
        <span style="color:#64748b;">${r.mr}</span>
      </li>`
    )
    .join('');
  return `
        <h3 style="margin:18px 0 6px;font-size:15px;color:#0f172a;">✅ What you should do / काय करावे</h3>
        <ul style="margin:0;padding-left:20px;font-size:14px;color:#334155;">${items}</ul>`;
};

const deliver = (mail, label) => {
  const mailer = getTransporter();
  const to = mail.to;
  if (!mailer) {
    // Demo mode: show exactly what would have been sent, every time.
    console.log(`[Email demo] ${label} → ${to}`);
    console.log(`  Subject: ${mail.subject}`);
    console.log(`  ${String(mail.text || '').split('\n').slice(0, 4).join(' | ')}`);
    return Promise.resolve({ demo: true });
  }
  return mailer
    .sendMail(mail)
    .then((info) => {
      console.log(`${label} sent to ${to} (${info.response || 'sent'})`);
      return info;
    })
    .catch((err) => {
      console.error(`${label} failed:`, err.message);
      return null;
    });
};

// ================= CRITICAL WATER QUALITY ALERT =================
// `recipients` = registered subscriber emails + env ALERT_EMAIL_TO addresses.
const sendCriticalAlert = ({ parameter, value, min, max, message, recommendations = [], recipients }) => {
  const to = (recipients && recipients.length ? recipients : envRecipients()).join(', ');
  if (!to) {
    if (!warnedDisabled) {
      console.log('No alert recipients yet — nobody is registered for critical alerts.');
      warnedDisabled = true;
    }
    return Promise.resolve(null);
  }

  const stamp = new Date().toLocaleString();
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;">
      <div style="background:#dc2626;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">🚨 CRITICAL Water Quality Alert</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:.9;">Nagaon Well · नागाव विहीर</p>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:16px 18px;border-radius:0 0 8px 8px;">
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          ${row('Parameter', parameter)}
          ${row('Measured value', value)}
          ${row('Safe range', `${min} – ${max}`)}
          ${row('Detected at', stamp)}
        </table>
        <p style="margin:14px 0 0;color:#475569;">${message || ''}</p>
        ${recommendationsBlock(recommendations)}
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
          Sent automatically by EnviroSense · Nagaon river basin water quality monitoring
        </p>
      </div>
    </div>`;

  return deliver(
    {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'EnviroSense <alerts@envirosense.local>',
      to,
      subject: `[EnviroSense CRITICAL] ${parameter} = ${value} (safe ${min}-${max}) — what to do inside`,
      text:
        `CRITICAL water quality alert — Nagaon Well.\n` +
        `Parameter: ${parameter}\nMeasured: ${value}\nSafe range: ${min} - ${max}\nTime: ${stamp}\n\n` +
        `${message || ''}\n\nWHAT YOU SHOULD DO / काय करावे:\n` +
        (recommendations || []).map((r) => `- ${r.en}\n  ${r.mr}`).join('\n'),
      html
    },
    'Critical alert email'
  );
};

// ================= REGISTRATION WELCOME EMAIL =================
const sendWelcomeEmail = ({ to, name }) => {
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;">
      <div style="background:#0ea5e9;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">🌊 You are registered for Water Quality Alerts</h2>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:16px 18px;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 10px;font-size:14px;">Hello <strong>${name}</strong>,</p>
        <p style="margin:0 0 10px;font-size:14px;">
          Your email is registered for critical water quality alerts from the
          <strong>Nagaon Well</strong> monitoring station.
        </p>
        <ul style="font-size:14px;color:#334155;padding-left:20px;margin:0 0 10px;">
          <li>🚨 Instant email when pH, TDS or Turbidity goes critical</li>
          <li>✅ Recommendations on what to do — in English and मराठी</li>
        </ul>
        <p style="margin:0;font-size:14px;">नागाव विहीर — जब जलगुणवत्ता अत्यंत विकट असेल तेव्हा आपल्याला तात्काळ ईमेल आणि SMS अलर्ट मिळतील.</p>
        <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">EnviroSense · Nagaon river basin water quality monitoring</p>
      </div>
    </div>`;

  return deliver(
    {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'EnviroSense <alerts@envirosense.local>',
      to,
      subject: '✅ Registered for EnviroSense critical water alerts — नागाव विहीर',
      text:
        `Hello ${name},\n\nYou are registered for critical water quality alerts from Nagaon Well.\n` +
        `You will receive an instant email when pH, TDS or Turbidity goes critical,\n` +
        `with recommendations on what to do (English + मराठी).\n\nEnviroSense`,
      html
    },
    'Welcome email'
  );
};

const register = (app) => {
  app.get('/api/email-alert-status', (req, res) => {
    res.json({
      data: {
        email: isConfigured() ? 'configured' : 'demo',
        recipients: envRecipients().length,
        sms: smsAlerts.isConfigured() ? 'configured' : 'demo',
        host: process.env.SMTP_HOST || null
      }
    });
  });
};

module.exports = { sendCriticalAlert, sendWelcomeEmail, envRecipients, isConfigured, register };
