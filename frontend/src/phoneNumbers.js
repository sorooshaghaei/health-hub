import { parsePhoneNumberFromString } from "libphonenumber-js";

const DECIMAL_DIGIT_SETS = [
  "0123456789",
  "٠١٢٣٤٥٦٧٨٩",
  "۰۱۲۳۴۵۶۷۸۹",
];

export function normalizePhoneDigits(value) {
  return String(value ?? "").normalize("NFKC").replace(/\p{Nd}/gu, (digit) => {
    for (const set of DECIMAL_DIGIT_SETS) {
      const index = set.indexOf(digit);
      if (index >= 0) return String(index);
    }
    return digit;
  });
}

function internationalInput(value) {
  const normalized = normalizePhoneDigits(value).trim();
  return normalized.startsWith("00") ? `+${normalized.slice(2)}` : normalized;
}

export function normalizeInternationalPhone(value) {
  const input = internationalInput(value);
  if (!input.startsWith("+")) {
    throw new Error("Enter the phone number in international format beginning with +.");
  }
  const phone = parsePhoneNumberFromString(input);
  if (!phone?.isValid()) throw new Error("Enter a valid international phone number.");
  return phone.number;
}

export function tryNormalizeInternationalPhone(value) {
  try {
    return normalizeInternationalPhone(value);
  } catch {
    return null;
  }
}

export function normalizeNationalPhone(country, value) {
  if (!country) throw new Error("Choose a valid phone country or region.");
  const input = internationalInput(value);
  const phone = parsePhoneNumberFromString(input, input.startsWith("+") ? undefined : country.region);
  if (!phone?.isValid()) throw new Error("Enter a valid phone number for the selected country or region.");
  if (`+${phone.countryCallingCode}` !== country.code) {
    throw new Error("The phone number country code must match the selected country or region.");
  }
  return {
    country_calling_code: country.code,
    phone_number: phone.nationalNumber,
    phone_e164: phone.number,
  };
}
