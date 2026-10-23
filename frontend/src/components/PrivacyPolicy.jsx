import React from "react";
import Footer from "./Footer";

const PrivacyPolicy = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-neutral-800">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold text-red-700 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-neutral-500">
          Effective Date: <span className="font-semibold">07/11/2025</span> |
          Last Updated: <span className="font-semibold">07/11/2025</span>
        </p>
      </header>
      <section className="mb-6">
        <h2 className="text-xl font-bold mb-2">1. Introduction</h2>
        <p>
          This Privacy Policy outlines how Kanwarji Bhagirath Mal (“we”, “our”,
          or “us”) collects, uses, discloses, and protects your personal
          information when you visit or make a purchase from our website{" "}
          <a
            href="https://kanwarji.in/"
            className="text-red-600 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://kanwarji.in/
          </a>
          .<br />
          We are committed to safeguarding your privacy and complying with
          applicable data protection laws, including:
        </p>
        <ul className="list-disc ml-6 mt-2">
          <li>India’s Information Technology Act, 2000 and its amendments</li>
          <li>India’s Digital Personal Data Protection Act (DPDPA), 2023</li>
          <li>General Data Protection Regulation (GDPR) – European Union</li>
          <li>California Consumer Privacy Act (CCPA) – United States</li>
        </ul>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-bold mb-2">2. Information We Collect</h2>
        <p>We may collect the following types of personal data:</p>
        <ul className="list-disc ml-6 mt-2">
          <li>
            Name, email address, phone number, shipping and billing address
          </li>
          <li>
            Payment information (processed securely via third-party gateways)
          </li>
          <li>Purchase history and preferences</li>
          <li>IP address, browser type, device information</li>
          <li>Cookies and usage data</li>
        </ul>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-bold mb-2">
          3. How We Use Your Information
        </h2>
        <ul className="list-disc ml-6 mt-2">
          <li>Process orders and deliver products</li>
          <li>Communicate order updates and promotional offers</li>
          <li>Improve website functionality and user experience</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-bold mb-2">
          4. Legal Basis for Processing
        </h2>
        <ul className="list-disc ml-6 mt-2">
          <li>Consent (for marketing and cookies)</li>
          <li>Contractual necessity (to fulfill orders)</li>
          <li>Legal compliance</li>
          <li>Legitimate interest (e.g., fraud prevention)</li>
        </ul>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-bold mb-2">
          5. Data Sharing and Transfers
        </h2>
        <ul className="list-disc ml-6 mt-2">
          <li>Payment processors and logistics partners</li>
          <li>Marketing and analytics service providers</li>
          <li>Government authorities if required by law</li>
        </ul>
        <p className="mt-2">
          International data transfers are protected by standard contractual
          clauses or equivalent safeguards.
        </p>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-bold mb-2">6. Data Retention</h2>
        <p>
          We retain your personal data only as long as necessary for the
          purposes stated above or as required by law.
        </p>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-bold mb-2">7. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have rights to:</p>
        <ul className="list-disc ml-6 mt-2">
          <li>Access, correct, or delete your personal data</li>
          <li>Withdraw consent at any time</li>
          <li>Object to or restrict processing</li>
          <li>Lodge a complaint with a data protection authority</li>
        </ul>
        <p className="mt-2">
          To exercise these rights, contact us at{" "}
          <span className="font-semibold">[Insert Contact Email]</span>.
        </p>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-bold mb-2">Cookies Policy</h2>
        <h3 className="text-lg font-semibold mb-1 mt-2">
          1. What Are Cookies?
        </h3>
        <p>
          Cookies are small text files stored on your device to enhance your
          browsing experience.
        </p>
        <h3 className="text-lg font-semibold mb-1 mt-2">
          2. Types of Cookies We Use
        </h3>
        <ul className="list-disc ml-6 mt-2">
          <li>Essential Cookies: Required for website functionality</li>
          <li>Performance Cookies: Help us analyse site usage</li>
          <li>Marketing Cookies: Used for personalized advertising</li>
          <li>
            Third-Party Cookies: Set by services like Google Analytics, Meta
            Pixel, etc.
          </li>
        </ul>
        <h3 className="text-lg font-semibold mb-1 mt-2">
          3. Consent and Control
        </h3>
        <p>
          Under India’s DPDPA and GDPR, we require explicit consent before
          placing non-essential cookies. You can manage cookie preferences via
          our cookie banner or browser settings.
        </p>
        <h3 className="text-lg font-semibold mb-1 mt-2">
          4. Updates to This Policy
        </h3>
        <p>
          We may update this policy periodically. Changes will be posted on this
          page with the revised date.
        </p>
        <h3 className="text-lg font-semibold mb-1 mt-2">5. Contact Us</h3>
        <p>
          Email:{" "}
          <a
            href="mailto:kanwarjibhagirathmail@gmail.com"
            className="text-red-600 underline"
          >
            kanwarjibhagirathmail@gmail.com
          </a>
          <br />
          Phone: <span className="font-semibold">+91-9811049585</span>
          <br />
          Address: Kanwarji Bhagirath Mal, 1972, Chandni Chowk, Delhi- 110006.
          Delhi. Bharat (India)
        </p>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
