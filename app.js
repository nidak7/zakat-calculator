const TROY_OUNCE_TO_GRAMS = 31.1034768;
const GOLD_NISAB_GRAMS = 87.48;
const SILVER_NISAB_GRAMS = 612.36;
const AGRICULTURE_NISAB_KG = 653;
const STORAGE_KEY = "zakat-calculator-state-v1";

const FIELD_IDS = [
  "cashOnHand",
  "bankBalances",
  "digitalWallets",
  "savingsForGoals",
  "goodLoans",
  "goldSavingsGrams",
  "goldJewelryGrams",
  "silverSavingsGrams",
  "silverJewelryGrams",
  "stocksFunds",
  "crypto",
  "retirementAccessible",
  "realEstateForSale",
  "otherInvestments",
  "businessCash",
  "businessInventory",
  "businessReceivables",
  "rentalNetIncome",
  "otherZakatableAssets",
  "debtsDueNow",
  "billsDueNow",
  "taxesAndWagesDue",
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

const elements = {
  currencySelect: document.getElementById("currencySelect"),
  nisabBasisRadios: Array.from(document.querySelectorAll('input[name="nisabBasis"]')),
  jewelryPolicy: document.getElementById("jewelryPolicy"),
  debtMethod: document.getElementById("debtMethod"),
  hawlCompleted: document.getElementById("hawlCompleted"),
  agricultureIrrigation: document.getElementById("agricultureIrrigation"),
  refreshPricesButton: document.getElementById("refreshPricesButton"),
  goldPerGramValue: document.getElementById("goldPerGramValue"),
  goldPerOunceValue: document.getElementById("goldPerOunceValue"),
  silverPerGramValue: document.getElementById("silverPerGramValue"),
  silverPerOunceValue: document.getElementById("silverPerOunceValue"),
  marketStatusLabel: document.getElementById("marketStatusLabel"),
  marketTimestamp: document.getElementById("marketTimestamp"),
  wealthStatusPill: document.getElementById("wealthStatusPill"),
  totalDueAmount: document.getElementById("totalDueAmount"),
  wealthReasonText: document.getElementById("wealthReasonText"),
  assetsTotalValue: document.getElementById("assetsTotalValue"),
  liabilitiesTotalValue: document.getElementById("liabilitiesTotalValue"),
  netAssetsValue: document.getElementById("netAssetsValue"),
  nisabValue: document.getElementById("nisabValue"),
  countedBreakdown: document.getElementById("countedBreakdown"),
  deductedBreakdown: document.getElementById("deductedBreakdown"),
  specialBreakdown: document.getElementById("specialBreakdown"),
  countedHint: document.getElementById("countedHint"),
  excludedList: document.getElementById("excludedList"),
};

const state = {
  settings: {
    currency: "USD",
    nisabBasis: "silver",
    jewelryPolicy: "exclude-personal",
    debtMethod: "due-now",
    hawlCompleted: true,
    agricultureIrrigation: "rain",
  },
  currencies: [],
  inputs: Object.fromEntries(FIELD_IDS.map((field) => [field, 0])),
  market: {
    loading: false,
    error: "",
    goldUsdPerOunce: null,
    silverUsdPerOunce: null,
    fxRate: 1,
    fetchedAt: "",
    sourceLabel: "Waiting for live prices",
  },
};

window.addEventListener("DOMContentLoaded", init);

async function init() {
  hydrateRevealObserver();
  state.currencies = await loadCurrencyOptions();
  restoreState();
  populateCurrencySelect();
  bindEvents();
  syncControlsFromState();
  render();
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
    saveState();
    render();
    await refreshMarketData();
  });

  elements.nisabBasisRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        state.settings.nisabBasis = radio.value;
        saveState();
        render();
      }
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

