const PDFDocument = require("pdfkit");

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
            // Header
            doc.fillColor("#2563eb").fontSize(28).text("INVOICE", 50, 50);

            // Company Info
            doc
                .fillColor("#000000")
                .fontSize(12)
                .text("Your Company Name", 400, 50)
                .text("123 Business Street", 400, 65)
                .text("Business City, State 12345", 400, 80)
                .text("Phone: +1 (555) 123-4567", 400, 95)
                .text("Email: info@yourcompany.com", 400, 110);

            // Invoice Details
            doc
                .fontSize(10)
                .fillColor("#666666")
                .text(`Invoice #: ${order.orderId}`, 50, 150)
                .text(
                    `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
                    50,
                    165
                )
                .text(
                    `Due Date: ${new Date(order.estimatedShiprocket).toLocaleDateString()}`,
                    50,
                    180
                )
                .text(`Payment Status: ${order.paymentStatus.toUpperCase()}`, 50, 195);

            // Customer Info
            doc
                .fontSize(12)
                .fillColor("#000000")
                .text("Bill To:", 50, 230)
                .fontSize(10)
                .text(order.address.name, 50, 250)
                .text(order.address.phone, 50, 265)
                .text(order.address.address, 50, 280)
                .text(
                    `${order.address.city}, ${order.address.state} ${order.address.pincode}`,
                    50,
                    295
                );

            // Table Header
            const tableTop = 350;
            doc.fontSize(10).fillColor("#000000");

            // Draw table header background
            doc.rect(50, tableTop, 500, 25).fillColor("#f3f4f6").fill();

            // Table headers
            doc
                .fillColor("#000000")
                .text("Item", 60, tableTop + 8)
                .text("Qty", 300, tableTop + 8)
                .text("Price", 350, tableTop + 8)
                .text("Amount", 450, tableTop + 8);

            // Table Items
            let yPosition = tableTop + 35;
            order.items.forEach((item, index) => {
                const amount = item.price * item.quantity;

                doc
                    .text(item.name, 60, yPosition)
                    .text(item.quantity.toString(), 300, yPosition)
                    .text(`$${item.price.toFixed(2)}`, 350, yPosition)
                    .text(`$${amount.toFixed(2)}`, 450, yPosition);

                yPosition += 20;
            });

            // Totals
            yPosition += 20;
            doc
                .text("Subtotal:", 400, yPosition)
                .text(`$${order.subtotal.toFixed(2)}`, 450, yPosition);

            yPosition += 15;
            doc
                .text("Shiprocket Fee:", 400, yPosition)
                .text(`$${order.shiprocketFee.toFixed(2)}`, 450, yPosition);

            yPosition += 15;
            doc
                .text("Tax:", 400, yPosition)
                .text(`$${order.taxAmount.toFixed(2)}`, 450, yPosition);

            yPosition += 20;
            doc
                .fontSize(12)
                .fillColor("#2563eb")
                .text("Total:", 400, yPosition)
                .text(`$${order.totalAmount.toFixed(2)}`, 450, yPosition);

            // Footer
            doc
                .fontSize(8)
                .fillColor("#666666")
                .text("Thank you for your business!", 50, yPosition + 60)
                .text(
                    "For any questions regarding this invoice, please contact us.",
                    50,
                    yPosition + 75
                );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });

}

module.exports = { generateInvoicePDF };
