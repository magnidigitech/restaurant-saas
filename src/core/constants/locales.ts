export interface TimezoneOption {
  value: string;
  label: string;
  region: string;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  label: string;
}

export const WORLDWIDE_TIMEZONES: TimezoneOption[] = [
  // UTC / Universal
  { value: "UTC", label: "UTC (Universal Coordinated Time)", region: "Universal" },

  // North America & Caribbean
  { value: "America/New_York", label: "America/New_York (EST/EDT - Eastern Time)", region: "North America" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT - Central Time)", region: "North America" },
  { value: "America/Denver", label: "America/Denver (MST/MDT - Mountain Time)", region: "North America" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT - Pacific Time)", region: "North America" },
  { value: "America/Edmonton", label: "America/Edmonton (MST/MDT - Calgary / Alberta)", region: "North America" },
  { value: "America/Toronto", label: "America/Toronto (EST/EDT - Toronto / Ontario)", region: "North America" },
  { value: "America/Vancouver", label: "America/Vancouver (PST/PDT - Vancouver / BC)", region: "North America" },
  { value: "America/Anchorage", label: "America/Anchorage (AKST/AKDT - Alaska)", region: "North America" },
  { value: "Pacific/Honolulu", label: "Pacific/Honolulu (HST - Hawaii)", region: "North America" },
  { value: "America/Halifax", label: "America/Halifax (AST/ADT - Atlantic Time)", region: "North America" },
  { value: "America/Mexico_City", label: "America/Mexico_City (CST - Mexico City)", region: "North America" },

  // South & Central America
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT - São Paulo / Brazil)", region: "South America" },
  { value: "America/Buenos_Aires", label: "America/Buenos_Aires (ART - Buenos Aires)", region: "South America" },
  { value: "America/Bogota", label: "America/Bogota (COT - Bogota / Colombia)", region: "South America" },
  { value: "America/Santiago", label: "America/Santiago (CLT - Santiago / Chile)", region: "South America" },
  { value: "America/Lima", label: "America/Lima (PET - Lima / Peru)", region: "South America" },

  // Europe
  { value: "Europe/London", label: "Europe/London (GMT/BST - London / UK)", region: "Europe" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST - Paris / France)", region: "Europe" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST - Berlin / Germany)", region: "Europe" },
  { value: "Europe/Rome", label: "Europe/Rome (CET/CEST - Rome / Italy)", region: "Europe" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST - Madrid / Spain)", region: "Europe" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET/CEST - Amsterdam)", region: "Europe" },
  { value: "Europe/Zurich", label: "Europe/Zurich (CET/CEST - Zurich / Swiss)", region: "Europe" },
  { value: "Europe/Dublin", label: "Europe/Dublin (IST/GMT - Dublin / Ireland)", region: "Europe" },
  { value: "Europe/Stockholm", label: "Europe/Stockholm (CET/CEST - Sweden)", region: "Europe" },
  { value: "Europe/Athens", label: "Europe/Athens (EET/EEST - Athens / Greece)", region: "Europe" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul (TRT - Istanbul / Turkey)", region: "Europe" },
  { value: "Europe/Moscow", label: "Europe/Moscow (MSK - Moscow / Russia)", region: "Europe" },

  // Asia & Middle East
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST - India / Mumbai / Delhi)", region: "Asia & Middle East" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST - Dubai / UAE)", region: "Asia & Middle East" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh (AST - Riyadh / Saudi Arabia)", region: "Asia & Middle East" },
  { value: "Asia/Qatar", label: "Asia/Qatar (AST - Doha / Qatar)", region: "Asia & Middle East" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT - Singapore)", region: "Asia & Middle East" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong (HKT - Hong Kong)", region: "Asia & Middle East" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST - Tokyo / Japan)", region: "Asia & Middle East" },
  { value: "Asia/Seoul", label: "Asia/Seoul (KST - Seoul / South Korea)", region: "Asia & Middle East" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST - Shanghai / China)", region: "Asia & Middle East" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (ICT - Bangkok / Thailand)", region: "Asia & Middle East" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB - Jakarta / Indonesia)", region: "Asia & Middle East" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (MYT - Kuala Lumpur)", region: "Asia & Middle East" },
  { value: "Asia/Manila", label: "Asia/Manila (PHT - Manila / Philippines)", region: "Asia & Middle East" },
  { value: "Asia/Bahrain", label: "Asia/Bahrain (AST - Manama / Bahrain)", region: "Asia & Middle East" },
  { value: "Asia/Kuwait", label: "Asia/Kuwait (AST - Kuwait City)", region: "Asia & Middle East" },
  { value: "Asia/Muscat", label: "Asia/Muscat (GST - Muscat / Oman)", region: "Asia & Middle East" },
  { value: "Asia/Amman", label: "Asia/Amman (EEST - Amman / Jordan)", region: "Asia & Middle East" },
  { value: "Asia/Beirut", label: "Asia/Beirut (EEST - Beirut / Lebanon)", region: "Asia & Middle East" },
  { value: "Asia/Karachi", label: "Asia/Karachi (PKT - Karachi / Pakistan)", region: "Asia & Middle East" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (BST - Dhaka / Bangladesh)", region: "Asia & Middle East" },
  { value: "Asia/Colombo", label: "Asia/Colombo (IST - Colombo / Sri Lanka)", region: "Asia & Middle East" },
  { value: "Asia/Kathmandu", label: "Asia/Kathmandu (NPT - Kathmandu / Nepal)", region: "Asia & Middle East" },

  // Africa
  { value: "Africa/Cairo", label: "Africa/Cairo (EEST - Cairo / Egypt)", region: "Africa" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST - South Africa)", region: "Africa" },
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT - Lagos / Nigeria)", region: "Africa" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi (EAT - Nairobi / Kenya)", region: "Africa" },
  { value: "Africa/Casablanca", label: "Africa/Casablanca (WET - Morocco)", region: "Africa" },

  // Australia & Oceania
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT - Sydney)", region: "Australia & Oceania" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEST/AEDT - Melbourne)", region: "Australia & Oceania" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane (AEST - Brisbane)", region: "Australia & Oceania" },
  { value: "Australia/Perth", label: "Australia/Perth (AWST - Perth)", region: "Australia & Oceania" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST/NZDT - Auckland)", region: "Australia & Oceania" },
  { value: "Pacific/Fiji", label: "Pacific/Fiji (FJT - Fiji)", region: "Australia & Oceania" },
];

