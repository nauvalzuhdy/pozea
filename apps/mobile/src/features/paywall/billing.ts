// Billing boundary for the paywall. Screens only talk to `billing`; today it is a preview with
// fixed plans and no real purchase. To connect RevenueCat later, write `revenueCatBilling`
// implementing `BillingProvider` and export it as `billing` below:
//   loadPlans  -> Purchases.getOfferings(); map current.monthly / current.annual packages to Plan
//                 (price = product.price, priceString = product.priceString, packageId = package.identifier)
//   purchase   -> Purchases.purchasePackage(pkg); 'purchased' when the "pro" entitlement is active
//   restore    -> Purchases.restorePurchases(); 'restored' when the entitlement is active
// The UI does not need to change.

import { Platform } from 'react-native';

export type PlanId = 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  /** Price in the store currency, used to work out the yearly saving. */
  price: number;
  /** Localised price from the store, shown as-is. */
  priceString: string;
  /** Store package id (RevenueCat package identifier); unused in preview. */
  packageId?: string;
}

export type PurchaseResult = { status: 'purchased' | 'cancelled' | 'preview' } | { status: 'error'; message: string };
export type RestoreResult = { status: 'restored' | 'nothing' } | { status: 'error'; message: string };

export interface BillingProvider {
  /** Name shown in "Cancel anytime on …". */
  storeName: string;
  loadPlans: () => Promise<Plan[]>;
  purchase: (plan: Plan) => Promise<PurchaseResult>;
  restore: () => Promise<RestoreResult>;
}

/** Placeholder prices until the store products exist. */
const PREVIEW_PLANS: Plan[] = [
  { id: 'monthly', price: 49000, priceString: 'Rp49.000' },
  { id: 'yearly', price: 319000, priceString: 'Rp319.000' },
];

const previewBilling: BillingProvider = {
  storeName: Platform.OS === 'ios' ? 'App Store' : 'Google Play',
  loadPlans: async () => PREVIEW_PLANS,
  purchase: async () => ({ status: 'preview' }),
  restore: async () => ({ status: 'nothing' }),
};

export const billing: BillingProvider = previewBilling;

/** Percent saved by paying yearly instead of 12 monthly payments, rounded down. */
export function yearlySavingPercent(plans: readonly Plan[]): number | null {
  const monthly = plans.find((p) => p.id === 'monthly');
  const yearly = plans.find((p) => p.id === 'yearly');
  if (!monthly || !yearly || monthly.price <= 0) return null;
  const percent = Math.floor((1 - yearly.price / (monthly.price * 12)) * 100);
  return percent > 0 ? percent : null;
}
