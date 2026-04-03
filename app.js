const TROY_OUNCE_TO_GRAMS = 31.1034768;
const GOLD_NISAB_GRAMS = 87.48;
const SILVER_NISAB_GRAMS = 612.36;
const AGRICULTURE_NISAB_KG = 653;
const STORAGE_KEY = "zakat-calculator-global-v3";

const FIELD_IDS = [
  "cashAndBank",
  "walletBalances",
  "receivables",
  "goldSavingsGrams",
  "goldJewelryGrams",
  "silverSavingsGrams",
  "silverJewelryGrams",
  "investmentValue",
  "businessCash",
  "tradeInventory",
  "otherAssets",
  "debtsDueNow",
  "billsDueNow",
  "longTermInstallments",
  "advanceZakatPaid",
  "agricultureWeightKg",
  "agricultureAssessableValue",
  "camelsCount",
  "cattleCount",
  "sheepCount",
  "rikazValue",
  "manualGoldPerGram",
  "manualSilverPerGram",
];

const FALLBACK_CURRENCIES = [
  ["AED", "UAE Dirham"],
  ["AUD", "Australian Dollar"],
  ["BDT", "Bangladeshi Taka"],
  ["BHD", "Bahraini Dinar"],
  ["CAD", "Canadian Dollar"],
  ["CHF", "Swiss Franc"],
  ["CNY", "Chinese Yuan"],
  ["DKK", "Danish Krone"],
  ["EGP", "Egyptian Pound"],
  ["EUR", "Euro"],
  ["GBP", "British Pound"],
  ["HKD", "Hong Kong Dollar"],
  ["IDR", "Indonesian Rupiah"],
  ["INR", "Indian Rupee"],
  ["JPY", "Japanese Yen"],
  ["KES", "Kenyan Shilling"],
  ["KWD", "Kuwaiti Dinar"],
  ["LKR", "Sri Lankan Rupee"],
  ["MAD", "Moroccan Dirham"],
  ["MYR", "Malaysian Ringgit"],
  ["NGN", "Nigerian Naira"],
  ["NOK", "Norwegian Krone"],
  ["NZD", "New Zealand Dollar"],
  ["OMR", "Omani Rial"],
  ["PKR", "Pakistani Rupee"],
  ["QAR", "Qatari Riyal"],
  ["SAR", "Saudi Riyal"],
  ["SEK", "Swedish Krona"],
  ["SGD", "Singapore Dollar"],
  ["THB", "Thai Baht"],
  ["TRY", "Turkish Lira"],
  ["USD", "US Dollar"],
  ["ZAR", "South African Rand"],
];

const LOCALE_CURRENCY_MAP = {
  AE: "AED",
  AU: "AUD",
  BD: "BDT",
  BH: "BHD",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  DE: "EUR",
  DK: "DKK",
  EG: "EGP",
  ES: "EUR",
  FR: "EUR",
  GB: "GBP",
  HK: "HKD",
  ID: "IDR",
  IE: "EUR",
  IN: "INR",
  IT: "EUR",
  JP: "JPY",
  KE: "KES",
  KW: "KWD",
  LK: "LKR",
  MA: "MAD",
  MY: "MYR",
  NG: "NGN",
  NO: "NOK",
  NZ: "NZD",
  OM: "OMR",
  PK: "PKR",
  QA: "QAR",
  SA: "SAR",
  SE: "SEK",
  SG: "SGD",
  TH: "THB",
  TR: "TRY",
  US: "USD",
  ZA: "ZAR",
};

const formatterCache = new Map();
const compactFormatterCache = new Map();
const locale = navigator.languages?.[0] || navigator.language || "en-US";

