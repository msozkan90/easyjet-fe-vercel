export const FUNDING_ACCOUNT_DETAIL_FIELDS_BY_TYPE = {
  zelle: [
    "first_name",
    "last_name",
    "company_name",
    "phone_number",
    "email_address",
  ],
  wire: [
    "first_name",
    "last_name",
    "company_address",
    "company_name",
    "email_address",
    "phone_number",
    "account_number",
    "routing_number",
  ],
  ach: [
    "first_name",
    "last_name",
    "company_address",
    "company_name",
    "email_address",
    "phone_number",
    "account_number",
    "routing_number",
  ],
};

export const getFundingAccountDetailFields = (type) =>
  FUNDING_ACCOUNT_DETAIL_FIELDS_BY_TYPE[type] || [];

export const pickFundingAccountDetails = (type, details = {}) =>
  getFundingAccountDetailFields(type).reduce((acc, field) => {
    acc[field] = details?.[field] || "";
    return acc;
  }, {});
