const PDFDocument = require("pdfkit");
const {
  formatShippingSummary,
  getShippingModeLabel,
} = require("./orderShippingSummary");

async function generateInvoicePDF(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on("error", reject);

    try {
      doc.fillColor("#c41214").fontSize(28).text("INVOICE", 50, 50);

      doc
        .fillColor("#000000")
        .fontSize(12)
        .text("Kanwarji Bhagirath Mal", 350, 50)
        .fontSize(9)
        .text("1972, Chandni Chowk", 350, 68)
        .text("Delhi- 110006. Delhi. Bharat (India)", 350, 80)
        .text("Phone: +91-9811049585", 350, 92)
        .text("Email: kanwarji@rpdindia.com", 350, 104);

      doc
        .fontSize(10)
        .fillColor("#666666")
        .text(`Invoice #: ${order.orderId}`, 50, 150)
        .text(
          `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`,
          50,
          165
        )
        .text(
          `Payment Status: ${String(order.paymentStatus || "").toUpperCase()}`,
          50,
          180
        );

      const shippingSummary = formatShippingSummary(order);
      if (shippingSummary) {
        doc.text(`Shipping: ${shippingSummary}`, 50, 195);
      }

      doc
        .fontSize(12)
        .fillColor("#000000")
        .text("Bill To:", 50, 230)
        .fontSize(10)
        .text(order.address?.name || "", 50, 250)
        .text(order.address?.phone || "", 50, 265)
        .text(order.address?.address || "", 50, 280)
        .text(
          `${order.address?.city || ""}, ${order.address?.state || ""} ${order.address?.pincode || ""}`,
          50,
          295
        );

      const tableTop = 340;
      doc.fontSize(10).fillColor("#000000");
      doc.rect(50, tableTop, 500, 25).fillColor("#f3f4f6").fill();

      doc
        .fillColor("#000000")
        .text("Item", 60, tableTop + 8)
        .text("Qty", 300, tableTop + 8)
        .text("Price", 350, tableTop + 8)
        .text("Amount", 450, tableTop + 8);

      let yPosition = tableTop + 35;
      (order.items || []).forEach((item) => {
        const amount = Number(item.price || 0) * Number(item.quantity || 0);
        doc
          .text(String(item.name || ""), 60, yPosition, { width: 220 })
          .text(String(item.quantity || 0), 300, yPosition)
          .text(`₹${Number(item.price || 0).toFixed(2)}`, 350, yPosition)
          .text(`₹${amount.toFixed(2)}`, 450, yPosition);
        yPosition += 20;
      });

      yPosition += 16;
      doc
        .fontSize(10)
        .fillColor("#000000")
        .text("Subtotal:", 380, yPosition)
        .text(`₹${Number(order.subtotal || 0).toFixed(2)}`, 450, yPosition);

      yPosition += 15;
      doc
        .text("Shipping fee:", 380, yPosition)
        .text(`₹${Number(order.shiprocketFee || 0).toFixed(2)}`, 450, yPosition);

      yPosition += 12;
      doc
        .fontSize(9)
        .fillColor("#555555")
        .text(`Mode: ${getShippingModeLabel(order)}`, 380, yPosition);
      if (order.courierName) {
        yPosition += 12;
        doc.text(`Courier: ${order.courierName}`, 380, yPosition);
      }
      if (order.courierEtd) {
        yPosition += 12;
        doc.text(`ETA: ${order.courierEtd}`, 380, yPosition);
      }

      yPosition += 15;
      doc
        .fontSize(10)
        .fillColor("#000000")
        .text("Tax:", 380, yPosition)
        .text(`₹${Number(order.taxAmount || 0).toFixed(2)}`, 450, yPosition);

      const conv = Number(order.convenienceFee || 0) * 1.18;
      if (conv > 0) {
        yPosition += 15;
        doc
          .text("Convenience fee:", 380, yPosition)
          .text(`₹${conv.toFixed(2)}`, 450, yPosition);
      }

      yPosition += 20;
      const grand =
        Number(order.totalAmount || 0) + Number(order.convenienceFee || 0) * 1.18;
      doc
        .fontSize(12)
        .fillColor("#c41214")
        .text("Total:", 380, yPosition)
        .text(`₹${grand.toFixed(2)}`, 450, yPosition);

      doc
        .fontSize(8)
        .fillColor("#666666")
        .text("Thank you for shopping with Kanwarji Bhagirath Mal!", 50, yPosition + 50)
        .text(
          "For questions about this invoice, contact kanwarji@rpdindia.com",
          50,
          yPosition + 65
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateInvoicePDF };
