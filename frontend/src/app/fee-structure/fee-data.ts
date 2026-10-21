/**
 * Public hourly tutoring rates. This price list is separate from a school's
 * own fee-management records. Canadian prices preserve the published regular,
 * introductory and post-offer amounts; Australian prices require an enquiry.
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
    intro: "Compare hourly rates for one-to-one tutoring and online group classes in Canada. The same grade and class-format rates apply to tuition, homework guidance and assignment support.",
    countryNotice: "All rates are in Canadian dollars per hour. Discounted prices and any separately listed post-offer rates are shown for reference. Please contact our team to confirm current eligibility, final pricing, group tuition terms and any applicable taxes before booking.",
    items: [
      {
        key: "ca-g7-10-individual",
        title: "Grades 7–10 · One-to-one",
        description: "Personalized online tuition, homework guidance and assignment support for students in Grades 7–10.",
        amount: 30,
        discountedAmount: 28,
        discountLabel: null,
        afterPromotionAmount: 35,
        billingLabel: "Hourly rate",
      },
      {
        key: "ca-g7-10-group",
        title: "Grades 7–10 · Group",
        description: "Interactive group online tuition and study support for learners in Grades 7–10.",
        amount: 28,
        discountedAmount: 22,
        discountLabel: null,
        afterPromotionAmount: 28,
        billingLabel: "Hourly group classes · Ask about per-student terms",
      },
      {
        key: "ca-g11-12-individual",
        title: "Grades 11–12 · One-to-one",
        description: "Individual online tutoring in Physics, Chemistry, Mathematics and Biology.",
        amount: 45,
        discountedAmount: 35,
        discountLabel: null,
        afterPromotionAmount: null,
        billingLabel: "Hourly tuition · Ask about current offer terms",
      },
      {
        key: "ca-g11-12-group",
        title: "Grades 11–12 · Group",
        description: "Group online tuition and learning support for Grades 11 and 12.",
        amount: 45,
        discountedAmount: 35,
        discountLabel: null,
        afterPromotionAmount: null,
        billingLabel: "Hourly tuition · Ask about current offer terms",
      },
    ],
  },
  AU: {
    name: "Australia",
    currency: "AUD",
    locale: "en-AU",
    heading: "Online tutoring fees — Australia",
    intro: "Looking for one-to-one tutoring or group online classes in Australia? Ask our team about hourly rates, subjects and session availability for your grade.",
    countryNotice: "Australian prices vary by programme and class format. Contact ShabddLearningSolution (MySLS) for an individual quote and to confirm session availability before enrolling.",
    items: [
      {
        key: "au-g7-10-individual",
        title: "Grades 7–10 · One-to-one",
        description: "One-to-one tuition for Grades 7–10. Contact us for Australian hourly rates.",
        amount: null, discountedAmount: null, discountLabel: null,
        afterPromotionAmount: null, billingLabel: "Australian pricing on enquiry",
      },
      {
        key: "au-g7-10-group",
        title: "Grades 7–10 · Group",
        description: "Group tuition for Grades 7–10. Ask us about class availability and hourly rates.",
        amount: null, discountedAmount: null, discountLabel: null,
        afterPromotionAmount: null, billingLabel: "Australian pricing on enquiry",
      },
      {
        key: "au-g11-12-individual",
        title: "Grades 11–12 · One-to-one",
        description: "One-to-one tutoring for Grades 11–12. Request subject and pricing details.",
        amount: null, discountedAmount: null, discountLabel: null,
        afterPromotionAmount: null, billingLabel: "Australian pricing on enquiry",
      },
      {
        key: "au-g11-12-group",
        title: "Grades 11–12 · Group",
        description: "Group tuition for Grades 11–12. Contact us for availability and rates.",
        amount: null, discountedAmount: null, discountLabel: null,
        afterPromotionAmount: null, billingLabel: "Australian pricing on enquiry",
      },
    ],
  },
};

export function formatFee(amount: number | null, schedule: CountryFeeSchedule): string {
  if (amount === null) return "Request a quote";
  return new Intl.NumberFormat(schedule.locale, {
    style: "currency",
    currency: schedule.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
