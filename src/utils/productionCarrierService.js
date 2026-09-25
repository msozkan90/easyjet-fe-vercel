// Keep the production request in sync with the backend carrierServiceSchema.
// Rate providers may add quote-only fields that the production endpoint rejects.
const PRODUCTION_CARRIER_SERVICE_FIELDS = [
  "carrier",
  "carrierServiceId",
  "serviceName",
  "zone",
  "amount",
  "serviceCode",
  "rateId",
  "shipmentId",
  "deliveryDays",
  "packageTypeId",
  "carrierId",
  "carrierCode",
  "packageCode",
  "confirmation",
  "shipstationOrderId",
  "insuranceValue",
  "insurancePremium",
  "signatureConfirmation",
];

export const toProductionCarrierService = (rate) =>
  Object.fromEntries(
    PRODUCTION_CARRIER_SERVICE_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(rate, field),
    ).map((field) => [field, rate[field]]),
  );

export const getQuotedShippingPrice = (rate, includePostageFee = false) => {
  const amount = Number(rate?.amount);
  if (!Number.isFinite(amount)) return 0;

  const totalAmount = Number(rate?.totalAmount);
  if (includePostageFee && rate?.totalAmount != null && Number.isFinite(totalAmount)) {
    return Math.round((totalAmount + Number.EPSILON) * 100) / 100;
  }

  const postageFee = includePostageFee ? Number(rate?.postageFee ?? 0) : 0;
  const fee = Number.isFinite(postageFee) && postageFee > 0 ? postageFee : 0;
  return Math.round((amount + fee + Number.EPSILON) * 100) / 100;
};
