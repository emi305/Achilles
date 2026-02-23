import Link from "next/link";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";

function LegalMetaDates() {
  return (
    <div className="space-y-1 text-sm text-stone-700">
      <p><strong>Effective Date:</strong> February 23, 2026</p>
      <p><strong>Last Updated:</strong> February 23, 2026</p>
    </div>
  );
}

function MailtoSupport() {
  return (
    <a href="mailto:support@achillesinsight.com" className="underline underline-offset-2 hover:text-stone-900">
      support@achillesinsight.com
    </a>
  );
}

export default function LegalPage() {
  return (
    <section className="space-y-8 pt-6 sm:pt-10">
      <BrandHeader subtitle="Privacy Policy, Terms of Service, and Disclaimer for Achilles Insight." />

      <Card className="print-hide">
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
          <span className="font-semibold text-stone-900">Jump to:</span>
          <Link href="/legal#privacy" className="underline underline-offset-2 hover:text-stone-900">Privacy Policy</Link>
          <span aria-hidden className="text-stone-500">||</span>
          <Link href="/legal#terms" className="underline underline-offset-2 hover:text-stone-900">Terms of Service</Link>
          <span aria-hidden className="text-stone-500">||</span>
          <Link href="/legal#disclaimer" className="underline underline-offset-2 hover:text-stone-900">Disclaimer</Link>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-6">
          <section id="privacy" className="scroll-mt-24 space-y-5">
            <header className="space-y-3">
              <h2 className="brand-title text-2xl font-semibold text-stone-900">Achilles Insight Privacy Policy</h2>
              <LegalMetaDates />
            </header>

            <div className="space-y-4 text-sm leading-7 text-stone-800 sm:text-base">
              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">1. Overview</h3>
                <p>
                  Achilles Insight (“<strong>Achilles Insight</strong>,” “<strong>we</strong>,” “<strong>us</strong>,” or
                  “<strong>our</strong>”) provides an educational analytics platform that helps users review and analyze study
                  performance data for board exam preparation.
                </p>
                <p>
                  This Privacy Policy explains how we collect, use, store, and share your information when you use our website and
                  services (the “<strong>Service</strong>”).
                </p>
                <p>By using Achilles Insight, you agree to this Privacy Policy.</p>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-stone-900">2. Information We Collect</h3>
                <div className="space-y-2">
                  <h4 className="font-semibold text-stone-900">A. Information You Provide</h4>
                  <p>We may collect information you provide directly, including:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li><strong>Account information</strong> (e.g., email address, username, password)</li>
                    <li><strong>Uploaded content</strong> (e.g., CSV files, score reports, screenshots, PDFs)</li>
                    <li><strong>Messages or support requests</strong> you send us</li>
                    <li><strong>Billing-related information</strong> (if applicable, via our payment processor)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-stone-900">B. Information Collected Automatically</h4>
                  <p>We may collect limited technical and usage information, such as:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Device/browser type</li>
                    <li>Log data (e.g., access times, pages viewed)</li>
                    <li>Basic usage analytics (e.g., feature usage, errors)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-stone-900">C. Payment Information</h4>
                  <p>
                    Payments are processed by third-party providers (such as <strong>Stripe</strong>). We do <strong>not</strong>{" "}
                    store full payment card details on our servers.
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">3. How We Use Information</h3>
                <p>We use your information to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Create and manage your account</li>
                  <li>Provide the Service and core app features</li>
                  <li>Process and analyze uploaded study data</li>
                  <li>Generate educational insights and analytics</li>
                  <li>Provide customer support</li>
                  <li>Improve the Service, reliability, and user experience</li>
                  <li>Process subscriptions and billing</li>
                  <li>Detect abuse, fraud, or unauthorized activity</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">4. AI and Third-Party Processing</h3>
                <p>Some features of Achilles Insight may use third-party services to process data, including:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li><strong>Supabase</strong> (authentication, database, storage)</li>
                  <li><strong>Stripe</strong> (payments and subscription billing)</li>
                  <li><strong>OpenAI</strong> (AI-powered analysis/chat features, if enabled)</li>
                  <li>Other infrastructure/hosting providers as needed</li>
                </ul>
                <p>
                  If AI-powered features are used, uploaded content or extracted text may be processed by third-party AI services
                  solely to provide app functionality.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">5. Data Retention</h3>
                <p>We retain your information only as long as necessary to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Provide the Service</li>
                  <li>Maintain account functionality</li>
                  <li>Comply with legal, tax, or security obligations</li>
                  <li>Resolve disputes and enforce our agreements</li>
                </ul>
                <p>
                  You may request deletion of your account and associated data by contacting us at <strong><MailtoSupport /></strong>.
                </p>
                <p>
                  We will make reasonable efforts to delete your data, subject to technical limitations (such as backup retention
                  windows) and legal obligations.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">6. Data Security</h3>
                <p>
                  We use reasonable administrative, technical, and organizational safeguards to protect your information. However, no
                  system is completely secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">7. Your Choices and Rights</h3>
                <p>Depending on your location, you may have rights to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Access your information</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Request deletion of your data</li>
                  <li>Request information about how your data is used</li>
                </ul>
                <p>
                  To make a request, contact us at <strong><MailtoSupport /></strong>.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">8. Educational Use and Upload Restrictions</h3>
                <p>
                  Achilles Insight is an <strong>educational analytics tool</strong>. It is not a medical device, does not provide
                  medical advice, and does not replace professional educational guidance or exam preparation resources.
                </p>
                <p>
                  <strong>Do not upload protected health information (PHI), patient identifiers, or confidential patient records.</strong>{" "}
                  Achilles Insight is intended for educational exam-preparation data only.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">9. No Affiliation with Exam Organizations</h3>
                <p>
                  Achilles Insight is <strong>not affiliated with, endorsed by, or sponsored by</strong> NBOME, NBME, USMLE, UWorld,
                  TrueLearn, AMBOSS, or any other third-party exam organization or question bank provider, unless explicitly stated.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">10. Children’s Privacy</h3>
                <p>
                  Achilles Insight is intended for users age <strong>18 and older</strong>. We do not knowingly collect personal
                  information from individuals under 18.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">11. Changes to This Policy</h3>
                <p>
                  We may update this Privacy Policy from time to time. If we make material changes, we will update the “Last Updated”
                  date and may provide additional notice in the app or on the website.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">12. Contact Us</h3>
                <p>If you have questions about this Privacy Policy or want to request account/data deletion, contact:</p>
                <p><strong>Achilles Insight</strong></p>
                <p>Email: <strong><MailtoSupport /></strong></p>
                <p>Website: <strong>AchillesInsight.com</strong></p>
              </section>
            </div>
          </section>
        </Card>

        <Card className="space-y-6">
          <section id="terms" className="scroll-mt-24 space-y-5">
            <header className="space-y-3">
              <h2 className="brand-title text-2xl font-semibold text-stone-900">Achilles Insight Terms of Service</h2>
              <LegalMetaDates />
            </header>

            <div className="space-y-4 text-sm leading-7 text-stone-800 sm:text-base">
              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">1. Acceptance of Terms</h3>
                <p>These Terms of Service (“<strong>Terms</strong>”) govern your access to and use of Achilles Insight (the “<strong>Service</strong>”).</p>
                <p>
                  By creating an account, accessing, or using the Service, you agree to these Terms. If you do not agree, do not use
                  the Service.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">2. What Achilles Insight Is</h3>
                <p>
                  Achilles Insight is an <strong>educational study analytics platform</strong> designed to help users organize and
                  analyze study performance data for exam preparation.
                </p>
                <p>
                  <strong>Achilles Insight is for educational purposes only</strong> and does not guarantee exam scores, passing
                  results, or academic outcomes.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">3. Eligibility</h3>
                <p>
                  You must be at least <strong>18 years old</strong> (or the age of majority in your jurisdiction) to use the Service.
                </p>
                <p>
                  You are responsible for ensuring your use of the Service complies with applicable laws and your school/program
                  policies.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">4. Accounts</h3>
                <p>To use certain features, you may need to create an account.</p>
                <p>You agree to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Provide accurate information</li>
                  <li>Keep your login credentials secure</li>
                  <li>Be responsible for activity on your account</li>
                </ul>
                <p>
                  You must notify us at <strong><MailtoSupport /></strong> if you believe your account has been accessed without
                  authorization.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">5. Acceptable Use</h3>
                <p>You agree not to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Use the Service for unlawful purposes</li>
                  <li>Attempt to hack, disrupt, overload, or damage the Service</li>
                  <li>Upload malicious code, viruses, or harmful files</li>
                  <li>Reverse engineer or copy the Service (except as allowed by law)</li>
                  <li>Share or resell access in violation of your subscription plan</li>
                  <li>Use automated scraping/bots to extract app content or data without permission</li>
                  <li>Upload protected health information (PHI), patient identifiers, or confidential patient records</li>
                  <li>Upload content you do not have the right to use or share</li>
                </ul>
                <p>We may suspend or terminate accounts that violate these Terms.</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">6. User Content and Uploads</h3>
                <p>You may upload files and data (e.g., score reports, CSVs, screenshots) to use the Service.</p>
                <p>
                  You retain ownership of your uploaded content. By uploading content, you grant us a limited license to host,
                  process, analyze, and display it <strong>only as needed to operate and improve the Service</strong>.
                </p>
                <p>You are responsible for ensuring you have the right to upload any content you submit.</p>
                <p>
                  If you believe content on the Service infringes your intellectual property rights, contact us at{" "}
                  <strong><MailtoSupport /></strong> with sufficient detail, and we will review and respond appropriately.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-stone-900">7. Subscriptions, Billing, and Free Trials</h3>
                <p>Some features may require a paid subscription.</p>

                <div className="space-y-2">
                  <h4 className="font-semibold text-stone-900">A. Billing</h4>
                  <p>If you subscribe to a paid plan:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>You agree to pay the listed price and any applicable taxes</li>
                    <li>Billing may be recurring (e.g., monthly or yearly) until canceled</li>
                    <li>Payments are processed by third-party providers (e.g., Stripe)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-stone-900">B. Free Trial</h4>
                  <p>If we offer a free trial (e.g., 7-day trial), trial terms may include:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Automatic conversion to a paid subscription unless canceled before the trial ends</li>
                    <li>Limits on one trial per user/payment method/account</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-stone-900">C. Cancellations</h4>
                  <p>
                    You may cancel your subscription at any time. Unless otherwise stated, cancellation takes effect at the end of the
                    current billing period.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-stone-900">D. Refunds</h4>
                  <p>Payments are non-refundable except where required by law.</p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">8. VCOM or School-Based Access (If Offered)</h3>
                <p>
                  If we offer free or discounted access to users with verified school email domains (such as VCOM), eligibility may
                  require:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Valid institutional email verification</li>
                  <li>Ongoing eligibility checks</li>
                  <li>Compliance with these Terms</li>
                </ul>
                <p>We may modify, suspend, or discontinue school-based access programs at any time.</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">9. Intellectual Property</h3>
                <p>
                  The Service, including its software, branding, design, interface, and original content, is owned by Achilles
                  Insight (or its licensors) and protected by applicable intellectual property laws.
                </p>
                <p>These Terms do not grant you ownership of the Service.</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">10. Educational Disclaimer</h3>
                <p>
                  Achilles Insight provides analytics, rankings, and AI-assisted study insights based on user-provided data and
                  internal scoring logic (including heuristic models such as ROI/PROI or similar methods).
                </p>
                <p>
                  These insights are <strong>informational and educational only</strong>. They may be incomplete, approximate, or
                  imperfect and should not be relied on as a guarantee of exam performance.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">11. Third-Party Services</h3>
                <p>
                  The Service may rely on third-party providers (such as Supabase, Stripe, hosting providers, and AI providers). We
                  are not responsible for third-party service outages or failures outside our control.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">12. Beta and Evolving Features</h3>
                <p>
                  Some features may be released in beta, preview, or experimental form and may change, malfunction, or be
                  discontinued at any time.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-stone-900">13. No Warranty</h3>
                <p>
                  The Service is provided <strong>“as is”</strong> and <strong>“as available.”</strong> To the maximum extent
                  permitted by law, Achilles Insight disclaims all warranties, express or implied, including merchantability, fitness
                  for a particular purpose, and non-infringement.
                </p>
                <p>We do not guarantee that:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>The Service will be uninterrupted or error-free</li>
                  <li>Results will be accurate in all cases</li>
                  <li>The Service will improve exam outcomes</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">14. Limitation of Liability</h3>
                <p>
                  To the maximum extent permitted by law, Achilles Insight and its owners/operators will not be liable for any
                  indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or opportunity
                  arising from your use of the Service.
                </p>
                <p>
                  If liability is found, our total liability will not exceed the amount you paid to us in the <strong>12 months</strong>{" "}
                  before the event giving rise to the claim.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">15. Indemnification</h3>
                <p>
                  You agree to defend, indemnify, and hold harmless Achilles Insight and its operators from claims, liabilities,
                  damages, and expenses arising from:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Your use of the Service</li>
                  <li>Your uploaded content</li>
                  <li>Your violation of these Terms</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">16. Termination</h3>
                <p>
                  We may suspend or terminate your access to the Service at any time if you violate these Terms or misuse the Service.
                </p>
                <p>
                  You may stop using the Service at any time and request account deletion by contacting <strong><MailtoSupport /></strong>.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">17. Changes to the Service or Terms</h3>
                <p>
                  We may modify the Service or these Terms at any time. If we make material changes, we will update the “Last
                  Updated” date and may provide notice through the app or website.
                </p>
                <p>Continued use of the Service after changes means you accept the updated Terms.</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">18. Governing Law</h3>
                <p>These Terms are governed by the laws of <strong>Louisiana</strong>, without regard to conflict-of-law principles.</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">19. Contact</h3>
                <p>Questions about these Terms can be sent to:</p>
                <p><strong>Achilles Insight</strong></p>
                <p>Email: <strong><MailtoSupport /></strong></p>
                <p>Website: <strong>AchillesInsight.com</strong></p>
              </section>
            </div>
          </section>
        </Card>

        <Card className="space-y-6">
          <section id="disclaimer" className="scroll-mt-24 space-y-5">
            <header className="space-y-3">
              <h2 className="brand-title text-2xl font-semibold text-stone-900">Achilles Insight Disclaimer</h2>
              <LegalMetaDates />
            </header>

            <div className="space-y-4 text-sm leading-7 text-stone-800 sm:text-base">
              <p>
                Achilles Insight is an <strong>educational analytics and study-support tool</strong> designed to help users review and
                organize exam-preparation performance data.
              </p>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">1. Educational Use Only</h3>
                <p>
                  Achilles Insight is provided for <strong>educational and informational purposes only</strong>. It is not a medical
                  device, not a diagnostic tool, and not a substitute for academic advising, professional tutoring, or official exam
                  preparation guidance.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-stone-900">2. No Guarantee of Results</h3>
                <p>
                  Achilles Insight provides rankings, analytics, and AI-assisted insights based on user-uploaded data and internal
                  scoring logic (including ROI/PROI-style models). These outputs are estimates and heuristics and may be incomplete or
                  imperfect.
                </p>
                <p>Use of Achilles Insight does <strong>not</strong> guarantee:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Passing an exam</li>
                  <li>A specific score</li>
                  <li>Improved performance</li>
                  <li>Accuracy in all cases</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">3. No Medical Advice</h3>
                <p>
                  Achilles Insight does not provide medical advice, clinical decision support, patient care recommendations, or
                  treatment guidance.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">4. No PHI or Patient Data</h3>
                <p>
                  Do <strong>not</strong> upload protected health information (PHI), patient identifiers, or confidential patient
                  records. Achilles Insight is intended for exam-preparation and study-performance data only.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">5. Third-Party Content and Services</h3>
                <p>
                  Achilles Insight may reference, process, or integrate with data originating from third-party services (e.g.,
                  question banks, score reports, or AI providers). Achilles Insight is not responsible for third-party content
                  accuracy, availability, or service interruptions.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">6. No Affiliation</h3>
                <p>
                  Achilles Insight is <strong>not affiliated with, endorsed by, or sponsored by</strong> NBOME, NBME, USMLE, UWorld,
                  TrueLearn, AMBOSS, or other exam organizations or educational content providers, unless explicitly stated.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">7. User Responsibility</h3>
                <p>You are responsible for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>The content you upload</li>
                  <li>Verifying your own study decisions</li>
                  <li>Complying with your school/program policies</li>
                  <li>Ensuring you have rights to upload submitted files/content</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">8. Contact</h3>
                <p>Questions about this Disclaimer may be sent to:</p>
                <p><strong>Achilles Insight</strong></p>
                <p>Email: <strong><MailtoSupport /></strong></p>
                <p>Website: <strong>AchillesInsight.com</strong></p>
              </section>
            </div>
          </section>
        </Card>
      </div>
    </section>
  );
}