const elements = {
  locationLabel: document.getElementById("locationLabel"),
  currencyLabel: document.getElementById("currencyLabel"),
  locationHint: document.getElementById("locationHint"),
  currencySelect: document.getElementById("currencySelect"),
  useAutoLocationButton: document.getElementById("useAutoLocationButton"),
  nisabBasisRadios: Array.from(document.querySelectorAll('input[name="nisabBasis"]')),
  jewelryPolicy: document.getElementById("jewelryPolicy"),
  debtMethod: document.getElementById("debtMethod"),
  hawlCompleted: document.getElementById("hawlCompleted"),
  agricultureIrrigation: document.getElementById("agricultureIrrigation"),
  refreshPricesButton: document.getElementById("refreshPricesButton"),
  goldRatePrimary: document.getElementById("goldRatePrimary"),
  goldRateSecondary: document.getElementById("goldRateSecondary"),
  silverRatePrimary: document.getElementById("silverRatePrimary"),
  silverRateSecondary: document.getElementById("silverRateSecondary"),
  marketStatusLabel: document.getElementById("marketStatusLabel"),
  marketTimestamp: document.getElementById("marketTimestamp"),
  nisabSnapshot: document.getElementById("nisabSnapshot"),
  nisabSnapshotNote: document.getElementById("nisabSnapshotNote"),
  payableNowCompact: document.getElementById("payableNowCompact"),
  payableNowExact: document.getElementById("payableNowExact"),
  netAssetsValue: document.getElementById("netAssetsValue"),
  nisabValue: document.getElementById("nisabValue"),
  wealthDueValue: document.getElementById("wealthDueValue"),
  specialDueValue: document.getElementById("specialDueValue"),
  wealthStatusPill: document.getElementById("wealthStatusPill"),
  wealthReasonText: document.getElementById("wealthReasonText"),
  methodSummary: document.getElementById("methodSummary"),
  breakdownRows: document.getElementById("breakdownRows"),
  specialRows: document.getElementById("specialRows"),
  specialCategoriesHint: document.getElementById("specialCategoriesHint"),
};

const state = {
  currencies: [],
  settings: {
    currency: "USD",
    autoCurrency: true,
    nisabBasis: "silver",
    jewelryPolicy: "exclude-personal",
    debtMethod: "due-now",
    hawlCompleted: true,
    agricultureIrrigation: "rain",
  },
  inputs: Object.fromEntries(FIELD_IDS.map((field) => [field, 0])),
  userContext: {
    countryCode: "",
    currency: "USD",
    locationLabel: "Detecting...",
    hint: "Using your browser locale first, then a more precise lookup when available.",
  },
  market: {
    loading: false,
    error: "",
    goldPerOunce: null,
    silverPerOunce: null,
    fetchedAt: "",
    sourceLabel: "Loading live rates",
  },
};

window.addEventListener("DOMContentLoaded", init);

async function init() {
  hydrateRevealObserver();
  state.currencies = await loadCurrencyOptions();
  restoreState();
  populateCurrencySelect();
  syncControlsFromState();
  bindEvents();
  render();
  await detectUserContext();
  await refreshMarketData();
}

function bindEvents() {
  FIELD_IDS.forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.addEventListener("input", () => {
      state.inputs[fieldId] = parsePositiveNumber(input.value);
      saveState();
      render();
    });
  });

  elements.currencySelect.addEventListener("change", async () => {
    state.settings.currency = elements.currencySelect.value;
    state.settings.autoCurrency = state.settings.currency === state.userContext.currency;
    saveState();
    render();
    await refreshMarketData(true);
  });

  elements.useAutoLocationButton.addEventListener("click", async () => {
    state.settings.autoCurrency = true;
    state.settings.currency = state.userContext.currency;
    syncControlsFromState();
    saveState();
    render();
    await refreshMarketData(true);
  });

  elements.nisabBasisRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.settings.nisabBasis = radio.value;
      saveState();
      render();
    });
  });

  elements.jewelryPolicy.addEventListener("change", () => {
    state.settings.jewelryPolicy = elements.jewelryPolicy.value;
    saveState();
    render();
  });

  elements.debtMethod.addEventListener("change", () => {
    state.settings.debtMethod = elements.debtMethod.value;
    saveState();
    render();
  });

  elements.hawlCompleted.addEventListener("change", () => {
    state.settings.hawlCompleted = elements.hawlCompleted.checked;
    saveState();
    render();
  });

  elements.agricultureIrrigation.addEventListener("change", () => {
    state.settings.agricultureIrrigation = elements.agricultureIrrigation.value;
    saveState();
    render();
  });

  elements.refreshPricesButton.addEventListener("click", async () => {
    await refreshMarketData(true);
  });
}

function syncControlsFromState() {
  elements.currencySelect.value = state.settings.currency;
  elements.jewelryPolicy.value = state.settings.jewelryPolicy;
  elements.debtMethod.value = state.settings.debtMethod;
  elements.hawlCompleted.checked = state.settings.hawlCompleted;
  elements.agricultureIrrigation.value = state.settings.agricultureIrrigation;

  elements.nisabBasisRadios.forEach((radio) => {
    radio.checked = radio.value === state.settings.nisabBasis;
  });

  FIELD_IDS.forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.value = state.inputs[fieldId] > 0 ? String(state.inputs[fieldId]) : "";
  });
}

