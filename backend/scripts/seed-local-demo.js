/**
 * Seed local Mongo (vikas_local) with admin, buyer, products, and demo addresses.
 *
 * Usage: node scripts/seed-local-demo.js
 *
 * Logins:
 *   Admin  → admin@local.test / admin123
 *   Buyer  → buyer@local.test / buyer123
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User, Item, Address } = require("../src/models");

const ADMIN = {
  name: "Local Admin",
  email: "admin@local.test",
  phone: "9000000001",
  password: "admin123",
};

const BUYER = {
  name: "Local Buyer",
  email: "buyer@local.test",
  phone: "9000000002",
  password: "buyer123",
};

const PRODUCTS = [
  {
    name: "Kaju Katli Box",
    productDetails: "Premium cashew sweets — demo product for local testing",
    price: 449,
    category: "Mithai",
    quantity: 50,
    unit: "500g",
    discount: 5,
    tax: 5,
  },
  {
    name: "Besan Ladoo",
    productDetails: "Fresh besan ladoo — demo product",
    price: 299,
    category: "Mithai",
    quantity: 80,
    unit: "500g",
    discount: 0,
    tax: 5,
  },
  {
    name: "Dry Fruit Mix",
    productDetails: "Assorted dry fruits gift pack — demo",
    price: 799,
    category: "Dry Fruits",
    quantity: 40,
    unit: "1kg",
    discount: 10,
    tax: 5,
    isSpecialItem: true,
  },
];

async function upsertUser({ name, email, phone, password, userType }) {
  const hash = await bcrypt.hash(password, 10);
  let user = await User.findOne({ $or: [{ email }, { phone }] });
  if (user) {
    user.name = name;
    user.email = email;
    user.phone = phone;
    user.password = hash;
    user.userType = userType;
    user.isActive = true;
    user.isVerified = true;
    user.updatedAt = new Date();
    await user.save();
    console.log(`Updated ${userType}:`, email, `/ ${password}`);
    return user;
  }
  user = await User.create({
    name,
    email,
    phone,
    password: hash,
    userType,
    isActive: true,
    isVerified: true,
  });
  console.log(`Created ${userType}:`, email, `/ ${password}`);
  return user;
}

async function ensureProducts(admin) {
  const created = [];
  for (const p of PRODUCTS) {
    let item = await Item.findOne({ name: p.name, sellerId: admin._id });
    if (!item) {
      item = await Item.create({
        ...p,
        sellerId: admin._id,
        sellerName: "admin",
        storeName: "Kanwarji Local Demo",
        isAvailable: true,
      });
      console.log("Created product:", item.name);
    } else {
      Object.assign(item, p, {
        isAvailable: true,
        sellerName: "admin",
        updatedAt: new Date(),
      });
      await item.save();
      console.log("Updated product:", item.name);
    }
    created.push(item);
  }
  return created;
}

async function ensureAddresses(buyer) {
  const demos = [
    {
      title: "Home",
      name: BUYER.name,
      phone: BUYER.phone,
      address: "12 Chandni Chowk Road, near Red Fort",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110006",
      latitude: 28.65609,
      longitude: 77.230721,
      preferredShippingMode: "quick",
      isDefault: true,
    },
    {
      title: "Office",
      name: BUYER.name,
      phone: BUYER.phone,
      address: "Connaught Place Block A, Outer Circle",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      latitude: 28.6315,
      longitude: 77.2167,
      preferredShippingMode: "quick",
      isDefault: false,
    },
    {
      title: "Other",
      name: BUYER.name,
      phone: BUYER.phone,
      address: "Andheri West demo street 21",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400058",
      preferredShippingMode: "standard",
      isDefault: false,
    },
  ];

  // Keep at most 3 addresses for this buyer (API limit)
  await Address.deleteMany({ userId: buyer._id });

  for (const a of demos) {
    const doc = await Address.create({ userId: buyer._id, ...a });
    console.log(
      `Address: ${doc.title} ${doc.pincode} (${doc.preferredShippingMode})`
    );
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/vikas_local";
  await mongoose.connect(uri);
  console.log("Mongo:", uri);

  const admin = await upsertUser({ ...ADMIN, userType: "admin" });
  const buyer = await upsertUser({ ...BUYER, userType: "buyer" });
  await ensureProducts(admin);
  await ensureAddresses(buyer);

  console.log("\n=== Local demo ready ===");
  console.log("Shop login:  buyer@local.test / buyer123");
  console.log("Admin login: admin@local.test / admin123");
  console.log("Buyer has 2 Delhi Quick addresses + 1 Mumbai Standard");
  console.log("========================\n");

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
