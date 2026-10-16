import type { Metadata } from "next";
import TutorApplicationForm from "@/components/TutorApplicationForm";
import {
  CTA, FAQ, PortalCards, PublicSite, SectionHeading,
  SiteButton,
} from "@/components/public-site/PublicSite";

export const metadata: Metadata = {
  title: "Get Started | Student LMS Portals",
  description:
    "Choose your Student LMS student, teacher, college admin or parent portal. Educators can also submit a teaching interest application.",
};

export default function GetStartedPage() {
  return (
    <PublicSite>
      <section className="sl-section sl-section-soft" id="portals">
        <div className="sl-container">
          <div className="sl-section-heading sl-center">
            <span className="sl-label">Let's get you connected</span>
            <h2 style={{fontSize:"clamp(39px,5vw,64px)",maxWidth:850,marginInline:"auto"}}>
              The right place to start is right here.
            </h2>
            <p style={{maxWidth:720,marginInline:"auto"}}>
              Choose the portal that matches your role and continue with your
              institution-managed account. Students, teachers, parents and
              college administrators each have a dedicated workspace.
            </p>
          </div>
          <PortalCards withImages />
          <div className="sl-note-box" style={{marginTop:26}}>
            <strong>Already have an account?</strong> Choose your portal above and sign in.
            Your institution manages student, staff and parent access. If you
            need an account or cannot log in, please contact your college.
          </div>
        </div>
      </section>

      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading
            eyebrow="Getting set up"
            title="Three steps to your Student LMS workspace."
            center
          />
          <div className="sl-step-grid">
            <article className="sl-step">
              <span className="sl-step-num">01</span>
              <h3>Find your role</h3>
              <p>Select the login for your institution-assigned Student, Teacher, College Admin or Parent account.</p>
            </article>
            <article className="sl-step">
              <span className="sl-step-num">02</span>
              <h3>Sign in</h3>
              <p>Use your authorized account credentials, or choose Forgot Password if you need help recovering access.</p>
            </article>
            <article className="sl-step">
              <span className="sl-step-num">03</span>
              <h3>Make it your space</h3>
              <p>Open the classes, academic information and features your institution has enabled for you.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="sl-section sl-section-soft" id="teach-with-us">
        <div className="sl-container sl-split">
          <div className="sl-split-copy">
            <span className="sl-label">Teach with us</span>
            <h2>Great learning deserves passionate educators.</h2>
            <p>Interested in sharing your knowledge with students? Tell us a little about your teaching background, the subjects you can support and the experience you bring.</p>
            <p>The existing Student LMS tutor application form is available here. Submitting an application expresses interest; it does not create a teacher portal account or guarantee a teaching opportunity.</p>
            <ul className="sl-inline-list">
              <li><span aria-hidden="true">✓</span> Share your qualifications and teaching experience.</li>
              <li><span aria-hidden="true">✓</span> Tell us the subjects and levels you can teach.</li>
              <li><span aria-hidden="true">✓</span> Submit your details for review.</li>
            </ul>
            <div className="sl-note-box">If you already teach at a participating institution, use your assigned <strong>Teacher Portal</strong> account instead.</div>
            <div className="sl-actions">
              <SiteButton href="/teacher/login" outline>Teacher Login</SiteButton>
            </div>
          </div>
          <TutorApplicationForm />
        </div>
      </section>

      <section className="sl-section sl-section-white">
        <div className="sl-container sl-faq-layout">
          <SectionHeading
            eyebrow="A few helpful answers"
            title="Need help getting started?"
            description="Here are the basics for finding and using the right account."
          />
          <FAQ items={[
            {
              question: "Can I create a new Student LMS student account here?",
              answer: "Student and other role-based accounts are managed by the college or institution. Ask your administrator for your account details or enrollment information.",
            },
            {
              question: "What if I forgot my password?",
              answer: "Open the correct login page and select Forgot Password. Follow the recovery instructions sent to the email registered with your account, or ask your institution for assistance.",
            },
            {
              question: "Is the tutor application the same as teacher login?",
              answer: "No. The application form is for educators interested in teaching opportunities. Teacher Portal accounts are assigned and managed by the institution.",
            },
            {
              question: "Why can't I see a certain feature after signing in?",
              answer: "Your available features depend on your role, subject enrollment, your institution's settings and any applicable course or document access.",
            },
          ]} />
        </div>
      </section>

      <CTA
        title="One platform. Many ways to move forward."
        description="See what makes Student LMS useful for learning, teaching and campus organization."
        primaryHref="/features"
        primaryLabel="Explore features"
        secondaryHref="/about"
        secondaryLabel="About Student LMS"
      />
    </PublicSite>
  );
}
