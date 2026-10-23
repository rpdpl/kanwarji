import React from "react";
import Footer from "./Footer";

const RefundPolicy = () => (
  <div className="max-w-3xl mx-auto px-4 py-8 text-neutral-800">
    <header className="mb-6 text-center">
      <h1 className="text-3xl font-extrabold text-red-700 mb-2">
        Refund and Cancellation
      </h1>
    </header>
    <section className="mb-6">
      <p className="text-base md:text-lg mb-4">
        Upon completing a Transaction, you are entering into a legally binding
        and enforceable agreement with us to purchase the product and/or
        service.
      </p>
      <p className="text-base md:text-lg mb-4">
        After this point the User may cancel the Transaction if order has NOT
        already processed by us. In which case, the cancellation will be subject
        to the terms mentioned on the Platform.
      </p>
      <p className="text-base md:text-lg mb-4">
        We shall retain the discretion in approving any cancellation requests
        and we may ask for additional details before approving any requests.
      </p>
      <p className="text-base md:text-lg mb-4">
        Once you have received the product and/or service, the only event where
        you can request for a replacement or a return and a refund is if the
        product and/or service does not match the description as mentioned on
        the Platform.
      </p>
      <p className="text-base md:text-lg mb-4">
        Any request for refund, if matches the above condition, must be
        submitted within Five (5) hours from the date and time of receiving the
        product. A User may submit a claim for a refund for a purchase made, by
        contacting us on{" "}
        <a
          href="mailto:kanwarjibhagirathmal@gmail.com"
          className="text-red-600 underline"
        >
          kanwarjibhagirathmal@gmail.com
        </a>{" "}
        and providing a clear and specific reason for the refund request,
        including the exact terms that have been violated, along with proof.
        Whether a refund will be provided will be determined by us, and we may
        ask for additional details before approving any requests.
      </p>
    </section>
    <Footer />
  </div>
);

export default RefundPolicy;
