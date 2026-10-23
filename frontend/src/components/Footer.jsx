import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer
      className="mt-10 border-t border-neutral-200 pb-24 w-full"
      style={{ backgroundColor: "#FFF4F4" }}
    >
      <div className="w-full px-6 py-10 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Top Categories */}
          <div className="text-center">
            <h5 className="text-neutral-900 font-semibold uppercase tracking-wide mb-3">
              Top Categories
            </h5>
            <ul className="space-y-2 text-neutral-700">
              <li>
                <Link
                  to="/categories?category=Savory"
                  className="hover:text-primary-600"
                >
                  Savory
                </Link>
              </li>
              <li>
                <Link
                  to="/categories?category=Namkeen"
                  className="hover:text-primary-600"
                >
                  Namkeen
                </Link>
              </li>
              <li>
                <Link
                  to="/categories?category=Travel%20Pack%20Combo"
                  className="hover:text-primary-600"
                >
                  Travel Pack Combo
                </Link>
              </li>
              <li>
                <Link
                  to="/categories?category=Value%20Pack%20Offers"
                  className="hover:text-primary-600"
                >
                  Value Pack Offers
                </Link>
              </li>
              <li>
                <Link
                  to="/categories?category=Gift%20Packs"
                  className="hover:text-primary-600"
                >
                  Gift Packs
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div className="text-center">
            <h5 className="text-neutral-900 font-semibold uppercase tracking-wide mb-3">
              Services
            </h5>
            <ul className="space-y-2 text-neutral-700">
              <li>
                <Link to="/about" className="hover:text-primary-600">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-primary-600">
                  Contact
                </Link>
              </li>
              <li>
                <span className="text-neutral-500">FAQs</span>
              </li>
              <li>
                <span className="text-neutral-500">Blogs</span>
              </li>
            </ul>
          </div>

          {/* Privacy & Terms */}
          <div className="text-center">
            <h5 className="text-neutral-900 font-semibold uppercase tracking-wide mb-3">
              Privacy & Terms
            </h5>
            <ul className="space-y-2 text-neutral-700">
              <li>
                <Link to="/terms-of-service" className="hover:text-primary-600">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-primary-600">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="hover:text-primary-600">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/shipping-policy" className="hover:text-primary-600">
                  Shipping Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} Kanwarji Bhagirath Mal. All rights reserved.
          <p>
            Powered by: RPD Mills and Technologies Private Limited- <a href="https://www.rpdindia.com" className="hover:text-primary-600" target="_blank" rel="noopener noreferrer">www.rpdindia.com</a>
            </p>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
