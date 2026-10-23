const axios = require("axios");
const env = require("../src/config/env");

const INSTAMOJO_API_KEY = env.INSTAMOJO_API_KEY;
const INSTAMOJO_AUTH_TOKEN = env.INSTAMOJO_AUTH_TOKEN;

const instamojoClient = axios.create({
  baseURL: "https://www.instamojo.com/api/1.1/",
  headers: {
    "X-Api-Key": INSTAMOJO_API_KEY,
    "X-Auth-Token": INSTAMOJO_AUTH_TOKEN,
    "Content-Type": "application/json",
  },
});

async function processInstamojoRefund(order) {

    try {
        // Only process refunds for Instamojo payments with valid payment ID
        if (order.paymentMethod !== "online" || !order.paymentId) {
            console.log(`Skipping Instamojo refund: paymentMethod=${order.paymentMethod}, paymentId=${order.paymentId}`);
            return { success: true, skipped: true };
        }

        console.log(`Processing Instamojo refund for order ${order.orderId}, transactionId: ${order.paymentId}`);

        // Request refund via Instamojo API
        const refundResponse = await instamojoClient.post("/refunds/", {
            transaction_id: order.paymentId,
            type: "RFD",
            body: `Refund for cancelled order ${order.orderId}`
        });

        console.log(`Instamojo refund response:`, refundResponse.data);

        if (refundResponse.data?.success || refundResponse.status === 201) {
            return {
                success: true,
                refundId: refundResponse.data?.refund_id,
                amount: order.totalAmount,
                status: "processed"
            };
        } else {
            console.warn(`Instamojo refund may have failed:`, refundResponse.data);
            return {
                success: false,
                error: refundResponse.data?.message || "Refund request failed"
            };
        }
    } catch (error) {
        console.error(`Instamojo refund error for order ${order.orderId}:`, error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message || "Failed to process refund"
        };
    }

}

module.exports = {
  instamojoClient,
  processInstamojoRefund,
  INSTAMOJO_API_KEY,
  INSTAMOJO_AUTH_TOKEN,
};
