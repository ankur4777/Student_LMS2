/**
 * Public, informational fee schedule.
 *
 * Pricing was not supplied for either country. Keep amount=null until a
 * verified fee is provided; never substitute a conversion rate or a guessed
 * value. Canada and Australia have independent price records.
 *
 * This is NOT the authenticated College Admin fee structure, installment or
 * student billing system. Those records remain unchanged.
 */
export type FeeCountry = "CA" | "AU";

export type FeeItem = {
  key: "program" | "registration" | "materials";
  title: string;
  description: string;
  /** Authoritative fee, in this country's currency, or null if unpublished. */
  amount: number | null;
  billingLabel: string;
};

export type CountryFeeSchedule = {
  name: string;
  currency: "CAD" | "AUD";
  locale: "en-CA" | "en-AU";
  heading: string;
  intro: string;
  countryNotice: string;
  items: FeeItem[];
};

export const countryFees: Record<FeeCountry, CountryFeeSchedule> = {
  CA: {
    name: "Canada",
    currency: "CAD",
    locale: "en-CA",
    heading: "Fee structure for Canada",
    intro: "Review the fee categories for Canadian students. Confirmed amounts will appear in Canadian dollars (CAD).",
    countryNotice: "For Canadian enrolments, check with your institution about applicable taxes, payment terms and the final program fee.",
    items: [
      {
        key: "program",
        title: "Program / Course Fee",
        description: "The teaching or learning program selected by your institution.",
        amount: null,
        billingLabel: "As specified for your program",
      },
      {
        key: "registration",
        title: "Registration / Enrollment",
        description: "Any enrollment charge, if applicable to your program.",
        amount: null,
        billingLabel: "If applicable",
      },
      {
        key: "materials",
        title: "Learning Materials",
        description: "Any separately charged learning resources, if applicable.",
        amount: null,
        billingLabel: "If applicable",
      },
    ],
  },
  AU: {
    name: "Australia",
    currency: "AUD",
    locale: "en-AU",
    heading: "Fee structure for Australia",
    intro: "Review the fee categories for Australian students. Confirmed amounts will appear in Australian dollars (AUD).",
    countryNotice: "For Australian enrolments, check with your institution about applicable GST, payment terms and the final program fee.",
    items: [
      {
        key: "program",
        title: "Program / Course Fee",
        description: "The teaching or learning program selected by your institution.",
        amount: null,
        billingLabel: "As specified for your program",
      },
      {
        key: "registration",
        title: "Registration / Enrollment",
        description: "Any enrollment charge, if applicable to your program.",
        amount: null,
        billingLabel: "If applicable",
      },
      {
        key: "materials",
        title: "Learning Materials",
        description: "Any separately charged learning resources, if applicable.",
        amount: null,
        billingLabel: "If applicable",
      },
    ],
  },
};

export function formatFee(
  amount: number | null,
  schedule: CountryFeeSchedule
): string {
  if (amount === null) return "To be confirmed";
  return new Intl.NumberFormat(schedule.locale, {
    style: "currency",
    currency: schedule.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
