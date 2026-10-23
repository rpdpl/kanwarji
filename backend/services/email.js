const nodemailer = require("nodemailer");
const env = require("../src/config/env");

const transporter = nodemailer.createTransport({
  service: env.EMAIL_SERVICE || "gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("Email transporter verification failed:", err?.message || err);
  } else {
    console.log("Email transporter is ready to send messages");
  }
});

function formatIST(date) {

    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).formatToParts(new Date(date));

        const get = (type) => parts.find(p => p.type === type)?.value || '';
        const day = get('day');
        const month = get('month');
        const year = get('year');
        let hour = get('hour');
        const minute = get('minute');
        const dayPeriod = (get('dayPeriod') || '').toUpperCase();
        if (hour && hour.length === 1) hour = '0' + hour;
        return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod} (IST)`;
    } catch {
        return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }

}

async function sendSignupMail({ name, email, phone }) {

    const mailOptions = {
        from: env.EMAIL_USER,
        to: email,
        subject: "Welcome to Our Platform!",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Welcome, ${name}!</h2>
        <p>Thank you for signing up at our platform. Here are your registration details:</p>
        <ul>
          <li><b>Name:</b> ${name}</li>
          <li><b>Email:</b> ${email}</li>
          <li><b>Phone:</b> ${phone}</li>
        </ul>
        <p>We're excited to have you on board!</p>
        <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
          This is an automated email. Please do not reply.
        </p>
      </div>
    `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation email sent to ${user.email} for ${order.orderId}`);
    } catch (e) {
        console.error("Order confirmation email send failed:", e?.response?.toString?.() || e?.message || e);
        throw e;
    }

}

async function sendPaymentSuccessEmail(user, order) {

    const itemsList = order.items
        .map(
            (item) =>
                `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${item.name}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">₹${item.price}</td>
                </tr>`
        )
        .join("");

    const mailOptions = {
        from: env.EMAIL_USER,
        to: user.email,
        subject: `Payment Successful - Order ${order.orderId}`,
        html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f9f9f9;">
        <!-- Success Banner -->
        <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
          <h2 style="margin: 0; font-size: 28px; font-weight: bold;">Payment Successful!</h2>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px; background-color: white;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Hello <strong>${user.name}</strong>,</p>
          <p style="margin: 0 0 25px 0; font-size: 14px; color: #666; line-height: 1.6;">Your payment has been successfully processed. Thank you for your order!</p>

          <!-- Payment Confirmation Box -->
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #4CAF50;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Payment Confirmation</h3>
            <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Order ID:</strong> ${order.orderId}</p>
            <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Payment Status:</strong> <span style="color: #4CAF50; font-weight: bold;">PAID ✓</span></p>
            <p><strong>Amount Paid:</strong> <span>₹${(Number(order.totalAmount || 0) + Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</span></p>
            <p><strong>Date & Time:</strong> ${formatIST(order.paidAt || order.updatedAt || order.createdAt)}</p>
          </div>

          <!-- Order Summary -->
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Order Summary</h3>
          <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 12px; text-align: left; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Item</th>
                <th style="padding: 12px; text-align: center; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 12px; text-align: right; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>

          <!-- Cost Breakdown -->
<div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
  <p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;">
    <span>Subtotal:</span> <strong>₹${Number(order.subtotal || 0).toFixed(2)}</strong>
  </p>
  ${order.taxAmount ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Tax:</span> <strong>₹${Number(order.taxAmount || 0).toFixed(2)}</strong></p>` : ""}
  ${order.shiprocketFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Shiprocket Fee:</span> <strong>₹${Number(order.shiprocketFee || 0).toFixed(2)}</strong></p>` : ""}
 ${order.convenienceFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Convenience Fee:</span> <strong>₹${(Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong></p>` : ""}
  <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 2px solid #ddd; color: #333; font-size: 16px; display: flex; justify-content: space-between;">
    <span><strong>Total Paid:</strong></span> <strong style="color: #4CAF50;">₹${(Number(order.totalAmount || 0) + Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong>
  </p>
</div>

          <!-- What's Next -->
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4CAF50;">
            <h3 style="margin: 0 0 12px 0; color: #2e7d32; font-size: 16px;">What's Next?</h3>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your order is confirmed and ready for processing</p>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ You will receive tracking information once your order ships</p>
          </div>

          <!-- Shiprocket Address -->
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #1565c0; font-size: 16px;">Shiprocket Address</h3>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">
              <strong>${order.address.name}</strong><br>
              ${order.address.phone}<br>
              ${order.address.address}<br>
              ${order.address.city}, ${order.address.state} - ${order.address.pincode}
            </p>
          </div>

          <!-- Support -->
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.6;">
            If you have any questions about your order, please don't hesitate to <strong>contact us</strong> or reply to this email. We're here to help!
          </p>

          <p style="margin: 0; font-size: 14px; color: #999;">Thank you for shopping with us! We appreciate your business.</p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; font-size: 12px; color: #999;">
            This is an automated email. Please do not reply directly to this email.<br>
            For support, visit our website or contact us at kanwarji@rpdindia.com
          </p>
        </div>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);

}

