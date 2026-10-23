import React from "react";
import { Link } from "react-router-dom";
import Footer from "./Footer";

const TermsOfService = () => (
  <div className="max-w-3xl mx-auto px-4 py-8 text-neutral-800">
    <header className="mb-6 text-center">
      <h1 className="text-3xl font-extrabold text-red-700 mb-2">
        Terms and Conditions of Usage
      </h1>
    </header>
    <section className="mb-6 space-y-4">
      <p className="text-base md:text-lg">
        By accessing this webpage, you are agreeing to be bound by these Terms
        and Conditions (“Terms”) in a legally binding agreement between Kanwarji
        Bhagirath Mal, 1972, Chandni Chowk, Delhi- 110006. Delhi (“Merchant” or
        “us” or “we” or “our”) and the User (“you” or “your”). Please read these
        Terms carefully before accessing or using the Website. If you do not
        agree to the Terms, you may not access the Platform. We reserve the
        right to update and change the Terms and Conditions by posting updates
        and changes to the Platform. You are advised to check the Terms and
        Conditions from time to time for any updates or changes that may impact
        you. If at any point such amendments are not acceptable to you, we
        advise you to cease using the Platform at such time.
      </p>
      <h2 className="text-lg font-bold mt-6">Eligibility</h2>
      <p className="text-base md:text-lg">
        You hereby represent and warrant that you have the right, power, and
        authority to agree to the Terms, to become a party to a legally binding
        agreement and to perform your obligations here under.
      </p>
      <h2 className="text-lg font-bold mt-6">Definitions</h2>
      <ul className="list-disc ml-6">
        <li>
          “Payment Instrument” includes credit card, debit card, bank account,
          prepaid payment instrument, Unified Payment Interface (UPI), Immediate
          Payment Service (IMPS) or any other methods of payments which shall be
          developed or added or deployed by banks and financial institutions
          from time to time.
        </li>
        <li>
          “Platform” refers to the website or platform where the Merchant offers
          its products or services and where the Transaction may be initiated.
        </li>
        <li>
          “Transaction” shall refer to the order or request placed by the User
          with the Merchant to purchase the products and/or services listed on
          the Platform by paying the Transaction Amount to the Merchant.
        </li>
        <li>
          “Transaction Amount” shall mean the amount paid by the User in
          connection with a Transaction; and
        </li>
        <li>
          “User/Users”, means any person availing the products and/or services
          offered on the Platform; “Website” shall mean www.kanwarji.in or the
          mobile application.
        </li>
      </ul>
      <h2 className="text-lg font-bold mt-6">Merchant’s Rights</h2>
      <p className="text-base md:text-lg">
        You agree that we may collect, store, and share the information provided
        by you in order to deliver the products and/or services availed by you
        on our Platform and/or contact you in relation to the same.
      </p>
      <h2 className="text-lg font-bold mt-6">Your Responsibilities</h2>
      <p className="text-base md:text-lg">
        You agree to provide us with true, complete and up-to-date information
        about yourself as may be required for the purpose of completing the
        Transactions. This information includes but is not limited to the
        personal details such as name, email address, phone number, delivery
        address, age, and gender (or any other information that we may deem
        necessary for us to fulfil the Transaction) as well as the accurate
        payment information required for the transaction.
      </p>
      <h2 className="text-lg font-bold mt-6">Prohibited Actions</h2>
      <ul className="list-decimal ml-6 space-y-1">
        <li>
          Systematically retrieve data or other content from the Platform to
          create or compile, directly or indirectly, a collection, compilation,
          database, or directory without written permission from us.
        </li>
        <li>
          Make any unauthorized use of the Platform, including collecting
          usernames and/or email addresses of users by electronic or other means
          for the purpose of sending unsolicited email, or creating user
          accounts by automated means or under false pretences.
        </li>
        <li>
          Circumvent, disable, or otherwise interfere with security-related
          features of the Platform, including features that prevent or restrict
          the use or copying of any Content or enforce limitations on the use of
          the Platform and/or the Content contained therein.
        </li>
        <li>
          Trick, defraud, or mislead us and other users, especially in any
          attempt to learn sensitive account information such as user passwords.
        </li>
        <li>
          Make improper use of our support services or submit false reports of
          abuse or misconduct.
        </li>
        <li>
          Engage in any automated use of the system, such as using scripts to
          send comments or messages, or using any data mining, robots, or
          similar data gathering and extraction tools.
        </li>
        <li>
          Interfere with, disrupt, or create an undue burden on the Platform or
          the networks or services connected to the Platform.
        </li>
        <li>
          Attempt to impersonate another user or person or use the username of
          another user Use any information obtained from the Platform in order
          to harass, abuse, or harm another person.
        </li>
        <li>
          Use the Platform as part of any effort to compete with us or otherwise
          use the Platform and/or the Content for any revenue-generating
          endeavour or commercial enterprise.
        </li>
        <li>
          Decipher, decompile, disassemble, or reverse engineer any of the
          software comprising or in any way making up a part of the Platform.
        </li>
        <li>
          Attempt to bypass any measures of the Platform designed to prevent or
          restrict access to the Platform, or any portion of the Platform.
        </li>
        <li>
          Harass, annoy, intimidate, or threaten any of our employees or agents
          engaged in providing any portion of the Platform to you.
        </li>
        <li>
          Copy or adapt the Platform’s software, including but not limited to
          Flash, PHP, HTML, JavaScript, or other code.
        </li>
        <li>
          Upload or transmit (or attempt to upload or to transmit) viruses,
          Trojan horses, or other material, including excessive use of capital
          letters and spamming (continuous posting of repetitive text), that
          interferes with any party’s uninterrupted use and enjoyment of the
          Platform or modifies, impairs, disrupts, alters, or interferes with
          the use, features, functions, operation, or maintenance of the
          Platform.
        </li>
        <li>
          Disparage, tarnish, or otherwise harm, in our opinion, us and/or the
          Platform. Use the Platform in a manner inconsistent with any
          applicable laws or regulations.
        </li>
      </ul>
      <h2 className="text-lg font-bold mt-6">Limitation of Liability</h2>
      <p className="text-base md:text-lg">
        The User agrees that the only recourse that the User has in the event of
        receiving a defective product and/or deficiency in service or a product
        and/or service which does not match the provided description is to
        initiate the refund process which will be subject to the terms for
        refund under this agreement. We hereby expressly disclaim any liability
        to them for any losses. The User shall indemnify and hold harmless the
        Merchant and its affiliates, agents and representatives from and against
        any and all claims, demands, causes of action, obligations, liabilities,
        losses, damages, injuries, costs and expenses incurred or sustained by
        reason of or arising out of any breach or alleged breach of any of the
        terms herein by the User.
      </p>
      <h2 className="text-lg font-bold mt-6">Guidelines for Reviews</h2>
      <ul className="list-decimal ml-6 space-y-1">
        <li>
          You should have firsthand experience with the person/entity being
          reviewed.
        </li>
        <li>
          Your reviews should not contain offensive profanity, or abusive,
          racist, offensive, or hate language.
        </li>
        <li>
          Your reviews should not contain discriminatory references based on
          religion, race, gender, national origin, age, marital status, sexual
          orientation, or disability.
        </li>
        <li>
          Your reviews should not contain references to illegal activity. You
          should not be affiliated with competitors if posting negative reviews.
        </li>
        <li>
          You should not make any conclusions as to the legality of conduct. You
          may not post any false or misleading statements.
        </li>
        <li>
          You may not organize a campaign encouraging others to post reviews,
          whether positive or negative.
        </li>
        <li>
          We may accept, reject, or remove reviews in our sole discretion.
        </li>
        <li>
          We have absolutely no obligation to screen reviews or to delete
          reviews, even if anyone considers reviews objectionable or inaccurate.
        </li>
        <li>
          Reviews are not endorsed by us, and do not necessarily represent our
          opinions or the views of any of our affiliates or partners.
        </li>
        <li>
          We do not assume liability for any review or for any claims,
          liabilities, or losses resulting from any review.
        </li>
        <li>
          By posting a review, you hereby grant to us a perpetual,
          non-exclusive, worldwide, royalty-free, fully paid, assignable, and
          sublicensable right and license to reproduce, modify, translate,
          transmit by any means, display, perform and/or distribute all content
          relating to reviews.
        </li>
      </ul>
      <h2 className="text-lg font-bold mt-6">
        Governing Laws & Dispute Resolution
      </h2>
      <p className="text-base md:text-lg">
        Please note that these terms of use, their subject matter and their
        formation, are governed by the laws of India and Delhi Jurisdiction
        only. You and we both agree that the courts of Delhi, India will have
        exclusive jurisdiction over any dispute. Any dispute or claim arising
        out of or in connection with or relating to these Terms or their breach,
        termination or invalidity hereof (“Dispute”) shall be referred to and
        finally resolved by arbitration in Delhi in accordance with the
        Arbitration and Conciliation Act, 1996 for the time being in force,
        which rules are deemed to be incorporated by reference in this clause
        12.2. Within 30 (thirty) days of the issue of a notice of Dispute, the
        parties shall mutually agree on the appointment of a sole arbitrator. If
        such mutual agreement is not arrived at within the aforesaid 30 (thirty)
        days’s period, the parties shall appoint such sole arbitrator in
        accordance with the Arbitration and Conciliation Act, 1996. The seat of
        arbitration shall be India and the arbitration proceedings shall be
        conducted in the English language. The parties shall keep the
        arbitration confidential and not disclose to any person, other than
        those necessary to the proceedings, any information, transcripts or
        award unless required to do so by law. The decision of the arbitrator
        shall be final and binding on all the parties hereto. The parties hereto
        agree that their consent for resolution of Dispute through arbitration
        shall not preclude or restrain either of them from seeking suitable
        injunctive relief in appropriate circumstances from courts in Bengaluru.
        The cost of arbitration shall be borne in the manner and by a party as
        determined by the arbitrators. In the meantime, each party shall bear
        its own cost for the arbitration which shall be reimbursed as per the
        directions in the arbitral award.
      </p>
      <h2 className="text-lg font-bold mt-6">Grievance Redressal</h2>
      <p className="text-base md:text-lg">
        You agree that if you have any question or complaint with regard to any
        product and/or service availed on our Platform, or pertaining to the
        Transaction, including but not limited to, double debit of Transaction
        Amount, fraudulent Transaction, unauthorized Transaction, refund
        requests, etc., you may reach out here:
      </p>
      <p className="text-base md:text-lg font-semibold">
        Postal Address:
        <br />
        Kanwarji Bhagirath Mal, 1972, Chandni Chowk, Delhi- 110006. Delhi.
        Bharat (India)
      </p>
      <p className="text-base md:text-lg font-semibold">
        Emails:
        <br />
        <a
          href="mailto:kanwarjibhagirathmal@gmail.com"
          className="text-red-600 underline"
        >
          kanwarjibhagirathmal@gmail.com
        </a>{" "}
        with Subject Line containing “ Grievance”
      </p>
      <p className="text-base md:text-lg font-semibold">
        Phone/WhatsApp/Arattai:
        <br />
        +91-9811049585
      </p>
      <h2 className="text-lg font-bold mt-6">Disclaimer</h2>
      <p className="text-base md:text-lg">
        That upon initiating a Transaction, you as a User are entering into a
        legally binding and enforceable contract with us to purchase the
        products and/or services, and you shall pay the price as listed on the
        Platform through legitimate and legal sources of funds and through the
        accepted Payment Instruments. That you shall provide accurate payment
        details to the secure payment system for making purchase on the
        Platform. The information provided by you may be utilized or shared with
        any third party if required in relation to fraud verifications or by
        law, regulation or court order. We expressly disclaim all liabilities
        that may arise as a consequence of any unauthorized use of a User’s
        Payment Instrument. That all payments undertaken by you are subject to
        your own risk and volition. We shall not be liable for any loss or
        damage occurred to you arising directly or indirectly due to the decline
        of authorization for any Transaction, malfunction, errors and/or
        unscrupulous activities. If you receive a User identification code,
        order ID, password or any other piece of information as part of our
        security procedures, you must treat such information as confidential.
        You must not disclose it to any third party. The content on our Platform
        is provided for general information only. The information provided does
        not to amount to advice from us in any manner and should not be relied
        upon. Where our Platform contains links to other websites and resources
        provided by third parties, these links are provided for your information
        only. Such links should not be interpreted as approval by us of those
        linked websites or information you may obtain from them. This Platform
        includes information and materials uploaded by other Users of the
        Platform. You understand that such information and materials have not
        been verified or approved by us. The views expressed by other Users on
        our Platform do not represent our views or values. We do not guarantee
        that our Platform will be secure or free from bugs or viruses. You are
        responsible for configuring your information technology, computer
        programs and platform to access our Platform. You must use your own
        virus protection software.
      </p>
    </section>
    <Footer />
  </div>
);

export default TermsOfService;
