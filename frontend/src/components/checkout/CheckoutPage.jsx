import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../Footer";
import useCheckoutData from "./useCheckoutData";
import useCheckoutShipping from "./useCheckoutShipping";
import useCheckoutAddresses from "./useCheckoutAddresses";
import usePlaceOrder from "./usePlaceOrder";
import { computeTaxAmount, computeSavings } from "./utils";
import CheckoutHeader from "./CheckoutHeader";
import CartItemsCard from "./CartItemsCard";
import AddressSection from "./AddressSection";
import PaymentMethodCard from "./PaymentMethodCard";
import OrderSummaryCard from "./OrderSummaryCard";
import ShippingOptionsCard from "./ShippingOptionsCard";
import PlaceOrderBar from "./PlaceOrderBar";
import AddressFormModal from "./AddressFormModal";
import SuccessModal from "./SuccessModal";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const [specialRequest, setSpecialRequest] = useState("");

  const {
    cart,
    addresses,
    selectedAddressId,
    setSelectedAddressId,
    loading,
    loadData,
  } = useCheckoutData();

  const shipping = useCheckoutShipping({
    cart,
    addresses,
    selectedAddressId,
  });

  const addressUi = useCheckoutAddresses({
    loadData,
    selectedAddressId,
    setSelectedAddressId,
  });

  const taxAmount = computeTaxAmount(cart.cartItems || []);
  const shippingFee = Number(shipping.shippingCharge || 0);
  const totalAmount = shipping.clientSubtotal + taxAmount + shippingFee;
  const savings = computeSavings(cart.cartItems || []);

  const { placingOrder, showSuccessModal, orderDetails, placeOrder, handleSuccessModalClose } =
    usePlaceOrder({
      cart,
      addresses,
      selectedAddressId,
      clientSubtotal: shipping.clientSubtotal,
      weight: shipping.weight,
      shippingFee,
      taxAmount,
      totalAmount,
      specialRequest,
      shippingMode: shipping.shippingMode,
      deliveryLat: shipping.deliveryLat,
      deliveryLong: shipping.deliveryLong,
      selectedCourier: shipping.selectedCourier,
      expectedEtaText: shipping.expectedEtaText,
    });

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#FFF5F5" }}
      >
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700">
            Loading checkout...
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Please wait while we prepare your order
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-36 pt-32"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      <CheckoutHeader onBack={() => navigate("/home")} />

      <div className="w-full max-w-4xl mx-auto px-4 pt-4">
        <CartItemsCard
          cart={cart}
          specialRequest={specialRequest}
          setSpecialRequest={setSpecialRequest}
          clientSubtotal={shipping.clientSubtotal}
          taxAmount={taxAmount}
          shippingLoading={shipping.shippingLoading}
          shippingError={shipping.shippingError}
          shippingFee={shippingFee}
          expectedEtaText={shipping.expectedEtaText}
          savings={savings}
          totalAmount={totalAmount}
        />

        <AddressSection
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          setSelectedAddressId={setSelectedAddressId}
          showMenuFor={addressUi.showMenuFor}
          setShowMenuFor={addressUi.setShowMenuFor}
          openAddModal={addressUi.openAddModal}
          openEditModal={addressUi.openEditModal}
          handleDeleteAddress={addressUi.handleDeleteAddress}
        />

        <ShippingOptionsCard
          needsAddress={shipping.needsAddress}
          shippingOptions={shipping.shippingOptions}
          selectedOptionId={shipping.selectedOptionId}
          onSelectOption={shipping.selectShippingOption}
          shippingLoading={shipping.shippingLoading}
          shippingError={shipping.shippingError}
        />

        <PaymentMethodCard />

        <OrderSummaryCard
          cart={cart}
          savings={savings}
          clientSubtotal={shipping.clientSubtotal}
          taxAmount={taxAmount}
          shippingLoading={shipping.shippingLoading}
          shippingError={shipping.shippingError}
          shippingFee={shippingFee}
          totalAmount={totalAmount}
        />

        <div>
          <Footer />
        </div>
      </div>

      <PlaceOrderBar
        totalAmount={totalAmount}
        savings={savings}
        placeOrder={placeOrder}
        selectedAddressId={selectedAddressId}
        cart={cart}
        placingOrder={placingOrder}
        shippingLoading={shipping.shippingLoading}
        shippingError={shipping.shippingError}
      />

      <AddressFormModal
        open={addressUi.showAddModal}
        mode="add"
        form={addressUi.addForm}
        setForm={addressUi.setAddForm}
        onClose={() => addressUi.setShowAddModal(false)}
        onSubmit={addressUi.handleAddAddress}
      />

      <AddressFormModal
        open={addressUi.showEditModal}
        mode="edit"
        form={addressUi.editForm}
        setForm={addressUi.setEditForm}
        onClose={() => addressUi.setShowEditModal(false)}
        onSubmit={addressUi.handleUpdateAddress}
      />

      <SuccessModal
        show={showSuccessModal}
        orderDetails={orderDetails}
        onClose={handleSuccessModalClose}
      />
    </div>
  );
};

export default CheckoutPage;
