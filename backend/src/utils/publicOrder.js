/**
 * Shape Order documents for customer-facing APIs.
 * Omits payment gateway ids, vendor errors, drop coords, courier company ids, admin fields.
 */

function mapPublicItem(item) {
  if (!item) return null;
  const raw = item.toObject ? item.toObject() : item;
  return {
    name: raw.name,
    price: raw.price,
    quantity: raw.quantity,
    unit: raw.unit || "",
    variantLabel: raw.variantLabel || "",
    tax: Number(raw.tax || 0),
    discount: Number(raw.discount || 0),
    sellerName: raw.sellerName || "",
    imageUrl: raw.imageUrl || undefined,
  };
}

function toPublicOrder(order) {
  if (!order) return null;
  const o = order.toObject ? order.toObject() : order;

  return {
    _id: o._id,
    orderId: o.orderId,
    items: (o.items || []).map(mapPublicItem).filter(Boolean),
    address: o.address
      ? {
          name: o.address.name,
          phone: o.address.phone,
          address: o.address.address,
          city: o.address.city,
          state: o.address.state,
          pincode: o.address.pincode,
        }
      : undefined,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    subtotal: o.subtotal,
    shiprocketFee: o.shiprocketFee,
    taxAmount: o.taxAmount,
    totalAmount: o.totalAmount,
    convenienceFee: Number(o.convenienceFee || 0),
    specialRequests: o.specialRequests || null,
    shippingMode: o.shippingMode,
    requestedShippingMode: o.requestedShippingMode,
    shippingFallbackUsed: !!o.shippingFallbackUsed,
    courierName: o.courierName || undefined,
    courierRate: o.courierRate != null ? Number(o.courierRate) : undefined,
    courierEtd: o.courierEtd || undefined,
    awbNumber: o.awbNumber || undefined,
    shipmentStatus: o.shipmentStatus || undefined,
    estimatedShiprocket: o.estimatedShiprocket || undefined,
    isLocalShiprocket: !!o.isLocalShiprocket,
    paidAt: o.paidAt || undefined,
    cancelledAt: o.cancelledAt || undefined,
    cancellationReason: o.cancellationReason || undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function toPublicOrders(orders) {
  return (orders || []).map(toPublicOrder).filter(Boolean);
}

module.exports = {
  toPublicOrder,
  toPublicOrders,
};
