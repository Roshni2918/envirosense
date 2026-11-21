// SMS notifications for registered mobile numbers (critical water alerts).
//
// Configure an SMS gateway in backend/.env to send real messages, e.g. Twilio:
//   SMS_PROVIDER=twilio
//   TWILIO_ACCOUNT_SID=ACxxxxxxxx
//   TWILIO_AUTH_TOKEN=xxxxxxxx
//   SMS_FROM=+91XXXXXXXXXX
//
// Without configuration the service runs in DEMO mode: every SMS is logged in
// full so the notification flow stays visible without a paid gateway.

const isConfigured = () =>
  process.env.SMS_PROVIDER === 'twilio' &&
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.SMS_FROM);

// Accept 10-digit Indian numbers with or without +91 / 0 prefix.
const normalize = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${local}`;
};

const sendSms = async ({ to, body }) => {
  if (!to || !body) return { sent: false, skipped: 'missing to/body' };
  const number = normalize(to);

  if (!isConfigured()) {
    console.log(`[SMS demo] to ${number}: ${body}`);
    return { sent: false, demo: true, to: number };
  }

  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const params = new URLSearchParams({
      From: process.env.SMS_FROM,
      To: number,
      Body: body
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    console.log(`SMS sent to ${number} (${data.sid || 'ok'})`);
    return { sent: true, to: number, sid: data.sid };
  } catch (err) {
    console.error(`SMS to ${number} failed: ${err.message}`);
    return { sent: false, to: number, error: err.message };
  }
};

module.exports = { sendSms, isConfigured, normalize };
