import { WalletAPI } from "./api";
import { setBalance } from "@/redux/features/balanceSlice";

export const extractBalanceValue = (response) => {
  const candidate = response?.data?.balance ?? response?.balance;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
};

export const refreshWalletBalance = async (dispatch) => {
  try {
    const resp = await WalletAPI.getBalance();
    const balance = extractBalanceValue(resp);
    if (balance !== null) {
      dispatch(setBalance(balance));
    }
  } catch {
    // Balance fetch failure should not block UI flows
  }
};
