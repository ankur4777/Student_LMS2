"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SlideId = "tutoring" | "management";

const slides = [
  {
    id: "tutoring" as SlideId,
    tab: "Online tutoring",
    eyebrow: "LIVE ONLINE TUTORING · GRADES 7–12",
    title: "Learning that fits",
    accent: "your ambition.",
    description: "Personalized one-to-one and group online classes for students in Grades 7–12. Build confidence with live teaching, homework help and assignment support.",
    primary: { text: "Explore Online Tutoring", href: "/services/online-tutoring" },
    secondary: { text: "View Tuition Fees", href: "/fee-structure" },
    highlights: ["Grades 7–12", "One-to-one & group", "Homework & assignments"],
  },
  {
    id: "management" as SlideId,
    tab: "School & College LMS",
    eyebrow: "CONNECTED ACADEMIC MANAGEMENT",
    title: "Every academic day,",
    accent: "better organized.",
    description: "Bring students, teachers, attendance, live classes, fees, exams and academic records into one connected management platform for schools and colleges.",
    primary: { text: "Explore MySLS Platform", href: "/services/school-college-lms" },
    secondary: { text: "Request a Consultation", href: "/#contact" },
    highlights: ["Role-based portals", "Academic operations", "Connected records"],
  },
] as const;

function TutoringPreview() {
  return (
    <div className="mysls-hero__window-content">
      <div className="mysls-hero__window-heading">
        <div><span className="mysls-hero__kicker">PERSONALIZED LEARNING</span><h2>Learn with confidence.</h2></div>
        <span className="mysls-hero__status"><i className="bi bi-camera-video-fill" aria-hidden="true" /> Live classes</span>
      </div>
      <div className="mysls-hero__preview-grid">
        <div className="mysls-hero__lesson-video">
          <span className="mysls-hero__video-spark" aria-hidden="true"><i className="bi bi-stars" /></span>
          <span className="mysls-hero__video-person" aria-hidden="true"><i className="bi bi-person-video3" /></span>
          <span className="mysls-hero__video-caption"><span className="mysls-hero__green-dot" /> Interactive online tutoring</span>
        </div>
        <div className="mysls-hero__preview-card">
          <span className="mysls-hero__kicker">SESSION PLAN</span>
          <h3>Understand. Practice. Grow.</h3>
          <p><i className="bi bi-check-circle-fill" aria-hidden="true" /> Clear concept lessons</p>
          <p><i className="bi bi-check-circle-fill" aria-hidden="true" /> Guided practice</p>
          <p><i className="bi bi-check-circle-fill" aria-hidden="true" /> Ask your questions</p>
        </div>
      </div>
      <div className="mysls-hero__window-footer">
        <span className="mysls-hero__footer-icon"><i className="bi bi-journal-check" aria-hidden="true" /></span>
        <div><strong>Support beyond the classroom</strong><span>Tuition · Homework help · Assignments</span></div>
        <i className="bi bi-arrow-up-right" aria-hidden="true" />
      </div>
    </div>
  );
}

