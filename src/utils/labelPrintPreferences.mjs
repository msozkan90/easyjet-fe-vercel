// Printer names and driver settings belong to the workstation, not the account.
// This preference only controls whether the Scanner invokes browser printing.
export const labelPrintPreferenceKey = (userId) =>
  userId == null ? null : `easyjet:label-printing:v1:${encodeURIComponent(userId)}`;

export const readAutoPrintPreference = (storage, key) => {
  if (!key) return true;
  try {
    const value = JSON.parse(storage.getItem(key));
    return typeof value?.autoPrint === "boolean" ? value.autoPrint : true;
  } catch {
    return true;
  }
};

export const saveAutoPrintPreference = (storage, key, autoPrint) => {
  if (!key) return false;
  try {
    storage.setItem(key, JSON.stringify({ autoPrint }));
    return true;
  } catch {
    return false;
  }
};
