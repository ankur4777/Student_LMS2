import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CTA, FAQ, FeatureCards, PortalCards, PublicSite,
  SectionHeading, SiteButton, SiteHero,
} from "@/components/public-site/PublicSite";

export const metadata: Metadata = {
  title: "Student LMS | Learning, Teaching & Campus Management",
  description:
    "Explore Student LMS for live classes, AI study help, recorded learning, online exams and connected student, teacher, parent and college portals.",
};

const features = [
  {
    icon: "✦",
    title: "AI Tutor",
    description: "Ask subject questions, review published learning notes and get study support from the student portal, within your college's access settings.",
  },
  {
    icon: "▣",
    title: "Live & recorded lessons",
    description: "Join scheduled classes and return to available recordings or learning courses when access has been granted.",
  },
  {
    icon: "✓",
    title: "Assignments & online exams",
    description: "Keep coursework, assessments, submissions and published results in the same learning workflow.",
  },
  {
    icon: "◫",
    title: "Study materials",
    description: "Find teacher-published resources for your enrolled class and subject without hunting through separate channels.",
  },
  {
    icon: "◎",
    title: "Progress that makes sense",
    description: "Review available attendance, results and class information from a dedicated student dashboard.",
  },
  {
    icon: "◇",
    title: "One connected campus",
    description: "Support college administration, teaching, students and families with role-based access to relevant information.",
  },
];

const questions = [
  {
    question: "What is Student LMS?",
    answer: "Student LMS is a learning management platform that brings academic workflows such as classes, assignments, exams, study materials, attendance and relevant communication into connected role-based portals.",
  },
  {
    question: "Can students use an AI Tutor?",
    answer: "The Student Portal includes a Subject Tutor and My Dashboard AI assistant. Availability depends on college settings and the student's enrolled subjects and permitted learning materials.",
  },
  {
    question: "How do I access my student account?",
    answer: "Use the Student Portal login. Your college provides and manages your account access. If you cannot sign in, use the password recovery option or contact your institution.",
  },
  {
    question: "Can teachers share materials and manage exams?",
    answer: "Teachers can use their own portal to publish permitted class materials, manage learning activities and support the assessments available to their assigned classes.",
  },
];