function populateCurrencySelect() {
  elements.currencySelect.innerHTML = "";
  state.currencies.forEach(({ code, label }) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} · ${label}`;
    elements.currencySelect.appendChild(option);
  });

  const availableCodes = new Set(state.currencies.map((item) => item.code));
  if (!availableCodes.has(state.settings.currency)) {
    state.settings.currency = guessCurrency(availableCodes);
  }
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
    const value = state.inputs[fieldId];
    input.value = value > 0 ? String(value) : "";
  });
}

async function loadCurrencyOptions() {
  try {
    const data = await fetchJson("https://api.frankfurter.dev/v2/currencies");
    const parsed = parseCurrencyOptions(data);
    if (parsed.length > 0) return parsed;
  } catch (_error) {
    // Fall back below.
  }

  return FALLBACK_CURRENCIES.map(([code, label]) => ({ code, label }));
}

function parseCurrencyOptions(data) {
  if (Array.isArray(data)) {
    return data
      .map((entry) => ({
        code: entry.code || entry.currency || entry.symbol,
        label: entry.name || entry.currencyName || entry.description || entry.code,
      }))
      .filter((entry) => entry.code && entry.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([code, value]) => ({
        code,
        label: typeof value === "string" ? value : value?.name || code,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  return [];
}

async function refreshMarketData(force = false) {
  if (state.market.loading && !force) return;

  state.market.loading = true;
  state.market.error = "";
  elements.refreshPricesButton.disabled = true;
  renderMarket();

  try {
    const [goldData, silverData, fxData] = await Promise.all([
      fetchJson("https://api.gold-api.com/price/XAU"),
      fetchJson("https://api.gold-api.com/price/XAG"),
      fetchExchangeRate(state.settings.currency),
    ]);

    state.market.goldUsdPerOunce = parseMetalPrice(goldData);
    state.market.silverUsdPerOunce = parseMetalPrice(silverData);
    state.market.fxRate = parseExchangeRate(fxData, state.settings.currency);
    state.market.fetchedAt =
      goldData.updatedAtReadable ||
      goldData.updatedAt ||
      silverData.updatedAtReadable ||
      silverData.updatedAt ||
      new Date().toISOString();
    state.market.sourceLabel = "Live spot prices converted from USD";
  } catch (error) {
    state.market.error = "Live prices unavailable. Use the manual per-gram override if needed.";
    state.market.sourceLabel = "Manual override ready";
    console.error(error);
  } finally {
    state.market.loading = false;
    elements.refreshPricesButton.disabled = false;
    render();
  }
}

async function fetchExchangeRate(currency) {
  if (currency === "USD") return { rates: { USD: 1 } };
  return fetchJson(`https://api.frankfurter.dev/v2/rates?base=USD&quotes=${encodeURIComponent(currency)}`);
}

function parseMetalPrice(data) {
  const price = Number(data?.price ?? data?.ask ?? data?.bid);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Unable to parse metal price");
  }
  return price;
}

function parseExchangeRate(data, currency) {
  if (currency === "USD") return 1;

  if (Array.isArray(data) && Number.isFinite(Number(data[0]?.rate))) {
    return Number(data[0].rate);
  }

  if (data?.rates && Number.isFinite(Number(data.rates[currency]))) {
    return Number(data.rates[currency]);
  }

  if (Array.isArray(data?.rates)) {
    const match = data.rates.find((entry) => entry.quote === currency || entry.code === currency);
    if (match && Number.isFinite(Number(match.rate))) {
      return Number(match.rate);
    }
  }

  throw new Error("Unable to parse exchange rate");
}

function render() {
  const effectivePrices = getEffectivePrices();
  const wealth = calculateWealth(effectivePrices);
  const agriculture = calculateAgriculture();
  const livestock = calculateLivestock();
  const rikaz = calculateRikaz();
  const totalCurrencyDue = wealth.payableNow + agriculture.payableNow + rikaz.payableNow;

  renderMarket();
  renderSummary(wealth, agriculture, livestock, rikaz, totalCurrencyDue);
  renderExcludedGuidance();
}

function getEffectivePrices() {
  const liveGold = state.market.goldUsdPerOunce
    ? (state.market.goldUsdPerOunce * state.market.fxRate) / TROY_OUNCE_TO_GRAMS
    : null;
  const liveSilver = state.market.silverUsdPerOunce
    ? (state.market.silverUsdPerOunce * state.market.fxRate) / TROY_OUNCE_TO_GRAMS
    : null;

  const manualGold = state.inputs.manualGoldPerGram > 0 ? state.inputs.manualGoldPerGram : null;
  const manualSilver = state.inputs.manualSilverPerGram > 0 ? state.inputs.manualSilverPerGram : null;

  return {
    goldPerGram: manualGold ?? liveGold,
    silverPerGram: manualSilver ?? liveSilver,
    goldPerOunce: (manualGold ?? liveGold) ? (manualGold ?? liveGold) * TROY_OUNCE_TO_GRAMS : null,
    silverPerOunce: (manualSilver ?? liveSilver) ? (manualSilver ?? liveSilver) * TROY_OUNCE_TO_GRAMS : null,
    usingManualGold: Boolean(manualGold),
    usingManualSilver: Boolean(manualSilver),
  };
}

