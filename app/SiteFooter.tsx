const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61591769009057",
    icon: "facebook",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/joystageproductions",
    icon: "instagram",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@joystageproductions",
    icon: "tiktok",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@joystageproductions",
    icon: "youtube",
  },
] as const;

function SocialIcon({ icon }: { icon: (typeof socialLinks)[number]["icon"] }) {
  switch (icon) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.25 8.2V6.9c0-.63.42-.78.72-.78h1.83V3.08L14.28 3c-2.8 0-3.44 2.09-3.44 3.43V8.2H8.65v3.12h2.19V21h3.41v-9.68h2.3l.3-3.12h-2.6z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="4" width="16" height="16" rx="4.6" />
          <circle cx="12" cy="12" r="3.45" />
          <circle cx="16.9" cy="7.15" r="1" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.35 3c.2 1.62 1.12 3.08 2.52 3.94.82.5 1.76.77 2.73.79v3.24a7.44 7.44 0 0 1-5.14-1.84v5.83a6.02 6.02 0 1 1-5.98-6.02c.38 0 .76.04 1.12.11v3.38a2.74 2.74 0 1 0 1.72 2.53V3h3.03z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M21.3 7.35a3.02 3.02 0 0 0-2.13-2.14C17.29 4.7 12 4.7 12 4.7s-5.29 0-7.17.51A3.02 3.02 0 0 0 2.7 7.35 31.44 31.44 0 0 0 2.2 12c0 1.56.17 3.1.5 4.65a3.02 3.02 0 0 0 2.13 2.14c1.88.51 7.17.51 7.17.51s5.29 0 7.17-.51a3.02 3.02 0 0 0 2.13-2.14c.33-1.55.5-3.09.5-4.65s-.17-3.1-.5-4.65zM10.05 15.47V8.53L15.9 12l-5.85 3.47z" />
        </svg>
      );
  }
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <strong className="footer__brand">Joy Stage Productions LLC</strong>
          <div>Event landing page concept for Beks Battalion.</div>
          <div className="footer__legal">
            <a className="footer__privacy" href="/privacy">
              Privacy Policy
            </a>
            <a className="footer__privacy" href="/terms">
              Terms And Conditions
            </a>
          </div>
        </div>

        <div className="footer__social" aria-label="Social links">
          {socialLinks.map((social) => (
            <a
              key={social.label}
              className="social"
              href={social.href}
              aria-label={social.label}
              target="_blank"
              rel="noreferrer"
            >
              <SocialIcon icon={social.icon} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