export const WORLDWIDE_CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$", name: "United States Dollar", label: "USD ($ - United States Dollar)" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", label: "CAD (CA$ - Canadian Dollar)" },
  { code: "EUR", symbol: "€", name: "Euro", label: "EUR (€ - Euro Union)" },
  { code: "GBP", symbol: "£", name: "British Pound", label: "GBP (£ - British Pound)" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", label: "INR (₹ - Indian Rupee)" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", label: "AUD (A$ - Australian Dollar)" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", label: "AED (د.إ - UAE Dirham)" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", label: "SAR (﷼ - Saudi Riyal)" },
  { code: "QAR", symbol: "﷼", name: "Qatari Riyal", label: "QAR (﷼ - Qatari Riyal)" },
  { code: "KWD", symbol: "د.ك", name: "Kuwaiti Dinar", label: "KWD (د.ك - Kuwaiti Dinar)" },
  { code: "BHD", symbol: "ب.د", name: "Bahraini Dinar", label: "BHD (ب.د - Bahraini Dinar)" },
  { code: "OMR", symbol: "﷼", name: "Omani Rial", label: "OMR (﷼ - Omani Rial)" },
  { code: "JOD", symbol: "د.ا", name: "Jordanian Dinar", label: "JOD (د.ا - Jordanian Dinar)" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", label: "SGD (S$ - Singapore Dollar)" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", label: "MYR (RM - Malaysian Ringgit)" },
  { code: "THB", symbol: "฿", name: "Thai Baht", label: "THB (฿ - Thai Baht)" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", label: "IDR (Rp - Indonesian Rupiah)" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", label: "PHP (₱ - Philippine Peso)" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong", label: "VND (₫ - Vietnamese Dong)" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", label: "JPY (¥ - Japanese Yen)" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", label: "CNY (¥ - Chinese Yuan)" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", label: "KRW (₩ - South Korean Won)" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", label: "HKD (HK$ - Hong Kong Dollar)" },
  { code: "TWD", symbol: "NT$", name: "New Taiwan Dollar", label: "TWD (NT$ - New Taiwan Dollar)" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", label: "NZD (NZ$ - New Zealand Dollar)" },
  { code: "ZAR", symbol: "R", name: "South African Rand", label: "ZAR (R - South African Rand)" },
  { code: "EGP", symbol: "E£", name: "Egyptian Pound", label: "EGP (E£ - Egyptian Pound)" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", label: "NGN (₦ - Nigerian Naira)" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", label: "KES (KSh - Kenyan Shilling)" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", label: "BRL (R$ - Brazilian Real)" },
  { code: "MXN", symbol: "MEX$", name: "Mexican Peso", label: "MXN (MEX$ - Mexican Peso)" },
  { code: "CLP", symbol: "CLP$", name: "Chilean Peso", label: "CLP (CLP$ - Chilean Peso)" },
  { code: "COP", symbol: "COP$", name: "Colombian Peso", label: "COP (COP$ - Colombian Peso)" },
  { code: "PEN", symbol: "S/", name: "Peruvian Sol", label: "PEN (S/ - Peruvian Sol)" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", label: "CHF (Swiss Franc)" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", label: "SEK (kr - Swedish Krona)" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", label: "NOK (kr - Norwegian Krone)" },
  { code: "DKK", symbol: "kr", name: "Danish Krone", label: "DKK (kr - Danish Krone)" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", label: "PLN (zł - Polish Zloty)" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna", label: "CZK (Kč - Czech Koruna)" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint", label: "HUF (Ft - Hungarian Forint)" },
  { code: "RON", symbol: "lei", name: "Romanian Leu", label: "RON (lei - Romanian Leu)" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", label: "TRY (₺ - Turkish Lira)" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", label: "RUB (₽ - Russian Ruble)" },
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", label: "PKR (Rs - Pakistani Rupee)" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", label: "BDT (৳ - Bangladeshi Taka)" },
  { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", label: "LKR (Rs - Sri Lankan Rupee)" },
  { code: "NPR", symbol: "Rs", name: "Nepalese Rupee", label: "NPR (Rs - Nepalese Rupee)" },
];
