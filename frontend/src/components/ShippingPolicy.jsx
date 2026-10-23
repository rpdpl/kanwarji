import React from "react";
import Footer from "./Footer";

const ShippingPolicy = () => (
  <div className="max-w-3xl mx-auto px-4 py-8 text-neutral-800">
    <header className="mb-6 text-center">
      <h1 className="text-3xl font-extrabold text-red-700 mb-2">
        Shipping and Delivery
      </h1>
    </header>
    <section className="mb-6">
      <p className="text-base md:text-lg mb-4">
        You hereby agree that the delivery dates are estimates, unless a fixed
        date for the delivery has been expressly agreed in writing. The cost for
        delivery shall be calculated at the time of initiation of Transaction
        based on the shipping address and will be collected from you as a part
        of the Transaction Amount paid for the products and/or services. In the
        event that you do not receive the delivery even after three days have
        passed from the estimated date of delivery, you must promptly reach out
        to us at{" "}
        <a
          href="mailto:kanwarjibhagirathmal@gmail.com"
          className="text-red-600 underline"
        >
          kanwarjibhagirathmal@gmail.com
        </a>
        .
      </p>
    </section>
    <Footer />
  </div>
);

export default ShippingPolicy;
