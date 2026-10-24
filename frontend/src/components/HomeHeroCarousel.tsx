"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

type SlideId = "tutoring" | "management";
const ROTATION_MS = 6500;

const slides = [
  {
    id: "tutoring" as SlideId,
    label: "Online Tutoring",
    eyebrow: "LEARN WITH MySLS",
    heading: "Personalized learning,",
    emphasis: "real progress.",
    description:
      "One-to-one and group online tutoring for Grades 7–12. Learn directly with a tutor, strengthen your concepts, and get guidance with homework and assignments.",
    action: { text: "Explore Online Tutoring", href: "/services/online-tutoring" },
    secondary: { text: "View Tuition Fees", href: "/fee-structure" },
    highlights: ["Live interactive classes", "One-to-one & group sessions", "Homework support"],
  },
  {
    id: "management" as SlideId,
    label: "School & College LMS",
    eyebrow: "MANAGE WITH MySLS",
    heading: "One platform.",
    emphasis: "Every academic need.",
    description:
      "Simplify school and college operations with connected tools for students, teachers, classes, attendance, examinations, fees and academic records.",
    action: { text: "Explore School & College LMS", href: "/services/school-college-lms" },
    secondary: { text: "Talk to Our Team", href: "/#contact" },
    highlights: ["Four dedicated portals", "Academic management", "Organized records"],
  },
] as const;

function TutoringArtwork() {
  return (
    <div className="mysls-hero-art mysls-hero-art--tutoring" aria-label="Student attending a live online tutoring session">
      <div className="mysls-hero-art__halo" aria-hidden="true" />
      <span className="mysls-hero-art__spark mysls-hero-art__spark--one" aria-hidden="true">✳</span>
      <span className="mysls-hero-art__spark mysls-hero-art__spark--two" aria-hidden="true">✦</span>
      <div className="mysls-hero-art__photo-frame">
        <Image
          src="/online-tutoring-hero.avif"
          alt="Student writing study notes while joining an online class on her laptop"
          width={480}
          height={270}
          priority
          sizes="(max-width: 850px) 85vw, 40vw"
          className="mysls-hero-art__photo"
        />
      </div>
      <div className="mysls-hero-art__badge mysls-hero-art__badge--top">
        <span className="mysls-hero-art__badge-icon"><i className="bi bi-camera-video-fill" aria-hidden="true" /></span>
        <div><strong>Interactive lessons</strong><span>Online, from anywhere</span></div>
      </div>
      <div className="mysls-hero-art__badge mysls-hero-art__badge--bottom">
        <span className="mysls-hero-art__badge-icon"><i className="bi bi-check2-circle" aria-hidden="true" /></span>
        <div><strong>Personal attention</strong><span>Guidance that fits you</span></div>
      </div>
    </div>
  );
}

