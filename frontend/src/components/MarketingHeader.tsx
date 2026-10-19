import Link from "next/link";
import { publicContact } from "@/lib/publicContact";
import { siteBrand } from "@/lib/siteBrand";
import ServicesDropdown from "@/components/ServicesDropdown";

const ROOT = "/";

export function MarketingHeader({ home = false }: { home?: boolean }) {
  const href = (anchor: string) => home ? "#" + anchor : "/#" + anchor;

  return (
    <header className="lms-landing-header">
      <div className="lms-landing-container lms-landing-nav">
        <Link href="/" className="lms-landing-brand" aria-label={`${siteBrand.fullName} homepage`}>
          <span className="lms-landing-brand-symbol">
            <i className="bi bi-mortarboard-fill" aria-hidden="true" style={{fontSize:27}} />
          </span>
          <span><strong>{siteBrand.shortName}</strong></span>
        </Link>

        <nav className="lms-landing-nav-links" aria-label="Main navigation">
          <Link href={home ? "#top" : ROOT}>Home</Link>
          <ServicesDropdown />
          <Link href="/tutor-hiring" className="lms-nav-tutor-hiring">
            <i className="bi bi-person-plus" aria-hidden="true" /> Tutor Hiring
          </Link>
          <Link href="/fee-structure">Fee Structure</Link>
          <Link href={href("features")}>LMS Features</Link>
          <Link href={href("portals")}>Portals</Link>
          <Link href={href("contact")}>Contact</Link>
        </nav>
        <Link href={href("portals")} className="lms-landing-button lms-landing-button-small">
          Login <i className="bi bi-arrow-right" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="lms-landing-footer">
      <div className="lms-landing-container lms-landing-footer-inner">
        <div>
          <Link href="/" className="lms-landing-brand">
            <span className="lms-landing-brand-symbol">
              <i className="bi bi-mortarboard-fill" aria-hidden="true" style={{fontSize:23}} />
            </span>
            <span><strong>{siteBrand.shortName}</strong></span>
          </Link>
          <p><strong>{siteBrand.name}</strong> offers school and college management software, one-to-one online tutoring and group classes for students.</p>
          <address className="lms-footer-contact" aria-label={`${siteBrand.shortName} contact details`}>
            <a href={publicContact.phoneHref}>
              <i className="bi bi-telephone" aria-hidden="true" />
              <span>{publicContact.phoneDisplay}</span>
            </a>
            <a href={publicContact.emailHref}>
              <i className="bi bi-envelope" aria-hidden="true" />
              <span>{publicContact.email}</span>
            </a>
            <div className="lms-footer-contact-address">
              <i className="bi bi-geo-alt" aria-hidden="true" />
              <span>{publicContact.address}</span>
            </div>
          </address>
        </div>
        <nav aria-label="Service and platform links">
          <Link href="/">Home</Link>
          <Link href="/services/online-tutoring">Online Tutoring</Link>
          <Link href="/services/school-college-lms">School &amp; College LMS</Link>
          <Link href="/fee-structure">Fee Structure</Link>
          <Link href="/#features">LMS Features</Link>
          <Link href="/#portals">Portal Logins</Link>
        </nav>
        <nav aria-label="Information and contact links">
          <Link href="/#why-choose-us">Why Choose Us</Link>
          <Link href="/#testimonials">Community Feedback</Link>
          <Link href="/#faq">FAQs</Link>
          <Link href="/tutor-hiring">Tutor Hiring</Link>
          <Link href="/#contact">Contact Us</Link>
        </nav>
      </div>
      <div className="lms-landing-container lms-landing-footer-bottom">
        <span>© {new Date().getFullYear()} {siteBrand.fullName}. All rights reserved.</span>
        <span>School &amp; College LMS · Online Tutoring</span>
      </div>
    </footer>
  );
}