function ManagementPreview() {
  const modules = [
    { icon: "people-fill", title: "Students & enrollment", detail: "Organize academic records" },
    { icon: "calendar2-check", title: "Attendance & classes", detail: "Keep teaching on track" },
    { icon: "file-earmark-text", title: "Assignments & exams", detail: "Manage learning progress" },
  ];
  return (
    <div className="mysls-hero__window-content">
      <div className="mysls-hero__window-heading">
        <div><span className="mysls-hero__kicker">COLLEGE ADMIN WORKSPACE</span><h2>Everything in one place.</h2></div>
        <span className="mysls-hero__status"><i className="bi bi-shield-check" aria-hidden="true" /> Secure portals</span>
      </div>
      <div className="mysls-hero__preview-grid mysls-hero__preview-grid--admin">
        <div className="mysls-hero__module-list">
          {modules.map((module) => (
            <div className="mysls-hero__module" key={module.title}>
              <span className="mysls-hero__module-icon"><i className={"bi bi-" + module.icon} aria-hidden="true" /></span>
              <div><strong>{module.title}</strong><span>{module.detail}</span></div>
              <i className="bi bi-chevron-right" aria-hidden="true" />
            </div>
          ))}
        </div>
        <div className="mysls-hero__preview-card mysls-hero__insights">
          <span className="mysls-hero__kicker">ACADEMIC OVERVIEW</span>
          <h3>Keep progress in view</h3>
          <div className="mysls-hero__chart" aria-hidden="true">
            {[48, 65, 58, 82, 68, 90, 76].map((height, i) => <span key={i} style={{ height: height + "%" }} />)}
          </div>
          <small><span className="mysls-hero__green-dot" /> Connected reporting</small>
        </div>
      </div>
      <div className="mysls-hero__window-footer">
        <span className="mysls-hero__footer-icon"><i className="bi bi-buildings-fill" aria-hidden="true" /></span>
        <div><strong>Built for schools and colleges</strong><span>Admin · Teacher · Student · Parent portals</span></div>
        <i className="bi bi-arrow-up-right" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function HomeHeroCarousel() {
  const [active, setActive] = useState<SlideId>("tutoring");
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const slide = slides.find((item) => item.id === active) ?? slides[0];

  useEffect(() => {
    if (paused || interacting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      setActive((old) => old === "tutoring" ? "management" : "tutoring");
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [active, paused, interacting]);

  const nextSlide = () => setActive((old) => old === "tutoring" ? "management" : "tutoring");

  return (
    <section
      className={"mysls-hero mysls-hero--" + active}
      aria-label="MySLS online tutoring and school management services"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
      }}
    >
      <div className="lms-landing-container mysls-hero__inner">
        <div className="mysls-hero__copy" key={active}>
          <span className="mysls-hero__eyebrow"><i className="bi bi-stars" aria-hidden="true" /> {slide.eyebrow}</span>
          <h1><span>{slide.title}</span><span className="mysls-hero__accent">{slide.accent}</span></h1>
          <p className="mysls-hero__description">{slide.description}</p>
          <div className="mysls-hero__actions">
            <Link href={slide.primary.href} className="mysls-hero__button mysls-hero__button--primary">{slide.primary.text}<i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
            <Link href={slide.secondary.href} className="mysls-hero__button mysls-hero__button--secondary">{slide.secondary.text}</Link>
          </div>
          <div className="mysls-hero__highlights">
            {slide.highlights.map((item) => <span key={item}><i className="bi bi-check-circle-fill" aria-hidden="true" />{item}</span>)}
          </div>
        </div>
        <div className="mysls-hero__visual" key={"visual-" + active}>
          <div className="mysls-hero__visual-tabs" aria-hidden="true">
            {(active === "tutoring" ? ["Live classes", "Practice", "Study support"] : ["Academics", "Attendance", "Results"]).map((tab, i) => <span key={tab} className={i === 0 ? "is-current" : ""}>{tab}</span>)}
          </div>
          <div className="mysls-hero__window" aria-label={active === "tutoring" ? "Illustrative online tutoring workspace" : "Illustrative MySLS college management workspace"}>
            <div className="mysls-hero__window-bar">
              <span className="mysls-hero__traffic" aria-hidden="true"><i /><i /><i /></span>
              <span className="mysls-hero__window-address">{active === "tutoring" ? "My learning space" : "MySLS · College overview"}</span>
              <i className="bi bi-mortarboard-fill" aria-hidden="true" />
            </div>
            {active === "tutoring" ? <TutoringPreview /> : <ManagementPreview />}
            <div className="mysls-hero__preview-disclaimer">Illustrative preview · Not live student records</div>
          </div>
          <div className="mysls-hero__floating-note"><i className="bi bi-lightning-charge-fill" aria-hidden="true" />{active === "tutoring" ? "Learn with dedicated support" : "One connected workspace"}</div>
        </div>
      </div>
      <div className="lms-landing-container mysls-hero__nav">
        <div className="mysls-hero__selectors" role="group" aria-label="Select hero slide">
          {slides.map((item, i) => (
            <button type="button" key={item.id} onClick={() => setActive(item.id)} aria-pressed={active === item.id} className={"mysls-hero__selector" + (active === item.id ? " is-active" : "")}>
              <span>0{i + 1}</span>{item.tab}
            </button>
          ))}
        </div>
        <div className="mysls-hero__controls">
          <span className="mysls-hero__counter">{active === "tutoring" ? "01" : "02"} / 02</span>
          <button type="button" onClick={() => setPaused((old) => !old)} aria-label={paused ? "Resume automatic slide changes" : "Pause automatic slide changes"} className="mysls-hero__circle-button"><i className={"bi bi-" + (paused ? "play-fill" : "pause-fill")} aria-hidden="true" /></button>
          <button type="button" onClick={nextSlide} aria-label={active === "tutoring" ? "Show school and college management slide" : "Show online tutoring slide"} className="mysls-hero__circle-button mysls-hero__circle-button--next"><i className="bi bi-arrow-right" aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  );
}