function ManagementArtwork() {
  const roles = [
    { icon: "building-fill", name: "College Admin", text: "Manage operations" },
    { icon: "person-workspace", name: "Teacher", text: "Organize teaching" },
    { icon: "mortarboard-fill", name: "Student", text: "Access learning" },
    { icon: "people-fill", name: "Parent", text: "Stay informed" },
  ];

  return (
    <div className="mysls-hero-art mysls-hero-art--management" aria-label="Illustration of the connected MySLS management portals">
      <div className="mysls-hero-art__halo" aria-hidden="true" />
      <span className="mysls-hero-art__spark mysls-hero-art__spark--one" aria-hidden="true">✦</span>
      <div className="mysls-hero-art__campus-panel">
        <div className="mysls-hero-art__campus-head">
          <span className="mysls-hero-art__campus-brand"><i className="bi bi-mortarboard-fill" aria-hidden="true" /> MySLS</span>
          <span className="mysls-hero-art__campus-tag">ONE CONNECTED LMS</span>
        </div>
        <h2>One place for your institution.</h2>
        <p>Purpose-built spaces for every part of learning.</p>
        <div className="mysls-hero-art__roles">
          {roles.map((role) => (
            <div className="mysls-hero-art__role" key={role.name}>
              <span className="mysls-hero-art__role-icon"><i className={"bi bi-" + role.icon} aria-hidden="true" /></span>
              <div><strong>{role.name}</strong><span>{role.text}</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="mysls-hero-art__badge mysls-hero-art__badge--top mysls-hero-art__badge--management">
        <span className="mysls-hero-art__badge-icon"><i className="bi bi-calendar2-check" aria-hidden="true" /></span>
        <div><strong>Attendance & classes</strong><span>One organized workflow</span></div>
      </div>
      <div className="mysls-hero-art__badge mysls-hero-art__badge--bottom">
        <span className="mysls-hero-art__badge-icon"><i className="bi bi-file-earmark-bar-graph" aria-hidden="true" /></span>
        <div><strong>Academic insights</strong><span>Keep progress in view</span></div>
      </div>
    </div>
  );
}

export default function HomeHeroCarousel() {
  const [active, setActive] = useState<SlideId>("tutoring");
  const [paused, setPaused] = useState(false);
  const slide = slides.find((item) => item.id === active) ?? slides[0];

  // Deliberately continue autoplay on hover/focus. The visitor can pause explicitly.
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      setActive((previous) => previous === "tutoring" ? "management" : "tutoring");
    }, ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused]);

  const switchSlide = (id: SlideId) => setActive(id);
  const nextSlide = () => switchSlide(active === "tutoring" ? "management" : "tutoring");

  return (
    <section className={"mysls-hero mysls-hero--" + active} aria-label="MySLS online tutoring and academic management">
      <div className="lms-landing-container mysls-hero__layout">
        <div className="mysls-hero__copy" key={active}>
          <span className="mysls-hero__eyebrow"><i className="bi bi-mortarboard-fill" aria-hidden="true" /> {slide.eyebrow}</span>
          <h1>{slide.heading} <span>{slide.emphasis}</span></h1>
          <p className="mysls-hero__intro">{slide.description}</p>
          <div className="mysls-hero__actions">
            <Link className="mysls-hero__cta" href={slide.action.href}>{slide.action.text}<i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
            <Link className="mysls-hero__cta mysls-hero__cta--outline" href={slide.secondary.href}>{slide.secondary.text}</Link>
          </div>
          <div className="mysls-hero__benefits">
            {slide.highlights.map((text) => <span key={text}><i className="bi bi-check-circle-fill" aria-hidden="true" /> {text}</span>)}
          </div>
        </div>
        <div className="mysls-hero__illustration" key={"art-" + active}>
          {active === "tutoring" ? <TutoringArtwork /> : <ManagementArtwork />}
        </div>
      </div>
      <div className="lms-landing-container mysls-hero__footer">
        <div className="mysls-hero__tabs" role="group" aria-label="Choose a homepage slide">
          {slides.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={active === item.id}
              onClick={() => switchSlide(item.id)}
              className={"mysls-hero__tab" + (active === item.id ? " is-current" : "") + (paused ? " is-paused" : "")}
            >
              <span className="mysls-hero__tab-number">0{index + 1}</span>
              <span>{item.label}</span>
              <span className="mysls-hero__tab-track" aria-hidden="true"><span key={active === item.id ? "active" : "inactive"} /></span>
            </button>
          ))}
        </div>
        <div className="mysls-hero__controls">
          <button className="mysls-hero__control" type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume automatic hero slideshow" : "Pause automatic hero slideshow"}>
            <i className={"bi bi-" + (paused ? "play-fill" : "pause-fill")} aria-hidden="true" />
          </button>
          <button className="mysls-hero__control mysls-hero__control--next" type="button" onClick={nextSlide} aria-label={active === "tutoring" ? "Next slide: school and college management" : "Next slide: online tutoring"}>
            <i className="bi bi-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
