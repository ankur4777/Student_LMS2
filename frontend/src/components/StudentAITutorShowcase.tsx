import Link from "next/link";

/**
 * Marketing-only illustration of the existing Student Portal floating AI Tutor.
 * The real conversation and access controls remain inside the Student Portal.
 */
export default function StudentAITutorShowcase() {
  return (
    <section
      className="lms-landing-section lms-ai-showcase"
      id="student-ai-tutor"
      aria-labelledby="student-ai-tutor-heading"
    >
      <div className="lms-landing-container lms-ai-showcase-layout">
        <div className="lms-ai-showcase-copy">
          <span className="lms-landing-eyebrow">AI-POWERED STUDENT LEARNING</span>
          <h2 id="student-ai-tutor-heading">
            Meet MySLS AI Tutor. <span>Get help when you need it.</span>
          </h2>
          <p className="lms-ai-showcase-lead">
            Students can explore topics, ask follow-up questions and find available
            learning resources directly in their MySLS Student Portal.
          </p>

          <div className="lms-ai-showcase-benefits">
            <div className="lms-ai-showcase-benefit">
              <span className="lms-ai-showcase-benefit-icon is-subject" aria-hidden="true">
                <i className="bi bi-book-half" />
              </span>
              <div>
                <h3>Subject Tutor</h3>
                <p>
                  Ask questions about enrolled subjects, get explanations and
                  use relevant excerpts from teacher-published PDFs when available
                  and permitted.
                </p>
              </div>
            </div>
            <div className="lms-ai-showcase-benefit">
              <span className="lms-ai-showcase-benefit-icon is-dashboard" aria-hidden="true">
                <i className="bi bi-columns-gap" />
              </span>
              <div>
                <h3>My Dashboard</h3>
                <p>
                  Ask about available class schedules, assignments, results and
                  other authorized information in your student account.
                </p>
              </div>
            </div>
            <div className="lms-ai-showcase-benefit">
              <span className="lms-ai-showcase-benefit-icon is-history" aria-hidden="true">
                <i className="bi bi-clock-history" />
              </span>
              <div>
                <h3>Saved conversations</h3>
                <p>
                  Return to earlier discussions using the chatbot&apos;s History
                  option, or start a new conversation whenever you need one.
                </p>
              </div>
            </div>
          </div>

          <div className="lms-ai-showcase-actions">
            <Link href="/student/login" className="lms-landing-button">
              Open Student Portal <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
            <p>
              Available when enabled by your institution. Subject and document
              access are restricted to authorized resources. AI responses can
              contain mistakes; teachers and official LMS records take priority.
            </p>
          </div>
        </div>

        <div className="lms-ai-showcase-demo-wrap">
          <span className="lms-ai-showcase-demo-label">AI TUTOR · SAMPLE STUDY CONVERSATION</span>
          <div className="lms-ai-showcase-chat">
            <div className="lms-ai-showcase-chat-header">
              <span className="lms-ai-showcase-avatar" aria-hidden="true">🎓</span>
              <div>
                <strong>Your AI Tutor</strong>
                <small>Study help and personal LMS information</small>
              </div>
              <div className="lms-ai-showcase-chat-actions" aria-hidden="true">
                <span>History</span>
                <span>+ New</span>
              </div>
            </div>
            <div className="lms-ai-showcase-chat-toolbar">
              <div className="lms-ai-showcase-chat-tabs">
                <span className="is-selected">Subject Tutor</span>
                <span>My Dashboard</span>
              </div>
              <div className="lms-ai-showcase-chat-subject">
                <small>Subject</small>
                <div>Meta Ads <i className="bi bi-chevron-down" aria-hidden="true" /></div>
              </div>
            </div>
            <div className="lms-ai-showcase-chat-messages">
              <div className="lms-ai-showcase-chat-question">
                Tell me about Meta Ads
              </div>
              <div className="lms-ai-showcase-chat-answer">
                Meta Ads is an advertising platform used to create and manage
                ads on Facebook and Instagram. Students can explore campaign
                structure, targeting and performance measurement.
              </div>
              <div className="lms-ai-showcase-chat-tip">
                <i className="bi bi-lightbulb" aria-hidden="true" />
                Ask follow-up questions about your subject.
              </div>
            </div>
            <div className="lms-ai-showcase-chat-input">
              <div>Ask a question about your subject...</div>
              <span aria-hidden="true"><i className="bi bi-send-fill" /></span>
            </div>
            <p className="lms-ai-showcase-chat-disclaimer">
              AI can make mistakes. Official LMS records remain authoritative.
            </p>
          </div>
          <div className="lms-ai-showcase-demo-note">
            <i className="bi bi-shield-check" aria-hidden="true" />
            Built into the Student Portal, with institution-controlled access.
          </div>
        </div>
      </div>
    </section>
  );
}
