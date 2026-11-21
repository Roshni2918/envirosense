import { useTranslation } from "react-i18next";

// Admin WhatsApp number (India +91)
const WHATSAPP_NUMBER = "918605052931";

// Floating "Chat on WhatsApp" button — shown on every page.
// Opens wa.me chat with the admin, prefilled with a bilingual query message.
function WhatsAppButton() {
  const { t } = useTranslation();
  const message = encodeURIComponent(t("waMessage"));
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

  return (
    <a
      className="whatsapp-float"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("waLabel")}
      title={t("waLabel")}
      data-testid="whatsapp-button"
    >
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.6c1.7.9 3.6 1.4 5.6 1.4h.2c6.6 0 12-5.4 12-12S22.6 3 16 3zm0 22c-1.7 0-3.4-.5-4.9-1.3l-.4-.2-4.9 1 1-4.7-.3-.4C5.4 18 4.9 16.5 4.9 15 4.9 9 9.9 4 16 4s11.1 5 11.1 11S22.1 25 16 25zm6.1-8.3c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1.1-1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.8-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9 0 1.7 1.2 3.3 1.4 3.5.2.2 2.4 3.7 5.9 5.1.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4z"
        />
      </svg>
      <span className="whatsapp-float-text">{t("waLabel")}</span>
    </a>
  );
}

export default WhatsAppButton;
