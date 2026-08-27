import { sponsorLogos } from "@/lib/sponsors";

type SponsorLogoFooterProps = {
  backHref?: string;
  packageLinkPlacement?: "afterSponsorCopy" | "afterLogoHeadline";
};

export function SponsorLogoFooter({
  backHref = "#hero",
}: SponsorLogoFooterProps) {
  const sponsorPackageLink = (
    <a className="cta cta--outline-gold sponsor-cta__package-link" href="/sponsors">
      Sponsor Packages
    </a>
  );

  return (
    <div className="panel sponsor-cta sponsor-cta--footer">
      <div className="sponsor-cta__stack">
        <p className="sponsor-cta__sponsor-copy">
          For more information about becoming a sponsor of our show: click below.
        </p>
        {sponsorPackageLink}
        <div className="sponsor-cta__logos" aria-label="Current sponsor logos">
          {sponsorLogos.map((sponsor) => {
            const logo = (
              <img
                className={`sponsor-cta__logo ${sponsor.wide ? "sponsor-cta__logo--wide" : ""} ${
                  sponsor.luna ? "sponsor-cta__logo--luna" : ""
                }`}
                src={sponsor.src}
                alt={sponsor.name}
              />
            );

            if (!sponsor.href) {
              return (
                <span key={sponsor.name} className="sponsor-cta__logo-link sponsor-cta__logo-link--static">
                  {logo}
                </span>
              );
            }

            return (
              <a
                key={sponsor.name}
                className="sponsor-cta__logo-link"
                href={sponsor.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${sponsor.name}`}
              >
                {logo}
              </a>
            );
          })}
        </div>
        <div className="sponsor-cta__current">CLICK SPONSOR LOGOS FOR MORE INFORMATION ABOUT THEM</div>
      </div>
      <div className="sponsor-cta__actions">
        <a className="cta cta--outline-gold" href={backHref}>
          Back to Top
        </a>
        <a className="cta cta--outline-gold" href="/">
          Back to Home
        </a>
      </div>
    </div>
  );
}