export default function Home() {
  return (
    <PublicSite>
      <SiteHero
        eyebrow="A smarter, more connected learning journey"
        title="Great learning starts with"
        highlight="the right connection."
        description="One welcoming place for students to learn, teachers to teach and colleges to stay organized. Bring classes, study resources, assessments and progress together with Student LMS."
        image="/student-lms-hero.webp"
        imageAlt="Student studying with a laptop and learning materials"
        primaryHref="/get-started"
        primaryLabel="Find your portal"
        secondaryHref="/features"
        secondaryLabel="Explore features"
        note="Made for everyday learning, on campus and beyond"
      />

      <div className="sl-band">
        <div className="sl-container sl-band-inner">
          <span><b>✦</b> Learning in one place</span>
          <span><b>✦</b> Dedicated role-based portals</span>
          <span><b>✦</b> Real academic workflows</span>
          <span><b>✦</b> Access controlled by your college</span>
        </div>
      </div>

      <section className="sl-section sl-section-white">
        <div className="sl-container">
          <SectionHeading
            eyebrow="A place for everyone"
            title="Your next step starts here."
            description="Whether you're a student, educator, administrator or parent, there's a dedicated space designed around the things you need to do."
            center
          />
          <PortalCards />
        </div>
      </section>

      <section className="sl-section sl-section-soft" id="features">
        <div className="sl-container">
          <SectionHeading
            eyebrow="Made for modern education"
            title="All the little things that make learning better."
            description="From your first class of the day to your latest results, Student LMS helps the whole campus stay on the same page."
            center
          />
          <FeatureCards items={features} />
          <div style={{textAlign:"center",marginTop:32}}>
            <SiteButton href="/features" outline>Discover all features</SiteButton>
          </div>
        </div>
      </section>

      <section className="sl-section sl-section-white">
        <div className="sl-container sl-split">
          <div className="sl-split-copy">
            <span className="sl-label">Learning that fits your day</span>
            <h2>Classroom learning, with room to grow.</h2>
            <p>
              See what's coming up, revisit available study resources and keep
              your learning moving forward. Students can use their dashboard
              for lessons, academic updates and subject-specific AI help.
            </p>
            <ul className="sl-inline-list">
              <li><span aria-hidden="true">✓</span> Join scheduled live classes.</li>
              <li><span aria-hidden="true">✓</span> Continue with accessible recorded learning.</li>
              <li><span aria-hidden="true">✓</span> Review teacher-shared material and coursework.</li>
              <li><span aria-hidden="true">✓</span> Prepare with Subject Tutor when enabled.</li>
            </ul>
            <SiteButton href="/online-learning">Explore online learning</SiteButton>
          </div>
          <div className="sl-media-frame">
            <Image
              src="/student-dashboard.webp"
              alt="Real Student LMS student dashboard preview"
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="sl-section sl-section-soft">
        <div className="sl-container">
          <SectionHeading
            eyebrow="Simple from the first step"
            title="Your learning space in three easy steps."
            description="Student LMS works with the accounts and permissions already managed by your institution."
            center
          />
          <div className="sl-step-grid">
            <div className="sl-step">
              <span className="sl-step-num">01</span>
              <h3>Choose your portal</h3>
              <p>Pick the Student, Teacher, College Admin or Parent portal that matches your role.</p>
            </div>
            <div className="sl-step">
              <span className="sl-step-num">02</span>
              <h3>Sign in securely</h3>
              <p>Use your institution-provided login to access your authorized workspace.</p>
            </div>
            <div className="sl-step">
              <span className="sl-step-num">03</span>
              <h3>Keep moving forward</h3>
              <p>Join lessons, organize class tasks and find the information relevant to you.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sl-section sl-section-white">
        <div className="sl-container sl-split">
          <div className="sl-media-frame">
            <Image
              src="/college-admin-dashboard.webp"
              alt="Real college admin dashboard preview inside Student LMS"
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
          </div>
          <div className="sl-split-copy">
            <span className="sl-label">Beyond the classroom</span>
            <h2>Give your whole institution a clearer view.</h2>
            <p>
              Student LMS isn't just for students. Administrators can coordinate
              classes, enrollments, access and academic records while teachers
              focus on lesson activities and student support.
            </p>
            <ul className="sl-inline-list">
              <li><span aria-hidden="true">✓</span> Connected classroom and section management.</li>
              <li><span aria-hidden="true">✓</span> Teacher and student workflows.</li>
              <li><span aria-hidden="true">✓</span> Feature access tailored to classes.</li>
            </ul>
            <Link href="/for-colleges" className="sl-text-link">See how colleges use Student LMS ↗</Link>
          </div>
        </div>
      </section>

      <section className="sl-section sl-section-white" id="become-a-tutor">
        <div className="sl-container sl-split">
          <div className="sl-split-copy">
            <span className="sl-label">Teach with us</span>
            <h2>Passionate about helping students learn?</h2>
            <p>Share your teaching background and subjects through our existing tutor application form. We'll review your interest and contact you if there is a suitable opportunity.</p>
            <div className="sl-actions">
              <SiteButton href="/get-started#teach-with-us">Apply to teach</SiteButton>
              <SiteButton href="/teacher/login" outline>Teacher Login</SiteButton>
            </div>
          </div>
          <div className="sl-media-frame">
            <Image
              src="/teacher-dashboard.webp"
              alt="Teacher Portal dashboard preview showing academic tools"
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="sl-section sl-section-soft">
        <div className="sl-container sl-faq-layout">
          <SectionHeading
            eyebrow="Good questions"
            title="A little more about Student LMS."
            description="New to the platform? Here are a few useful things to know before you sign in."
          />
          <FAQ items={questions} />
        </div>
      </section>

      <CTA
        title="Ready for a more connected learning day?"
        description="Start with your existing institution account, or discover the features that make Student LMS useful across your campus."
        primaryLabel="Find your portal"
        secondaryHref="/about"
        secondaryLabel="Get to know us"
      />
    </PublicSite>
  );
}
