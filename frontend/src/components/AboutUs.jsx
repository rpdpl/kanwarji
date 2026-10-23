import React from "react";
import { useSEO } from "../utils/Seo";
import Footer from "./Footer";

const AboutUs = () => {
  useSEO({
    title:
      "Kanwarji Dalbijiwala - Authentic Indian Sweets & Namkeen Since 175 Years",
    description:
      "Kanwarji offers traditional, authentic Indian sweets, namkeen, and chats crafted with 175 years of tradition, quality, and trust. Taste true Indian flavors at Kanwarji.in.",
    canonical: "https://kanwarji.in/about",
    keywords:
      "buy sweets online, traditional Indian sweets, best sweets in Delhi, Chandni Chowk sweets, Indian mithai online, dry fruits gift pack online, Diwali sweets hamper, wedding sweets box, buy namkeen online, kaju katli online, buy kaju katli online, traditional kaju katli, best kaju katli in Delhi, buy soan papdi online, premium soan papdi, Diwali soan papdi box, dry fruit hamper, festive dry fruit basket, dry fruit gift box online, traditional namkeen online, Chandni Chowk namkeen, spicy Indian namkeen, Indian sweets gift box, corporate gifting sweets, wedding sweet box, authentic Indian sweets online, premium mithai delivery in Delhi, order sweets from Chandni Chowk, online delivery of traditional Indian sweets, send sweets to USA from India, best Diwali sweets under 500, best Diwali sweets under 1000, customized wedding sweets box online, handmade sweets online India, online mithai shop Delhi, Buy Namkeen Online, Buy Indian Mithai Online, Chandni Chowk sweets, Chandni Chowk Sweets Online, Old Delhi Namkeen, Kanwarji DalBijiwala, Desi Ghee Gulab Jamun Tin, International Shipping Indian Snacks, Healthy Indian Snacks, Roasted Snacks India, No Preservatives Namkeen, Pure Desi Ghee Sweets, Guilt-Free Indulgence, Dry Fruit Gift Hamper, Corporate Gift Hampers India, Diwali Gift Hampers, Rakhi Gift Boxes, Luxury Food Hampers, Wedding Gift Hampers, Traditional Indian Gift Ideas",
  });
  return (
    <div className="w-full px-4 py-6">
      
      <header
        className="rounded-xl mb-4 px-4 py-3 text-white shadow-soft"
        style={{
          backgroundColor: "#EE2225",
          border: "1px solid #C81416",
        }}
      >
        <h1 className="text-lg font-bold">About us</h1>
      </header>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4 leading-relaxed text-neutral-700">
        <h1 className="text-2xl md:text-3xl font-extrabold text-red-700 mb-2 text-center">
          Kanwarji Bhagirathmal (Dalbijiwala): A Legacy of Taste Since 1850, Now
          Online
        </h1>
        <h2 className="text-lg md:text-xl font-semibold text-neutral-800 mb-4 text-center">
          Step into the timeless flavors of Chandni Chowk with Kanwarji
          Bhagirathmal Dalbiji Waley—now just a click away. Our online store
          brings 175+ years of culinary heritage to your doorstep, preserving
          the soul of Old Delhi in every bite.
        </h2>
        <section className="mb-6">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">🏛️</span>
            <h3 className="text-xl font-bold text-red-600">Our Heritage</h3>
          </div>
          <p className="ml-7 text-base md:text-lg text-neutral-700">
            Founded in the 1850s, Kanwarji Bhagirathmal (Dalbijiwala) is one of
            the oldest and most beloved sweet and namkeen shops in Delhi’s
            historic walled city. Nestled near Parathey Wali Gali, our name is
            synonymous with purity, tradition, and unmatched taste. For
            generations, we’ve handcrafted delicacies using pure desi ghee and
            secret family recipes passed down with reverence.
          </p>
        </section>
        <section className="mb-6">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">🌟</span>
            <h3 className="text-xl font-bold text-yellow-600">
              Signature Delights
            </h3>
          </div>
          <p className="ml-7 text-base md:text-lg text-neutral-700 mb-2">
            We are famed for our iconic Dalbiji—a crispy, spicy namkeen that has
            become a ritual favorite across India and abroad. Our shelves also
            feature:
          </p>
          <ul className="ml-10 list-disc space-y-1 text-base md:text-lg">
            <li>
              Aloo ke Lachha, Shahi Mixture and Sem Beej for savory indulgence
            </li>
            <li>
              Panjiri Laddoo, Sohan Halwa, Karachi Halwa, and Pure Pista Lauj
              for festive sweetness
            </li>
            <li>
              Badam Lauj—Rich, melt-in-mouth almond delicacy crafted with pure
              desi ghee and traditional finesse.
            </li>
            <li>
              Akhrot (Walnut) Lauj- Luxurious walnut confection, delicately set
              in desi ghee for rich, nutty indulgence.
            </li>
            <li>
              Pumpkin Seeds Lauj- delicate fusion of roasted seeds and desi
              ghee, offering nutty sweetness with a festive crunch.
            </li>
          </ul>
          <p className="ml-7 mt-2 text-base md:text-lg text-neutral-700">
            Each item is crafted to honor tradition while meeting modern
            standards of freshness and hygiene.
          </p>
        </section>
        <section className="mb-6">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">🚚</span>
            <h3 className="text-xl font-bold text-blue-600">
              From Chandni Chowk to Your Home
            </h3>
          </div>
          <p className="ml-7 text-base md:text-lg text-neutral-700 mb-2">
            Whether you're in Delhi NCR or overseas, our online store ensures:
          </p>
          <ul className="ml-10 list-disc space-y-1 text-base md:text-lg">
            <li>Same-day delivery in NCR</li>
            <li>Global shipping for select products</li>
            <li>Combo packs, gift boxes, and corporate gifting options</li>
            <li>Exclusive offers</li>
          </ul>
        </section>
        <section className="mb-6">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">🙏</span>
            <h3 className="text-xl font-bold text-green-600">Why Choose Us?</h3>
          </div>
          <ul className="ml-10 list-disc space-y-1 text-base md:text-lg">
            <li>Authenticity: Every product echoes the spirit of Delhi 6</li>
            <li>
              Purity: No compromise on ingredients—only the finest desi ghee and
              dry fruits
            </li>
            <li>Legacy: A trusted name for over 175 years</li>
          </ul>
        </section>
        <p className="text-center text-base md:text-lg font-medium text-neutral-800 mt-6">
          Visit{" "}
          <a
            href="https://kanwarji.in"
            className="text-red-600 underline font-semibold"
            target="_blank"
            rel="noopener noreferrer"
          >
            kanwarji.in
          </a>{" "}
          to explore our full range and bring home the taste of tradition.
          <br />
          Kanwarji Bhagirathmal (Dalbijiwala) isn’t just food—it’s a sacred
          offering of flavor, memory, and heritage.
        </p>
      </div>

      {/* SEO Keywords Section for search engines and users */}
      <section className="w-full px-4 py-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm text-center"></section>
      <section className="w-full px-4 py-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm text-center">
        <h2 className="text-xl font-bold text-red-700 mb-2">
          Authentic Old Delhi Flavors & Gift Hampers
        </h2>
        <p className="text-base text-neutral-700 mb-1">
          Luxury sweets hamper India, diwali dry fruits & barfi hamper, online
          mithai shop India shipping, premium pista roasted Indian style,
          traditional Indian sweets online gift, Delhi sweet shop since 1850,
          best mithai box Delhi NCR, savory mixture Delhi special recipe, pure
          ghee pedas Delhi shop, dry fruits dates box premium India,
          personalised sweets box India, festive munchies & namkeen online
          India, premium mithai delivery in Delhi, order sweets from Chandni
          Chowk, online delivery of traditional Indian sweets, send sweets to
          USA from India, best Diwali sweets under 500/1000, customized wedding
          sweets box online, handmade sweets online India, online mithai shop
          Delhi.
        </p>
        <p className="text-base text-neutral-700 mb-1">
          Popular products: buy kaju katli online, traditional kaju katli, best
          kaju katli in Delhi, buy soan papdi online, premium soan papdi, Diwali
          soan papdi box, dry fruit hamper, festive dry fruit basket, dry fruit
          gift box online, traditional namkeen online, Chandni Chowk namkeen,
          spicy Indian namkeen, Indian sweets gift box, corporate gifting
          sweets, wedding sweet box.
        </p>
        <p className="text-base text-neutral-700 mb-1">
          Festive sweets collection Delhi, gulaab jamun Delhi famous shop,
          namkeen gift pack Diwali India, dry fruits hamper for wedding return
          gift, sugar-free sweets Delhi online, custom sweets boxes Delhi, kids
          birthday sweets Delhi delivery, chutney & savory snack Delhi namkeen,
          imported dry fruits India Delhi supplier, order sweets same day Delhi
          NCR.
        </p>
      </section>
      <Footer />
    </div>
  );
};

export default AboutUs;