function calculateWealth(prices) {
  const assets = [];
  const deductions = [];
  const reasons = [];

  addMoneyLine(assets, "Cash on hand", state.inputs.cashOnHand, "Cash is fully zakatable once part of your hawl.");
  addMoneyLine(assets, "Bank balances", state.inputs.bankBalances, "Banked money remains fully owned wealth.");
  addMoneyLine(assets, "Digital wallets", state.inputs.digitalWallets, "Wallet balances are liquid money.");
  addMoneyLine(assets, "Savings for future goals", state.inputs.savingsForGoals, "Money reserved for Hajj, study, marriage, or emergencies still counts.");
  addMoneyLine(assets, "Good loans receivable", state.inputs.goodLoans, "Only likely recoverable debts are counted.");

  const goldSavingsValue = (prices.goldPerGram || 0) * state.inputs.goldSavingsGrams;
  const goldJewelryValue = (prices.goldPerGram || 0) * state.inputs.goldJewelryGrams;
  const silverSavingsValue = (prices.silverPerGram || 0) * state.inputs.silverSavingsGrams;
  const silverJewelryValue = (prices.silverPerGram || 0) * state.inputs.silverJewelryGrams;

  addMoneyLine(assets, "Gold held as savings", goldSavingsValue, "Gold savings are classic zakatable wealth.");
  addMoneyLine(assets, "Silver held as savings", silverSavingsValue, "Silver savings are classic zakatable wealth.");

  if (state.settings.jewelryPolicy === "include-all") {
    addMoneyLine(assets, "Gold jewelry", goldJewelryValue, "Included because you selected the all-jewelry method.");
    addMoneyLine(assets, "Silver jewelry", silverJewelryValue, "Included because you selected the all-jewelry method.");
  }

  addMoneyLine(assets, "Stocks, ETFs, and funds", state.inputs.stocksFunds, "Tradable investments are treated here at current value.");
  addMoneyLine(assets, "Crypto assets", state.inputs.crypto, "Crypto is treated here as a liquid investment holding.");
  addMoneyLine(assets, "Accessible retirement funds", state.inputs.retirementAccessible, "Use only the amount you could actually withdraw.");
  addMoneyLine(assets, "Property held for resale", state.inputs.realEstateForSale, "Trade property is handled like inventory.");
  addMoneyLine(assets, "Other liquid investments", state.inputs.otherInvestments, "Extra saleable wealth belongs in zakatable assets.");

  addMoneyLine(assets, "Business cash", state.inputs.businessCash, "Business cash is part of zakatable working capital.");
  addMoneyLine(assets, "Business inventory", state.inputs.businessInventory, "Trade goods are valued at current sale value.");
  addMoneyLine(assets, "Business receivables", state.inputs.businessReceivables, "Expected receivables to the business are counted.");
  addMoneyLine(assets, "Net rental income on hand", state.inputs.rentalNetIncome, "Income on hand is counted, not the rented asset itself.");
  addMoneyLine(assets, "Other zakatable assets", state.inputs.otherZakatableAssets, "Use this for any extra liquid or tradeable wealth.");

  addMoneyLine(deductions, "Debts due now", state.inputs.debtsDueNow, "Immediate personal debts can be deducted.");
  addMoneyLine(deductions, "Bills due now", state.inputs.billsDueNow, "Only liabilities already due are deducted.");
  addMoneyLine(deductions, "Taxes or wages due", state.inputs.taxesAndWagesDue, "Existing payables are deductible.");

  if (state.settings.debtMethod === "next-12-months") {
    addMoneyLine(
      deductions,
      "Installments due within 12 months",
      state.inputs.longTermInstallments,
      "Included because you selected the 12-month debt method."
    );
  }

  const totalAssets = sumAmounts(assets);
  const totalDeductions = sumAmounts(deductions);
  const netAssets = totalAssets - totalDeductions;

  const goldNisab = prices.goldPerGram ? GOLD_NISAB_GRAMS * prices.goldPerGram : null;
  const silverNisab = prices.silverPerGram ? SILVER_NISAB_GRAMS * prices.silverPerGram : null;
  const selectedNisab = state.settings.nisabBasis === "gold" ? goldNisab : silverNisab;
  const aboveNisab = Number.isFinite(selectedNisab) ? netAssets >= selectedNisab : false;

  const baseZakat = netAssets > 0 ? netAssets * 0.025 : 0;
  const payableNow =
    state.settings.hawlCompleted && aboveNisab
      ? Math.max(baseZakat - state.inputs.advanceZakatPaid, 0)
      : 0;

  if (!Number.isFinite(selectedNisab)) {
    reasons.push("Live or manual metal prices are needed to determine the nisab.");
  } else if (netAssets <= 0) {
    reasons.push("Your deductible liabilities are equal to or greater than your zakatable assets.");
  } else if (!aboveNisab) {
    reasons.push("Your net zakatable assets are below the selected nisab threshold.");
  } else if (!state.settings.hawlCompleted) {
    reasons.push("Your wealth is above nisab, but you marked that one lunar year has not yet passed.");
  } else {
    reasons.push("Your net zakatable assets are above nisab and you marked your hawl as complete.");
  }

  if (state.inputs.advanceZakatPaid > 0) {
    reasons.push("Advance zakat already paid has been deducted from the annual wealth-zakat amount only.");
  }

  if (state.settings.jewelryPolicy === "exclude-personal") {
    reasons.push("Personal gold and silver jewelry is currently excluded unless you change the jewelry setting.");
  } else {
    reasons.push("Personal gold and silver jewelry is currently included because of your selected jewelry method.");
  }

  return {
    assets,
    deductions,
    totalAssets,
    totalDeductions,
    netAssets,
    goldNisab,
    silverNisab,
    selectedNisab,
    baseZakat,
    payableNow,
    estimatedIfDueToday: Math.max(baseZakat - state.inputs.advanceZakatPaid, 0),
    reasons,
    aboveNisab,
  };
}