async function loadCurrencyOptions() {
  try {
    const data = await fetchJson("https://api.frankfurter.dev/v2/currencies");
    const parsed = parseCurrencyOptions(data);
    if (parsed.length) return parsed;
  } catch (_error) {
    // Fall back below.
  }

  return FALLBACK_CURRENCIES.map(([code, label]) => ({ code, label }));
}

function parseCurrencyOptions(data) {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data)
    .map(([code, value]) => ({
      code,
      label: typeof value === "string" ? value : value?.name || code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function populateCurrencySelect() {
  elements.currencySelect.innerHTML = "";
  state.currencies.forEach(({ code, label }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} - ${label}`;
    elements.currencySelect.appendChild(option);
  });

  const availableCodes = new Set(state.currencies.map((item) => item.code));
  if (!availableCodes.has(state.settings.currency)) {
    state.settings.currency = guessCurrencyByLocale();
  }
}

async function detectUserContext() {
  const localeGuess = await getLocaleContext();
  applyDetectedContext(localeGuess);
  render();

  try {
    const precise = await getPreciseOrIpContext();
    applyDetectedContext(precise);
  } catch (_error) {
    // Keep locale guess.
  }

  if (state.settings.autoCurrency) {
    state.settings.currency = state.userContext.currency;
    syncControlsFromState();
  }

  saveState();
  render();
}

async function getLocaleContext() {
  const region = getLocaleRegion();
  const currency = LOCALE_CURRENCY_MAP[region] || "USD";
  const countryLabel = region ? getRegionDisplayName(region) : "your area";
  return {
    countryCode: region,
    currency,
    locationLabel: countryLabel,
    hint: "Approximate local context from your browser locale.",
  };
}

async function getPreciseOrIpContext() {
  const coords = await getPermittedCoordinates();
  const baseUrl = "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en";
  const url = coords
    ? `${baseUrl}&latitude=${coords.latitude}&longitude=${coords.longitude}`
    : baseUrl;
  const place = await fetchJson(url);

  const countryCode = place.countryCode || getLocaleRegion();
  const currency = await lookupCurrencyForCountry(countryCode);
  const labelParts = [place.city || place.locality, place.countryName].filter(Boolean);

  return {
    countryCode,
    currency,
    locationLabel: labelParts.length ? labelParts.join(", ") : getRegionDisplayName(countryCode),
    hint: coords
      ? "Using device location for local currency context."
      : "Using approximate network location for local currency context.",
  };
}

async function getPermittedCoordinates() {
  if (!("permissions" in navigator) || !("geolocation" in navigator)) {
    return null;
  }

  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    if (permission.state !== "granted") return null;
    return await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        reject,
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 900000 }
      );
    });
  } catch (_error) {
    return null;
  }
}

async function lookupCurrencyForCountry(countryCode) {
  if (!countryCode) return guessCurrencyByLocale();

  try {
    const data = await fetchJson(
      `https://restcountries.com/v3.1/alpha/${encodeURIComponent(countryCode)}?fields=currencies`
    );
    const payload = Array.isArray(data) ? data[0] : data;
    const codes = Object.keys(payload?.currencies || {});
    if (codes.length) return codes[0];
  } catch (_error) {
    // Fall back below.
  }

  return LOCALE_CURRENCY_MAP[countryCode] || guessCurrencyByLocale();
}

function applyDetectedContext(context) {
  const availableCurrencies = new Set(state.currencies.map((item) => item.code));
  const safeCurrency = availableCurrencies.has(context.currency) ? context.currency : guessCurrencyByLocale();
  state.userContext = {
    countryCode: context.countryCode || state.userContext.countryCode,
    currency: safeCurrency || state.userContext.currency,
    locationLabel: context.locationLabel || state.userContext.locationLabel,
    hint: context.hint || state.userContext.hint,
  };

  if (state.settings.autoCurrency) {
    state.settings.currency = state.userContext.currency;
    syncControlsFromState();
  }
}

async function refreshMarketData(force = false) {
  if (state.market.loading && !force) return;

  state.market.loading = true;
  state.market.error = "";
  elements.refreshPricesButton.disabled = true;
  renderRates();

  const targetCurrency = state.settings.currency;

  try {
    const [gold, silver] = await Promise.all([
      fetchMetalInCurrency("XAU", targetCurrency),
      fetchMetalInCurrency("XAG", targetCurrency),
    ]);

    state.market.goldPerOunce = gold.price;
    state.market.silverPerOunce = silver.price;
    state.market.fetchedAt = gold.updatedAt || silver.updatedAt || new Date().toISOString();
    state.market.sourceLabel = `Live spot metal pricing in ${targetCurrency}`;
  } catch (error) {
    state.market.error =
      "Live metal prices are temporarily unavailable. You can still use manual metal rates below.";
    state.market.sourceLabel = "Manual metal override ready";
    console.error(error);
  } finally {
    state.market.loading = false;
    elements.refreshPricesButton.disabled = false;
    render();
  }
}

async function fetchMetalInCurrency(symbol, currency) {
  try {
    return await fetchJson(`https://api.gold-api.com/price/${symbol}/${currency}`);
  } catch (_error) {
    if (currency === "USD") throw _error;

    const [usdMetal, fx] = await Promise.all([
      fetchJson(`https://api.gold-api.com/price/${symbol}/USD`),
      fetchJson(`https://api.frankfurter.dev/v2/rates?base=USD&symbols=${encodeURIComponent(currency)}`),
    ]);

    const rate =
      Number(fx?.rates?.[currency]) ||
      Number(fx?.rates?.[currency?.toUpperCase?.()]) ||
      Number(fx?.rates?.[0]?.rate);

    if (!Number.isFinite(rate) || rate <= 0) throw _error;

    return {
      ...usdMetal,
      price: Number(usdMetal.price) * rate,
      currency,
    };
  }
}

function getEffectivePrices() {
  const liveGoldPerGram = Number.isFinite(Number(state.market.goldPerOunce))
    ? Number(state.market.goldPerOunce) / TROY_OUNCE_TO_GRAMS
    : null;
  const liveSilverPerGram = Number.isFinite(Number(state.market.silverPerOunce))
    ? Number(state.market.silverPerOunce) / TROY_OUNCE_TO_GRAMS
    : null;

  const manualGold = state.inputs.manualGoldPerGram > 0 ? state.inputs.manualGoldPerGram : null;
  const manualSilver = state.inputs.manualSilverPerGram > 0 ? state.inputs.manualSilverPerGram : null;

  return {
    goldPerGram: manualGold ?? liveGoldPerGram,
    silverPerGram: manualSilver ?? liveSilverPerGram,
    usingManualGold: Boolean(manualGold),
    usingManualSilver: Boolean(manualSilver),
  };
}

function render() {
  const prices = getEffectivePrices();
  const wealth = calculateWealth(prices);
  const agriculture = calculateAgriculture();
  const rikaz = calculateRikaz();
  const livestock = calculateLivestock();
  const specialDue = agriculture.payableNow + rikaz.payableNow;
  const totalDue = wealth.payableNow + specialDue;

  renderContext();
  renderRates(prices, wealth.selectedNisab);
  renderSummary(wealth, agriculture, rikaz, livestock, specialDue, totalDue);
}

function calculateWealth(prices) {
  const moneyTotal = state.inputs.cashAndBank + state.inputs.walletBalances + state.inputs.receivables;
  const jewelryIncluded = state.settings.jewelryPolicy === "include-all";

  const goldValue =
    (state.inputs.goldSavingsGrams + (jewelryIncluded ? state.inputs.goldJewelryGrams : 0)) *
    (prices.goldPerGram || 0);
  const silverValue =
    (state.inputs.silverSavingsGrams + (jewelryIncluded ? state.inputs.silverJewelryGrams : 0)) *
    (prices.silverPerGram || 0);
  const metalsTotal = goldValue + silverValue;

  const investmentsTotal = state.inputs.investmentValue;
  const businessTotal = state.inputs.businessCash + state.inputs.tradeInventory + state.inputs.otherAssets;
  const totalAssets = moneyTotal + metalsTotal + investmentsTotal + businessTotal;

  const liabilitiesDueNow = state.inputs.debtsDueNow + state.inputs.billsDueNow;
  const liabilitiesScheduled =
    state.settings.debtMethod === "next-12-months" ? state.inputs.longTermInstallments : 0;
  const totalLiabilities = liabilitiesDueNow + liabilitiesScheduled;

  const netAssets = totalAssets - totalLiabilities;
  const goldNisab = prices.goldPerGram ? prices.goldPerGram * GOLD_NISAB_GRAMS : null;
  const silverNisab = prices.silverPerGram ? prices.silverPerGram * SILVER_NISAB_GRAMS : null;
  const selectedNisab = state.settings.nisabBasis === "gold" ? goldNisab : silverNisab;
  const aboveNisab = Number.isFinite(selectedNisab) ? netAssets >= selectedNisab : false;

  const baseZakat = netAssets > 0 ? netAssets * 0.025 : 0;
  const wealthPayableNow =
    state.settings.hawlCompleted && aboveNisab
      ? Math.max(baseZakat - state.inputs.advanceZakatPaid, 0)
      : 0;
  const estimateIfDueToday = Math.max(baseZakat - state.inputs.advanceZakatPaid, 0);

  const breakdown = [
    {
      label: "Cash and receivables",
      value: moneyTotal,
      reason: "Cash, bank balances, wallet balances, and money you realistically expect back.",
    },
    {
      label: "Gold and silver",
      value: metalsTotal,
      reason: jewelryIncluded
        ? "Savings metals plus jewelry under your current jewelry method."
        : "Savings metals only. Personal jewelry is excluded under your current method.",
    },
    {
      label: "Investments",
      value: investmentsTotal,
      reason: "Trade shares, liquid investments, and other zakatable investment value.",
    },
    {
      label: "Business and trade assets",
      value: businessTotal,
      reason: "Business cash, trade inventory, and other saleable zakatable assets.",
    },
    {
      label: "Liabilities deducted",
      value: totalLiabilities,
      negative: true,
      reason:
        state.settings.debtMethod === "next-12-months"
          ? "Immediate liabilities plus scheduled payments due within the next 12 months."
          : "Only liabilities already due now are deducted.",
    },
  ].filter((row) => Math.abs(row.value) > 0);

  const notes = [];
  if (!Number.isFinite(selectedNisab)) {
    notes.push("Need live or manual metal pricing to determine the nisab threshold.");
  } else if (netAssets <= 0) {
    notes.push("Your liabilities are equal to or greater than your zakatable wealth.");
  } else if (!aboveNisab) {
    notes.push("Your net zakatable wealth is below the selected nisab.");
  } else if (!state.settings.hawlCompleted) {
    notes.push("Your wealth is above nisab, but you marked hawl as not yet complete.");
  } else {
    notes.push("Your net zakatable wealth is above nisab and your hawl is complete.");
  }

  if (state.inputs.advanceZakatPaid > 0) {
    notes.push("Advance zakat already paid has been deducted from the annual wealth-zakat amount.");
  }

  return {
    totalAssets,
    totalLiabilities,
    netAssets,
    selectedNisab,
    aboveNisab,
    wealthPayableNow,
    estimateIfDueToday,
    baseZakat,
    breakdown,
    notes,
  };
}

function calculateAgriculture() {
  const rate =
    state.settings.agricultureIrrigation === "rain"
      ? 0.1
      : state.settings.agricultureIrrigation === "mixed"
        ? 0.075
        : 0.05;
  const aboveNisab = state.inputs.agricultureWeightKg >= AGRICULTURE_NISAB_KG;
  const payableNow =
    aboveNisab && state.inputs.agricultureAssessableValue > 0
      ? state.inputs.agricultureAssessableValue * rate
      : 0;

  return {
    payableNow,
    reason:
      payableNow > 0
        ? `Produce reached nisab, so ${String(rate * 100)}% applies to the entered harvest value.`
        : "No agriculture due from the values entered.",
  };
}

function calculateRikaz() {
  const payableNow = state.inputs.rikazValue > 0 ? state.inputs.rikazValue * 0.2 : 0;
  return {
    payableNow,
    reason:
      payableNow > 0
        ? "Rikaz is calculated separately at one-fifth."
        : "No rikaz value entered.",
  };
}

function calculateLivestock() {
  if (!state.settings.hawlCompleted) {
    return [
      { label: "Camels", value: "Wait for hawl", reason: "Livestock zakat applies after a lunar year." },
      { label: "Cattle or buffalo", value: "Wait for hawl", reason: "Livestock zakat applies after a lunar year." },
      { label: "Sheep or goats", value: "Wait for hawl", reason: "Livestock zakat applies after a lunar year." },
    ];
  }

  return [
    {
      label: "Camels",
      value: resolveCamelDue(state.inputs.camelsCount) || "None",
      reason: "Zakat on grazing livestock is usually paid in kind.",
    },
    {
      label: "Cattle or buffalo",
      value: resolveCattleDue(state.inputs.cattleCount) || "None",
      reason: "Zakat on grazing livestock is usually paid in kind.",
    },
    {
      label: "Sheep or goats",
      value: resolveSheepDue(state.inputs.sheepCount) || "None",
      reason: "Zakat on grazing livestock is usually paid in kind.",
    },
  ];
}

function resolveCamelDue(count) {
  if (count < 5) return null;
  if (count <= 9) return "1 sheep";
  if (count <= 14) return "2 sheep";
  if (count <= 19) return "3 sheep";
  if (count <= 24) return "4 sheep";
  if (count <= 35) return "1 bint makhad";
  if (count <= 45) return "1 bint labun";
  if (count <= 60) return "1 hiqqah";
  if (count <= 75) return "1 jadha'ah";
  if (count <= 90) return "2 bint labun";
  if (count <= 120) return "2 hiqqah";

  let best = null;
  for (let hiqqah = 0; hiqqah <= Math.floor(count / 50); hiqqah += 1) {
    for (let bintLabun = 0; bintLabun <= Math.floor(count / 40); bintLabun += 1) {
      const covered = hiqqah * 50 + bintLabun * 40;
      if (covered < 120 || covered > count || count - covered >= 40) continue;
      const animals = hiqqah + bintLabun;
      const candidate = { covered, animals, hiqqah, bintLabun };
      if (
        !best ||
        candidate.covered > best.covered ||
        (candidate.covered === best.covered && candidate.animals < best.animals)
      ) {
        best = candidate;
      }
    }
  }

  return best
    ? formatAnimalParts([
        [best.hiqqah, "hiqqah"],
        [best.bintLabun, "bint labun"],
      ])
    : "Review with a scholar";
}

function resolveCattleDue(count) {
  if (count < 30) return null;

  let best = null;
  for (let musinnah = 0; musinnah <= Math.floor(count / 40); musinnah += 1) {
    for (let tabi = 0; tabi <= Math.floor(count / 30); tabi += 1) {
      const covered = musinnah * 40 + tabi * 30;
      if (covered < 30 || covered > count || count - covered >= 30) continue;
      const animals = musinnah + tabi;
      const candidate = { covered, animals, musinnah, tabi };
      if (
        !best ||
        candidate.covered > best.covered ||
        (candidate.covered === best.covered && candidate.animals < best.animals) ||
        (candidate.covered === best.covered &&
          candidate.animals === best.animals &&
          candidate.musinnah > best.musinnah)
      ) {
        best = candidate;
      }
    }
  }

  return best
    ? formatAnimalParts([
        [best.tabi, "tabi / tabi'ah"],
        [best.musinnah, "musinnah"],
      ])
    : "Review with a scholar";
}

function resolveSheepDue(count) {
  if (count < 40) return null;
  if (count <= 120) return "1 sheep";
  if (count <= 200) return "2 sheep";
  if (count <= 300) return "3 sheep";
  if (count < 400) return "4 sheep";
  return `${Math.floor(count / 100)} sheep`;
}

function renderContext() {
  const autoLabel = state.settings.autoCurrency ? "Auto" : "Manual";
  updateText(elements.locationLabel, state.userContext.locationLabel || "Your area");
  updateText(elements.currencyLabel, `${state.settings.currency} (${autoLabel})`);
  updateText(elements.locationHint, state.userContext.hint);
}

function renderRates(prices, selectedNisab) {
  const currency = state.settings.currency;
  const goldPerGram = prices.goldPerGram;
  const silverPerGram = prices.silverPerGram;

  updateText(
    elements.goldRatePrimary,
    goldPerGram ? formatCurrency(goldPerGram, currency) : "Need rates"
  );
  updateText(
    elements.goldRateSecondary,
    goldPerGram ? `${formatCurrency(goldPerGram * 31.1034768, currency)} per troy ounce` : "--"
  );
  updateText(
    elements.silverRatePrimary,
    silverPerGram ? formatCurrency(silverPerGram, currency) : "Need rates"
  );
  updateText(
    elements.silverRateSecondary,
    silverPerGram ? `${formatCurrency(silverPerGram * 31.1034768, currency)} per troy ounce` : "--"
  );

  updateText(
    elements.nisabSnapshot,
    Number.isFinite(selectedNisab) ? formatCompactCurrency(selectedNisab, currency) : "Need rates"
  );
  updateText(
    elements.nisabSnapshotNote,
    state.settings.nisabBasis === "silver"
      ? "Silver nisab based on 612.36 grams."
      : "Gold nisab based on 87.48 grams."
  );

  if (state.market.loading) {
    updateText(elements.marketStatusLabel, "Refreshing live metal prices...");
  } else if (state.market.error) {
    updateText(elements.marketStatusLabel, state.market.error);
  } else if (prices.usingManualGold || prices.usingManualSilver) {
    updateText(elements.marketStatusLabel, "Manual metal rate override is active.");
  } else {
    updateText(elements.marketStatusLabel, state.market.sourceLabel);
  }

  updateText(
    elements.marketTimestamp,
    state.market.fetchedAt
      ? `Updated ${formatTimestamp(state.market.fetchedAt)}. These are spot prices in your selected currency.`
      : "Spot prices will appear here."
  );
}

function renderSummary(wealth, agriculture, rikaz, livestock, specialDue, totalDue) {
  const currency = state.settings.currency;
  updateText(elements.payableNowCompact, formatCompactCurrency(totalDue, currency));
  updateText(elements.payableNowExact, `Exact: ${formatCurrency(totalDue, currency)}`);
  updateText(elements.netAssetsValue, formatCurrency(wealth.netAssets, currency));
  updateText(
    elements.nisabValue,
    Number.isFinite(wealth.selectedNisab) ? formatCurrency(wealth.selectedNisab, currency) : "Need rates"
  );
  updateText(
    elements.wealthDueValue,
    wealth.wealthPayableNow > 0
      ? formatCurrency(wealth.wealthPayableNow, currency)
      : wealth.estimateIfDueToday > 0 && !state.settings.hawlCompleted
        ? `${formatCurrency(wealth.estimateIfDueToday, currency)} est.`
        : formatCurrency(0, currency)
  );
  updateText(elements.specialDueValue, formatCurrency(specialDue, currency));

  const status = determineStatus(wealth, totalDue);
  updateText(elements.wealthStatusPill, status.label);
  elements.wealthStatusPill.className = `status-pill ${status.className}`;
  animateNode(elements.wealthStatusPill);
  updateText(elements.wealthReasonText, status.reason);
  updateText(
    elements.methodSummary,
    [
      `${capitalize(state.settings.nisabBasis)} nisab`,
      state.settings.jewelryPolicy === "include-all" ? "jewelry included" : "personal jewelry excluded",
      state.settings.debtMethod === "next-12-months" ? "12-month debt view" : "due-now debt view",
    ].join(", ")
  );

  renderBreakdownRows(wealth.breakdown, currency);
  renderSpecialRows(agriculture, rikaz, livestock, currency);
}

function determineStatus(wealth, totalDue) {
  if (totalDue > 0) {
    return {
      label: "Due now",
      className: "is-due",
      reason: wealth.notes.join(" "),
    };
  }

  if (state.market.error && !state.inputs.manualGoldPerGram && !state.inputs.manualSilverPerGram) {
    return {
      label: "Need rates",
      className: "is-attention",
      reason: state.market.error,
    };
  }

  if (wealth.estimateIfDueToday > 0 && !state.settings.hawlCompleted) {
    return {
      label: "Estimate",
      className: "is-estimate",
      reason: `If your hawl ended today, annual wealth zakat would be about ${formatCurrency(
        wealth.estimateIfDueToday,
        state.settings.currency
      )}.`,
    };
  }

  return {
    label: "Below nisab",
    className: "is-clear",
    reason: wealth.notes.join(" "),
  };
}

function renderBreakdownRows(rows, currency) {
  const signature = JSON.stringify([
    currency,
    ...rows.map((row) => [row.label, row.value, row.reason, row.negative ? 1 : 0]),
  ]);
  if (elements.breakdownRows.dataset.signature === signature) return;
  elements.breakdownRows.dataset.signature = signature;

  if (!rows.length) {
    elements.breakdownRows.innerHTML = '<div class="empty-note">Start entering values to see the breakdown.</div>';
    animateChildren(elements.breakdownRows);
    return;
  }

  elements.breakdownRows.innerHTML = "";
  rows.forEach((row) => {
    const article = document.createElement("article");
    article.className = "list-row";
    article.innerHTML = `
      <div class="list-row-top">
        <strong>${row.label}</strong>
        <span class="value">${row.negative ? "-" : ""}${formatCurrency(Math.abs(row.value), currency)}</span>
      </div>
      <p>${row.reason}</p>
    `;
    elements.breakdownRows.appendChild(article);
  });

  animateChildren(elements.breakdownRows);
}

function renderSpecialRows(agriculture, rikaz, livestock, currency) {
  const rows = [
    {
      label: "Agriculture",
      value: formatCurrency(agriculture.payableNow, currency),
      reason: agriculture.reason,
    },
    {
      label: "Rikaz",
      value: formatCurrency(rikaz.payableNow, currency),
      reason: rikaz.reason,
    },
    ...livestock.map((item) => ({
      label: item.label,
      value: item.value,
      reason: item.reason,
    })),
  ];

  const signature = JSON.stringify([currency, ...rows.map((row) => [row.label, row.value, row.reason])]);
  updateText(
    elements.specialCategoriesHint,
    state.settings.hawlCompleted
      ? "Produce and rikaz are cash amounts. Livestock dues are usually in kind."
      : "Livestock dues are paused because hawl is not complete."
  );
  if (elements.specialRows.dataset.signature === signature) return;
  elements.specialRows.dataset.signature = signature;

  elements.specialRows.innerHTML = "";
  rows.forEach((row) => {
    const article = document.createElement("article");
    article.className = "list-row";
    article.innerHTML = `
      <div class="list-row-top">
        <strong>${row.label}</strong>
        <span class="value">${row.value}</span>
      </div>
      <p>${row.reason}</p>
    `;
    elements.specialRows.appendChild(article);
  });
  animateChildren(elements.specialRows);
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.settings = { ...state.settings, ...saved.settings };
    state.inputs = { ...state.inputs, ...saved.inputs };
  } catch (_error) {
    // Ignore invalid local state.
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      settings: state.settings,
      inputs: state.inputs,
    })
  );
}

