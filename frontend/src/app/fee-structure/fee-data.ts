/**
 * Public ONLINE TUTORING rates provided by the product owner (CAD).
 *
 * These rates are distinct from each school's/college's own LMS fee management.
 * Australian prices were NOT supplied.
 * Important source ambiguity: Canadian Grade 7–10 one-to-one is listed
 * as $30 standard but $35 after the first 100 students. Preserve both
 * figures as provided and visibly flag for confirmation, not silently fix.
 */
export type FeeCountry = "CA" | "AU";

export type FeeItem = {
  key: string;
  title: string;
  description: string;
  /** Standard hourly rate; null when not supplied. */
  amount: number | null;
  /** Promotional hourly rate; null when not supplied. */
  discountedAmount: number | null;
  /** Only include first-100 qualification where expressly provided. */
  discountLabel: string | null;
  /** Stated hourly rate after promotion, if specified. */
  afterPromotionAmount: number | null;
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
    heading: "Online tutoring fees — Canada",
    intro: "Hourly prices for one-to-one and group tutoring. Homework help, tuition classes and assignment help follow the same rates for the relevant grade and session format.",
    countryNotice: "All listed amounts are Canadian dollars per hour. The first-100-students offer is described as provided; promotional availability must be confirmed. Grade 7–10 one-to-one shows a stated regular rate of CAD 30 and a later rate of CAD 35 after the promotion — please verify this difference before treating it as final. Tax and other terms were not provided.",
    items: [
      {
        key: "ca-g7-10-individual",
        title: "Grades 7–10 · One-to-one",
        description: "Individual online tutoring sessions for learners in Grades 7 to 10.",
        amount: 30,
        discountedAmount: 28,
        discountLabel: "For the first 100 students only",
        afterPromotionAmount: 35,
        billingLabel: "Hourly rate",
      },
      {
        key: "ca-g7-10-group",
        title: "Grades 7–10 · Group",
        description: "Online group tuition and learning support for Grades 7 to 10.",
        amount: 28,
        discountedAmount: 22,
        discountLabel: "For the first 100 students only",
        afterPromotionAmount: 28,
        billingLabel: "Hourly rate · Confirm whether price is per student",
      },
      {
        key: "ca-g11-12-individual",
        title: "Grades 11–12 · One-to-one",
        description: "Individual online tutoring in Physics, Chemistry, Mathematics and Biology.",
        amount: 45,
        discountedAmount: 35,
        discountLabel: null,
        afterPromotionAmount: null,
        billingLabel: "Hourly rate · Discount eligibility not specified",
      },
      {
        key: "ca-g11-12-group",
        title: "Grades 11–12 · Group",
        description: "Group online tuition and learning support for Grades 11 and 12.",
        amount: 45,
        discountedAmount: 35,
        discountLabel: null,
        afterPromotionAmount: null,
        billingLabel: "Hourly rate · Discount eligibility not specified",
      },
    ],
  },
  AU: {
    name: "Australia",
    currency: "AUD",
    locale: "en-AU",
    heading: "Online tutoring fees — Australia",
    intro: "We also offer online tutoring for Australia. The Australian fee schedule has not yet been supplied and will be published after the rates are confirmed.",
    countryNotice: "Australian tutoring rates, taxes and offer terms have not been provided. No currency conversion or guessed prices are shown.",
    items: [
      {
        key: "au-g7-10-individual",
        title: "Grades 7–10 · One-to-one",
        description: "Individual online classes. Australian rates are pending.",
        amount: null, discountedAmount: null, discountLabel: null,
        afterPromotionAmount: null, billingLabel: "AUD per hour · To be confirmed",
      },
      {
        key: "au-g7-10-group",
        title: "Grades 7–10 · Group",
        description: "Group online classes. Australian rates are pending.",
        amount: null, discountedAmount: null, discountLabel: null,
        afterPromotionAmount: null, billingLabel: "AUD per hour · To be confirmed",
      },
      {
        key: "au-g11-12-individual",
        title: "Grades 11–12 · One-to-one",
        description: "Individual online classes. Australian rates are pending.",
        amount: null, discountedAmount: null, discountLabel: null,
        afterPromotionAmount: null, billingLabel: "AUD per hour · To be confirmed",
      },
      {
        key: "au-g11-12-group",
        title: "Grades 11–12 · Group",
        description: "Group online classes. Australian rates are pending.",
        amount: null, discountedAmount: null, discountLabel: null,
        afterPromotionAmount: null, billingLabel: "AUD per hour · To be confirmed",
      },
    ],
  },
};

export function formatFee(amount: number | null, schedule: CountryFeeSchedule): string {
  if (amount === null) return "To be confirmed";
  return new Intl.NumberFormat(schedule.locale, {
    style: "currency",
    currency: schedule.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
