import React from "react";
import { useSEO } from "../utils/Seo";
import {
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaFacebook,
  FaInstagram,
} from "react-icons/fa";
import Footer from "./Footer";

const ContactUs = () => {
  useSEO({
    title:
      "Kanwarji Dalbijiwala - Authentic Indian Sweets & Namkeen Since 175 Years",
    description:
      "Kanwarji offers authentic Indian sweets, namkeen, and chats crafted with 175 years of tradition, quality, and trust. Taste true Indian flavors at Kanwarji.in.",
    canonical: "https://kanwarji.in/contact",
  });
  return (
    <div
      className="min-h-screen py-32 px-4"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      <div className="w-full">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
            📞 Contact Us
          </h1>
          <p className="text-neutral-600 font-medium">
            We'd love to hear from you! Reach out to us through any of the
            following ways.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Address Section */}
          <div className="bg-white rounded-3xl border-2 border-neutral-300 p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-red-100">
                <FaMapMarkerAlt className="text-2xl text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-800 mb-2">
                  Our Address
                </h2>
                <p className="text-neutral-600 leading-relaxed">
                  {/* Replace with actual address */}
                  Kanwarji Bhagirath Mal 1972, CHANDNI, CHOWK,
                  <br />
                  Delhi, 110006. Delhi
                  <br />
                  Bharat (India)
                </p>
              </div>
            </div>
          </div>

          {/* Phone & Email Section */}
          <div className="bg-white rounded-3xl border-2 border-neutral-300 p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="space-y-4">
              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-green-100">
                  <FaPhone className="text-2xl text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-800 mb-2">
                    Phone
                  </h2>
                  <a
                    href="tel: +91-9811049585"
                    className="text-neutral-600 hover:text-red-600 transition-colors"
                  >
                    +91-9811049585
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-blue-100">
                  <FaEnvelope className="text-2xl text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-800 mb-2">
                    Email
                  </h2>
                  <a
                    href="mailto:kanwarjibhagirathmal@gmail.com"
                    className="text-neutral-600 hover:text-red-600 transition-colors"
                  >
                    kanwarjibhagirathmal@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Social Media Section - Full Width */}
          <div className="md:col-span-2 bg-white rounded-3xl border-2 border-neutral-300 p-6 shadow-lg hover:shadow-xl transition-shadow">
            <h2 className="text-xl font-bold text-neutral-800 mb-4 text-center">
              Follow Us
            </h2>
            <div className="flex justify-center gap-6">
              {/* Facebook */}
              <a
                href="https://www.facebook.com/share/1DogQsciZL/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-2"
              >
                <div className="p-4 rounded-full bg-blue-100 group-hover:bg-blue-600 transition-colors">
                  <FaFacebook className="text-3xl text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-sm font-medium text-neutral-600 group-hover:text-blue-600 transition-colors">
                  Facebook
                </span>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/kanwarji_1850"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-2"
              >
                <div className="p-4 rounded-full bg-pink-100 group-hover:bg-gradient-to-br group-hover:from-purple-600 group-hover:via-pink-600 group-hover:to-orange-600 transition-all">
                  <FaInstagram className="text-3xl text-pink-600 group-hover:text-white transition-colors" />
                </div>
                <span className="text-sm font-medium text-neutral-600 group-hover:text-pink-600 transition-colors">
                  Instagram
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Google Maps Section */}
        <div className="mt-8 bg-white rounded-3xl border-2 border-neutral-300 p-6 shadow-lg">
          <h2 className="text-xl font-bold text-neutral-800 mb-4 text-center">
            📍 Find Us Here
          </h2>
          <div className="w-full h-96 rounded-2xl overflow-hidden shadow-md">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3501.118079599181!2d77.2281659!3d28.6561829!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390cfd1a88feaca1%3A0xe19d1313f98261b0!2sKANWARJI%20BHAGIRATHMAL!5e0!3m2!1sen!2sin!4v1763375660661!5m2!1sen!2sin"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Business Location"
            ></iframe>
          </div>
          <div className="mt-4 text-center">
            <a
              href="https://www.google.com/maps/place/KANWARJI+BHAGIRATHMAL/@28.6561829,77.2281659,17z/data=!4m14!1m7!3m6!1s0x390cfd1a88feaca1:0xe19d1313f98261b0!2sKANWARJI+BHAGIRATHMAL!8m2!3d28.6561782!4d77.2307408!16s%2Fg%2F1v41yvc2!3m5!1s0x390cfd1a88feaca1:0xe19d1313f98261b0!8m2!3d28.6561782!4d77.2307408!16s%2Fg%2F1v41yvc2?entry=ttu&g_ep=EgoyMDI1MTEwNC4xIKXMDSoASAFQAw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              Open in Google Maps
            </a>
          </div>
        </div>

        {/* Additional Info Section */}
        <div className="mt-8 bg-white rounded-3xl border-2 border-neutral-300 p-6 shadow-lg text-center">
          <h3 className="text-lg font-bold text-neutral-800 mb-2">
            Business Hours
          </h3>
          <p className="text-neutral-600">
            Monday - Saturday: 9:00 AM - 8:00 PM
            <br />
            Sunday: 10:00 AM - 6:00 PM
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContactUs;