function getLocaleRegion() {
  try {
    return new Intl.Locale(locale).maximize().region;
  } catch (_error) {
    return "";
  }
}

function getRegionDisplayName(region) {
  if (!region) return "your area";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(region) || region;
  } catch (_error) {
    return region;
  }
}

function guessCurrencyByLocale() {
  return LOCALE_CURRENCY_MAP[getLocaleRegion()] || "USD";
}

function parsePositiveNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function getCurrencyFormatter(currency) {
  if (!formatterCache.has(currency)) {
    formatterCache.set(
      currency,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      })
    );
  }
  return formatterCache.get(currency);
}

function getCompactCurrencyFormatter(currency) {
  if (!compactFormatterCache.has(currency)) {
    compactFormatterCache.set(
      currency,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 2,
      })
    );
  }
  return compactFormatterCache.get(currency);
}

function formatCurrency(value, currency) {
  return getCurrencyFormatter(currency).format(value || 0);
}

function formatCompactCurrency(value, currency) {
  return getCompactCurrencyFormatter(currency).format(value || 0);
}

function formatTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatAnimalParts(parts) {
  return parts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(" + ");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hydrateRevealObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.12 }
  );

  const nodes = Array.from(
    document.querySelectorAll(
      ".reveal, .surface, .hero-copy, .field-section, .settings-block, .market-tile, .summary-grid article, .page-footer"
    )
  );

  nodes.forEach((node, index) => {
    node.classList.add("motion-item");
    node.style.setProperty("--motion-delay", `${Math.min(index * 35, 220)}ms`);
    observer.observe(node);
  });
}

function updateText(element, nextValue) {
  if (!element || element.textContent === nextValue) return;
  element.textContent = nextValue;
  animateNode(element);
}

function animateChildren(container) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  Array.from(container.children).forEach((child, index) => {
    child.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 280,
        delay: index * 30,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      }
    );
  });
}

function animateNode(element) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.animate(
    [
      { opacity: 0.45, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    {
      duration: 220,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    }
  );
}