async function sendOrderConfirmationEmail(user, order) {

    const itemsList = order.items
        .map(
            (item) =>
                `<li>${item.name} - Qty: ${item.quantity} -  ₹${item.price}</li>`
        )
        .join("");
    const mailOptions = {
        from: env.EMAIL_USER,
        to: user.email,
        subject: `Order Confirmation - ${order.orderId}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4CAF50; text-align: center;">Order Confirmed!</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for your order. Here are the details:</p>
                <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> ${order.orderId}</p>
          <p><strong>Total Amount:</strong>  ₹${order.totalAmount}</p>
          <p><strong>Payment Method:</strong> ${order.paymentMethod === "cod"
                ? "Cash on Shiprocket"
                : "Online Payment"
            }</p>
          <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
          <p><strong>Estimated Shiprocket:</strong> ${order.estimatedShiprocket.toDateString()}</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>Items Ordered</h3>
          <ul>${itemsList}</ul>
        </div>
        <div style="background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>Shiprocket Address</h3>
          <p>${order.address.name}<br>
          ${order.address.phone}<br>
          ${order.address.address}<br>
          ${order.address.city}, ${order.address.state} - ${order.address.pincode
            }</p>
        </div>
        <p>We'll keep you updated on your order status.</p>
        <p>Thank you for shopping with us!</p>
                <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
          This is an automated email. Please do not reply.
        </p>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);

}

async function sendOrderCancellationEmail(user, order, cancellationReason) {

    const itemsList = order.items
        .map(
            (item) =>
                `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${item.name}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">₹${item.price}</td>
                </tr>`
        )
        .join("");

    const refundInfo = order.paymentMethod === "online" && order.paymentStatus === "paid"
        ? `
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
              <h3 style="margin: 0 0 12px 0; color: #856404; font-size: 16px;">Refund Information</h3>
              <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your payment of <strong>₹${order.totalAmount}</strong> will be refunded to your original payment method.</p>
              <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Refund processing typically takes 3-5 business days.</p>
            </div>
          `
        : ``;

    const mailOptions = {
        from: env.EMAIL_USER,
        to: user.email,
        subject: `Order Cancelled - ${order.orderId}`,
        html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f9f9f9;">
        <!-- Cancellation Banner -->
        <div style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); padding: 30px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">✗</div>
          <h2 style="margin: 0; font-size: 28px; font-weight: bold;">Order Cancelled</h2>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px; background-color: white;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Hello <strong>${user.name}</strong>,</p>
          <p style="margin: 0 0 25px 0; font-size: 14px; color: #666; line-height: 1.6;">Your order has been successfully cancelled. Here are the details:</p>

          <!-- Cancellation Details -->
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f44336;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Cancellation Details</h3>
            <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Order ID:</strong> ${order.orderId}</p>
          <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Cancellation Date & Time:</strong> ${formatIST(order.cancelledAt || order.updatedAt || order.createdAt)}</p>
            ${cancellationReason ? `<p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Reason:</strong> ${cancellationReason}</p>` : ""}
          </div>

          <!-- Order Summary -->
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Order Summary</h3>
          <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 12px; text-align: left; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Item</th>
                <th style="padding: 12px; text-align: center; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 12px; text-align: right; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>

          <!-- Cost Breakdown -->
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
  <p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;">
    <span>Subtotal:</span> <strong>₹${Number(order.subtotal || 0).toFixed(2)}</strong>
  </p>
  ${order.taxAmount ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Tax:</span> <strong>₹${Number(order.taxAmount || 0).toFixed(2)}</strong></p>` : ""}
  ${order.shiprocketFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Shiprocket Fee:</span> <strong>₹${Number(order.shiprocketFee || 0).toFixed(2)}</strong></p>` : ""}
 ${order.convenienceFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Convenience Fee:</span> <strong>₹${(Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong></p>` : ""}
  <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 2px solid #ddd; color: #333; font-size: 16px; display: flex; justify-content: space-between;">
    <span><strong>Total:</strong></span> <strong style="color: #d32f2f;">₹${(Number(order.totalAmount || 0) + Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong>
  </p>
</div>

          <!-- Refund Information -->
          ${refundInfo}

          <!-- Next Steps -->
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #1565c0; font-size: 16px;">What Happens Next?</h3>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your order has been removed from processing</p>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ No shipment will be sent for this order</p>
            ${order.paymentMethod === "online" && order.paymentStatus === "paid" ? `<p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your refund will be processed within 3-5 business days</p>` : ""}
          </div>

          <!-- Support -->
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.6;">
            If you have any questions about your cancellation, please don't hesitate to <strong>contact us</strong>. We're here to help!
          </p>

          <p style="margin: 0; font-size: 14px; color: #999;">We hope to serve you again in the future.</p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; font-size: 12px; color: #999;">
            This is an automated email. Please do not reply directly to this email.<br>
            For support, visit our website or contact us at kanwarji@rpdindia.com
          </p>
        </div>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);

}

async function sendMail(mailOptions) {
  return transporter.sendMail(mailOptions);
}

module.exports = {
  transporter,
  formatIST,
  sendSignupMail,
  sendPaymentSuccessEmail,
  sendOrderConfirmationEmail,
  sendOrderCancellationEmail,
  sendMail,
};
