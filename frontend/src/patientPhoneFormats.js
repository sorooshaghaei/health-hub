export const COUNTRY_CODES = [
  { flag: "🇮🇷", country: "Iran", code: "+98", placeholder: "000 000 00 00" },
  { flag: "🇫🇷", country: "France", code: "+33", placeholder: "0 00 00 00 00" },
  { flag: "🇺🇸🇨🇦", country: "United States / Canada", code: "+1", placeholder: "000 000 0000" },
  { flag: "🇬🇧", country: "United Kingdom", code: "+44", placeholder: "0000 000 000" },
  { flag: "🇩🇪", country: "Germany", code: "+49", placeholder: "000 00000000" },
  { flag: "🇹🇷", country: "Turkey", code: "+90", placeholder: "000 000 00 00" },
  { flag: "🇦🇪", country: "United Arab Emirates", code: "+971", placeholder: "00 000 0000" },
  { flag: "🇸🇦", country: "Saudi Arabia", code: "+966", placeholder: "00 000 0000" },
  { flag: "🇶🇦", country: "Qatar", code: "+974", placeholder: "0000 0000" },
  { flag: "🇰🇼", country: "Kuwait", code: "+965", placeholder: "0000 0000" },
  { flag: "🇮🇶", country: "Iraq", code: "+964", placeholder: "000 000 0000" },
  { flag: "🇦🇫", country: "Afghanistan", code: "+93", placeholder: "00 000 0000" },
  { flag: "🇵🇰", country: "Pakistan", code: "+92", placeholder: "000 0000000" },
  { flag: "🇮🇳", country: "India", code: "+91", placeholder: "00000 00000" },
  { flag: "🇦🇲", country: "Armenia", code: "+374", placeholder: "00 000000" },
  { flag: "🇦🇿", country: "Azerbaijan", code: "+994", placeholder: "00 000 00 00" },
  { flag: "🇬🇪", country: "Georgia", code: "+995", placeholder: "000 00 00 00" },
];

export function countryForCallingCode(code) {
  return COUNTRY_CODES.find((item) => item.code === code) ?? null;
}

export function patientPhoneParts(patient) {
  const e164 = String(patient?.phone_e164 ?? "")
    .trim()
    .replace(/[\s().-]+/g, "")
    .replace(/^00/, "+");
  const suppliedCode = String(patient?.country_calling_code ?? "").trim();
  const inferredCode = [...COUNTRY_CODES]
    .sort((first, second) => second.code.length - first.code.length)
    .find(({ code }) => e164.startsWith(code))?.code;
  const countryCallingCode = suppliedCode || inferredCode || "+98";
  const suppliedNumber = String(patient?.phone_number ?? "").trim();
  const phoneNumber = suppliedNumber
    || (e164.startsWith(countryCallingCode) ? e164.slice(countryCallingCode.length) : "");
  return {
    country_calling_code: countryCallingCode,
    phone_number: phoneNumber,
  };
}

export function phonePlaceholderForCallingCode(code) {
  return countryForCallingCode(code)?.placeholder ?? "000 000 0000";
}