function calculateAgriculture() {
  const weight = state.inputs.agricultureWeightKg;
  const value = state.inputs.agricultureAssessableValue;
  const rate =
    state.settings.agricultureIrrigation === "rain"
      ? 0.1
      : state.settings.agricultureIrrigation === "mixed"
        ? 0.075
        : 0.05;
  const aboveNisab = weight >= AGRICULTURE_NISAB_KG;
  const payableNow = aboveNisab && value > 0 ? value * rate : 0;

  return {
    payableNow,
    rate,
    aboveNisab,
    reason:
      aboveNisab && value > 0
        ? `Produce reached the five-wasq threshold, so the selected harvest rate of ${(rate * 100).toFixed(1)}% applies.`
        : "No agricultural zakat is due here unless harvest weight reaches the five-wasq threshold and you enter an assessable value.",
  };
}

function calculateRikaz() {
  const value = state.inputs.rikazValue;
  return {
    payableNow: value > 0 ? value * 0.2 : 0,
    reason:
      value > 0
        ? "Rikaz is charged here at one-fifth immediately and is not tied to the annual hawl."
        : "No rikaz value entered.",
  };
}

function calculateLivestock() {
  const hawlReady = state.settings.hawlCompleted;

  return [
    {
      label: "Camels",
      result: hawlReady ? resolveCamelDue(state.inputs.camelsCount) : null,
      fallback: hawlReady
        ? "No camel zakat due yet."
        : "Check again when a lunar year is complete for the herd.",
    },
    {
      label: "Cattle / buffalo",
      result: hawlReady ? resolveCattleDue(state.inputs.cattleCount) : null,
      fallback: hawlReady
        ? "No cattle zakat due yet."
        : "Check again when a lunar year is complete for the herd.",
    },
    {
      label: "Sheep / goats",
      result: hawlReady ? resolveSheepDue(state.inputs.sheepCount) : null,
      fallback: hawlReady
        ? "No sheep or goat zakat due yet."
        : "Check again when a lunar year is complete for the flock.",
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

  if (!best) return "Review camel thresholds with a scholar";
  return formatAnimalParts([
    [best.hiqqah, "hiqqah"],
    [best.bintLabun, "bint labun"],
  ]);
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

  if (!best) return "Review cattle thresholds with a scholar";
  return formatAnimalParts([
    [best.tabi, "tabi / tabi'ah"],
    [best.musinnah, "musinnah"],
  ]);
}

function resolveSheepDue(count) {
  if (count < 40) return null;
  if (count <= 120) return "1 sheep";
  if (count <= 200) return "2 sheep";
  if (count <= 300) return "3 sheep";
  if (count < 400) return "4 sheep";
  return `${Math.floor(count / 100)} sheep`;
}

function renderSummary(wealth, agriculture, livestock, rikaz, totalCurrencyDue) {
  const formatter = getCurrencyFormatter(state.settings.currency);
  const overallStatus = determineStatus(wealth, agriculture, rikaz, totalCurrencyDue);

  elements.totalDueAmount.textContent = formatter.format(totalCurrencyDue);
  elements.assetsTotalValue.textContent = formatter.format(wealth.totalAssets);
  elements.liabilitiesTotalValue.textContent = formatter.format(wealth.totalDeductions);
  elements.netAssetsValue.textContent = formatter.format(wealth.netAssets);
  elements.nisabValue.textContent = Number.isFinite(wealth.selectedNisab)
    ? formatter.format(wealth.selectedNisab)
    : "Need prices";

  elements.wealthStatusPill.textContent = overallStatus.label;
  elements.wealthStatusPill.className = `status-pill ${overallStatus.className}`;
  elements.wealthReasonText.textContent = overallStatus.reason;

  renderDetailRows(elements.countedBreakdown, wealth.assets, "No positive zakatable assets entered yet.", formatter);
  renderDetailRows(
    elements.deductedBreakdown,
    wealth.deductions,
    "No deductible liabilities are being applied right now.",
    formatter
  );

  const specialRows = [
    {
      label: "Annual wealth zakat",
      value: wealth.payableNow > 0 ? formatter.format(wealth.payableNow) : formatter.format(wealth.estimatedIfDueToday),
      reason:
        wealth.payableNow > 0
          ? "2.5% applied to net zakatable wealth after the selected nisab and hawl checks."
          : wealth.reasons[0],
    },
    {
      label: "Agriculture",
      value: agriculture.payableNow > 0 ? formatter.format(agriculture.payableNow) : formatter.format(0),
      reason: agriculture.reason,
    },
    {
      label: "Rikaz",
      value: rikaz.payableNow > 0 ? formatter.format(rikaz.payableNow) : formatter.format(0),
      reason: rikaz.reason,
    },
    ...livestock.map((entry) => ({
      label: entry.label,
      value: entry.result || "None",
      reason: entry.result
        ? "Livestock zakat is usually given in kind according to herd thresholds."
        : entry.fallback,
    })),
  ];

  renderSimpleRows(elements.specialBreakdown, specialRows, "No special-category zakat is due from the values entered.");

  elements.countedHint.textContent =
    state.settings.jewelryPolicy === "include-all"
      ? "Jewelry is included under your current method."
      : "Personal jewelry is currently excluded unless you change the method.";
}

function determineStatus(wealth, agriculture, rikaz, totalCurrencyDue) {
  if (totalCurrencyDue > 0) {
    return {
      label: "Due now",
      className: "is-due",
      reason: totalCurrencyDue === wealth.payableNow
        ? wealth.reasons.join(" ")
        : `Some immediate zakat is due now. ${wealth.reasons.join(" ")}`,
    };
  }

  if (state.market.error && !state.inputs.manualGoldPerGram && !state.inputs.manualSilverPerGram) {
    return {
      label: "Need prices",
      className: "is-attention",
      reason: state.market.error,
    };
  }

  if (wealth.estimatedIfDueToday > 0 && !state.settings.hawlCompleted) {
    return {
      label: "Estimate",
      className: "is-estimate",
      reason: `Estimated annual wealth zakat if your hawl ended today: ${getCurrencyFormatter(state.settings.currency).format(wealth.estimatedIfDueToday)}.`,
    };
  }

  return {
    label: "Below nisab",
    className: "is-clear",
    reason: wealth.reasons.join(" "),
  };
}

function renderMarket() {
  const prices = getEffectivePrices();
  const formatter = getCurrencyFormatter(state.settings.currency);

  elements.goldPerGramValue.textContent = prices.goldPerGram ? formatter.format(prices.goldPerGram) : "Need price";
  elements.goldPerOunceValue.textContent = prices.goldPerOunce ? `${formatter.format(prices.goldPerOunce)} / oz` : "--";
  elements.silverPerGramValue.textContent = prices.silverPerGram ? formatter.format(prices.silverPerGram) : "Need price";
  elements.silverPerOunceValue.textContent = prices.silverPerOunce ? `${formatter.format(prices.silverPerOunce)} / oz` : "--";

  if (state.market.loading) {
    elements.marketStatusLabel.textContent = "Refreshing live prices...";
  } else if (state.market.error) {
    elements.marketStatusLabel.textContent = state.market.error;
  } else {
    elements.marketStatusLabel.textContent =
      prices.usingManualGold || prices.usingManualSilver
        ? "Manual metal override is active."
        : state.market.sourceLabel;
  }

  elements.marketTimestamp.textContent = state.market.fetchedAt
    ? `Last price update: ${formatTimestamp(state.market.fetchedAt)}.`
    : "Spot prices are converted from USD into your selected currency.";
}

function renderExcludedGuidance() {
  const items = [
    "Your primary home and normal household furniture.",
    "Your personal car, clothing, phones, and daily-use items.",
    "Business equipment and fixed assets not held for sale.",
    "Doubtful receivables you do not reasonably expect back.",
  ];

  if (state.settings.jewelryPolicy === "exclude-personal") {
    items.push("Personal gold and silver jewelry under the current jewelry setting.");
  }

  elements.excludedList.innerHTML = "";
  items.forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    elements.excludedList.appendChild(item);
  });
}

function renderDetailRows(container, rows, emptyMessage, formatter) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = "";
  rows.forEach((row) => {
    const wrapper = document.createElement("article");
    wrapper.className = "detail-row";
    wrapper.innerHTML = `
      <div class="detail-row-top">
        <strong>${row.label}</strong>
        <span class="value">${formatter.format(row.amount)}</span>
      </div>
      <p>${row.reason}</p>
    `;
    container.appendChild(wrapper);
  });
}

function renderSimpleRows(container, rows, emptyMessage) {
  const visibleRows = rows.filter((row) => row.value !== null && row.value !== undefined);
  if (!visibleRows.length) {
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = "";
  visibleRows.forEach((row) => {
    const wrapper = document.createElement("article");
    wrapper.className = "detail-row";
    wrapper.innerHTML = `
      <div class="detail-row-top">
        <strong>${row.label}</strong>
        <span class="value">${row.value}</span>
      </div>
      <p>${row.reason}</p>
    `;
    container.appendChild(wrapper);
  });
}

function addMoneyLine(target, label, amount, reason) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  target.push({ label, amount, reason });
}

function sumAmounts(items) {
  return items.reduce((total, item) => total + item.amount, 0);
}

function parsePositiveNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getCurrencyFormatter(currency) {
  if (!formatterCache.has(currency)) {
    formatterCache.set(
      currency,
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      })
    );
  }

  return formatterCache.get(currency);
}

function formatTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.settings.currency = guessCurrency(new Set(state.currencies.map((item) => item.code)));
      return;
    }

    const saved = JSON.parse(raw);
    state.settings = {
      ...state.settings,
      ...saved.settings,
      currency:
        saved.settings?.currency && state.currencies.some((item) => item.code === saved.settings.currency)
          ? saved.settings.currency
          : guessCurrency(new Set(state.currencies.map((item) => item.code))),
    };
    state.inputs = {
      ...state.inputs,
      ...saved.inputs,
    };
  } catch (_error) {
    state.settings.currency = guessCurrency(new Set(state.currencies.map((item) => item.code)));
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

function guessCurrency(availableCodes) {
  try {
    const locale = new Intl.Locale(navigator.language || "en-US");
    const region = locale.maximize().region;
    const guessed = LOCALE_CURRENCY_MAP[region] || "USD";
    return availableCodes.has(guessed) ? guessed : "USD";
  } catch (_error) {
    return availableCodes.has("USD") ? "USD" : [...availableCodes][0];
  }
}

function formatAnimalParts(parts) {
  return parts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(" + ");
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

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}
