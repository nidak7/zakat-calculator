const TROY_OUNCE_TO_GRAMS = 31.1034768;
const GOLD_NISAB_GRAMS = 87.48;
const SILVER_NISAB_GRAMS = 612.36;
const AGRICULTURE_NISAB_KG = 653;
const STORAGE_KEY = "zakat-calculator-india-v2";
const CURRENCY = "INR";

const FIELD_IDS = [
  "liquidCash",
  "receivables",
  "goldSavingsGrams",
  "goldJewelryGrams",
  "silverSavingsGrams",
  "silverJewelryGrams",
  "investments",
  "businessAssets",
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

const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const elements = {
  nisabBasisRadios: Array.from(document.querySelectorAll('input[name="nisabBasis"]')),
  jewelryPolicy: document.getElementById("jewelryPolicy"),
  debtMethod: document.getElementById("debtMethod"),
  hawlCompleted: document.getElementById("hawlCompleted"),
  agricultureIrrigation: document.getElementById("agricultureIrrigation"),
  refreshPricesButton: document.getElementById("refreshPricesButton"),
  totalDueAmount: document.getElementById("totalDueAmount"),
  wealthStatusPill: document.getElementById("wealthStatusPill"),
  wealthReasonText: document.getElementById("wealthReasonText"),
  netAssetsValue: document.getElementById("netAssetsValue"),
  nisabValue: document.getElementById("nisabValue"),
  wealthDueValue: document.getElementById("wealthDueValue"),
  specialDueValue: document.getElementById("specialDueValue"),
  goldPer10gValue: document.getElementById("goldPer10gValue"),
  goldPerGramValue: document.getElementById("goldPerGramValue"),
  silverPerKgValue: document.getElementById("silverPerKgValue"),
  silverPerGramValue: document.getElementById("silverPerGramValue"),
  marketStatusLabel: document.getElementById("marketStatusLabel"),
  marketTimestamp: document.getElementById("marketTimestamp"),
  breakdownRows: document.getElementById("breakdownRows"),
  specialRows: document.getElementById("specialRows"),
  livestockNote: document.getElementById("livestockNote"),
  methodSummary: document.getElementById("methodSummary"),
};

const state = {
  settings: {
    nisabBasis: "silver",
    jewelryPolicy: "exclude-personal",
    debtMethod: "due-now",
    hawlCompleted: true,
    agricultureIrrigation: "rain",
  },
  inputs: Object.fromEntries(FIELD_IDS.map((field) => [field, 0])),
  market: {
    loading: false,
    error: "",
    goldInrPerOunce: null,
    silverInrPerOunce: null,
    fetchedAt: "",
    sourceLabel: "Loading live India reference rates",
  },
};

window.addEventListener("DOMContentLoaded", init);

async function init() {
  hydrateRevealObserver();
  restoreState();
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

async function refreshMarketData(force = false) {
  if (state.market.loading && !force) return;

  state.market.loading = true;
  state.market.error = "";
  elements.refreshPricesButton.disabled = true;
  renderRates();

  try {
    const [goldData, silverData] = await Promise.all([
      fetchJson("https://api.gold-api.com/price/XAU/INR"),
      fetchJson("https://api.gold-api.com/price/XAG/INR"),
    ]);

    state.market.goldInrPerOunce = parseMetalPrice(goldData);
    state.market.silverInrPerOunce = parseMetalPrice(silverData);
    state.market.fetchedAt =
      goldData.updatedAt || silverData.updatedAt || new Date().toISOString();
    state.market.sourceLabel = "Live INR reference rates";
  } catch (error) {
    state.market.error = "Live India reference rates unavailable. Use manual INR override if needed.";
    state.market.sourceLabel = "Manual override ready";
    console.error(error);
  } finally {
    state.market.loading = false;
    elements.refreshPricesButton.disabled = false;
    render();
  }
}

function parseMetalPrice(data) {
  const price = Number(data?.price ?? data?.ask ?? data?.bid);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Unable to parse metal price");
  }
  return price;
}

function getEffectivePrices() {
  const liveGoldPerGram = state.market.goldInrPerOunce
    ? state.market.goldInrPerOunce / TROY_OUNCE_TO_GRAMS
    : null;
  const liveSilverPerGram = state.market.silverInrPerOunce
    ? state.market.silverInrPerOunce / TROY_OUNCE_TO_GRAMS
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

  renderRates();
  renderSummary(wealth, agriculture, rikaz, livestock, totalDue, specialDue);
}

function calculateWealth(prices) {
  const moneyTotal = state.inputs.liquidCash + state.inputs.receivables;
  const jewelryIncluded = state.settings.jewelryPolicy === "include-all";
  const goldTotalGrams = state.inputs.goldSavingsGrams + (jewelryIncluded ? state.inputs.goldJewelryGrams : 0);
  const silverTotalGrams = state.inputs.silverSavingsGrams + (jewelryIncluded ? state.inputs.silverJewelryGrams : 0);
  const metalsTotal =
    (prices.goldPerGram || 0) * goldTotalGrams + (prices.silverPerGram || 0) * silverTotalGrams;
  const investmentsTotal = state.inputs.investments;
  const businessTotal = state.inputs.businessAssets + state.inputs.otherAssets;
  const totalAssets = moneyTotal + metalsTotal + investmentsTotal + businessTotal;

  const immediateLiabilities = state.inputs.debtsDueNow + state.inputs.billsDueNow;
  const installmentLiabilities =
    state.settings.debtMethod === "next-12-months" ? state.inputs.longTermInstallments : 0;
  const totalLiabilities = immediateLiabilities + installmentLiabilities;
  const netAssets = totalAssets - totalLiabilities;

  const goldNisab = prices.goldPerGram ? prices.goldPerGram * GOLD_NISAB_GRAMS : null;
  const silverNisab = prices.silverPerGram ? prices.silverPerGram * SILVER_NISAB_GRAMS : null;
  const selectedNisab = state.settings.nisabBasis === "gold" ? goldNisab : silverNisab;
  const aboveNisab = Number.isFinite(selectedNisab) ? netAssets >= selectedNisab : false;

  const baseZakat = netAssets > 0 ? netAssets * 0.025 : 0;
  const payableNow =
    state.settings.hawlCompleted && aboveNisab
      ? Math.max(baseZakat - state.inputs.advanceZakatPaid, 0)
      : 0;

  const estimateIfDueToday = Math.max(baseZakat - state.inputs.advanceZakatPaid, 0);

  const breakdown = [
    {
      label: "Money and receivables",
      value: moneyTotal,
      reason: "Cash, bank balances, wallets, and reliable receivables.",
    },
    {
      label: "Gold and silver",
      value: metalsTotal,
      reason: jewelryIncluded
        ? "Savings metals plus jewelry under the current method."
        : "Savings metals only. Personal jewelry is excluded.",
    },
    {
      label: "Investments",
      value: investmentsTotal,
      reason: "Tradable shares, funds, crypto, and similar holdings.",
    },
    {
      label: "Business and other assets",
      value: businessTotal,
      reason: "Business stock, business cash, and other zakatable holdings.",
    },
    {
      label: "Liabilities deducted",
      value: totalLiabilities,
      reason:
        state.settings.debtMethod === "next-12-months"
          ? "Immediate dues plus the next 12 months of installments."
          : "Only debts and bills already due now.",
      negative: true,
    },
  ];

  const notes = [];
  if (!Number.isFinite(selectedNisab)) {
    notes.push("Need live or manual metal rates to test nisab.");
  } else if (netAssets <= 0) {
    notes.push("Liabilities are equal to or greater than your zakatable wealth.");
  } else if (!aboveNisab) {
    notes.push("Net zakatable wealth is below the selected nisab.");
  } else if (!state.settings.hawlCompleted) {
    notes.push("Net wealth is above nisab, but your hawl is not complete yet.");
  } else {
    notes.push("Net wealth is above nisab and your hawl is complete.");
  }

  if (state.inputs.advanceZakatPaid > 0) {
    notes.push("Advance zakat has been deducted from the annual wealth amount.");
  }

  return {
    moneyTotal,
    metalsTotal,
    investmentsTotal,
    businessTotal,
    totalAssets,
    totalLiabilities,
    netAssets,
    selectedNisab,
    baseZakat,
    payableNow,
    estimateIfDueToday,
    breakdown,
    notes,
    aboveNisab,
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
        ? `Harvest reached nisab, so ${String(rate * 100)}% applies to the entered harvest value.`
        : "No agriculture due from the values entered.",
  };
}

function calculateRikaz() {
  const payableNow = state.inputs.rikazValue > 0 ? state.inputs.rikazValue * 0.2 : 0;
  return {
    payableNow,
    reason:
      payableNow > 0
        ? "Rikaz is calculated here at one-fifth immediately."
        : "No rikaz value entered.",
  };
}

function calculateLivestock() {
  if (!state.settings.hawlCompleted) {
    return [
      { label: "Camels", value: "Wait for hawl", reason: "Check after one lunar year." },
      { label: "Cattle or buffalo", value: "Wait for hawl", reason: "Check after one lunar year." },
      { label: "Sheep or goats", value: "Wait for hawl", reason: "Check after one lunar year." },
    ];
  }

  return [
    {
      label: "Camels",
      value: resolveCamelDue(state.inputs.camelsCount) || "None",
      reason: "Livestock zakat is usually paid in kind.",
    },
    {
      label: "Cattle or buffalo",
      value: resolveCattleDue(state.inputs.cattleCount) || "None",
      reason: "Livestock zakat is usually paid in kind.",
    },
    {
      label: "Sheep or goats",
      value: resolveSheepDue(state.inputs.sheepCount) || "None",
      reason: "Livestock zakat is usually paid in kind.",
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

  if (!best) return "Review with a scholar";
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

  if (!best) return "Review with a scholar";
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

function renderSummary(wealth, agriculture, rikaz, livestock, totalDue, specialDue) {
  updateText(elements.totalDueAmount, formatter.format(totalDue));
  updateText(elements.netAssetsValue, formatter.format(wealth.netAssets));
  updateText(
    elements.nisabValue,
    Number.isFinite(wealth.selectedNisab) ? compactFormatter.format(wealth.selectedNisab) : "Need rates"
  );
  updateText(
    elements.wealthDueValue,
    wealth.payableNow > 0
      ? formatter.format(wealth.payableNow)
      : wealth.estimateIfDueToday > 0 && !state.settings.hawlCompleted
        ? `${formatter.format(wealth.estimateIfDueToday)} est.`
        : formatter.format(0)
  );
  updateText(elements.specialDueValue, formatter.format(specialDue));

  const status = determineStatus(wealth, totalDue);
  updateText(elements.wealthStatusPill, status.label);
  elements.wealthStatusPill.className = `status-pill ${status.className}`;
  animateNode(elements.wealthStatusPill);
  updateText(elements.wealthReasonText, status.reason);
  updateText(
    elements.methodSummary,
    [
      `${capitalize(state.settings.nisabBasis)} nisab`,
      state.settings.jewelryPolicy === "include-all" ? "all jewelry included" : "personal jewelry excluded",
      state.settings.debtMethod === "next-12-months" ? "12-month debt rule" : "due-now debt rule",
    ].join(", ")
  );

  renderBreakdown(wealth.breakdown);
  renderSpecialRows(agriculture, rikaz, livestock);
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
      reason: `If your hawl ended today, estimated wealth zakat would be ${formatter.format(wealth.estimateIfDueToday)}.`,
    };
  }

  return {
    label: "Below nisab",
    className: "is-clear",
    reason: wealth.notes.join(" "),
  };
}

function renderRates() {
  const prices = getEffectivePrices();
  const goldPer10g = prices.goldPerGram ? prices.goldPerGram * 10 : null;
  const silverPerKg = prices.silverPerGram ? prices.silverPerGram * 1000 : null;

  updateText(elements.goldPer10gValue, goldPer10g ? formatter.format(goldPer10g) : "Need rate");
  updateText(
    elements.goldPerGramValue,
    prices.goldPerGram ? `${formatter.format(prices.goldPerGram)} per gram` : "--"
  );
  updateText(elements.silverPerKgValue, silverPerKg ? formatter.format(silverPerKg) : "Need rate");
  updateText(
    elements.silverPerGramValue,
    prices.silverPerGram ? `${formatter.format(prices.silverPerGram)} per gram` : "--"
  );

  if (state.market.loading) {
    updateText(elements.marketStatusLabel, "Refreshing live India reference rates...");
  } else if (state.market.error) {
    updateText(elements.marketStatusLabel, state.market.error);
  } else if (prices.usingManualGold || prices.usingManualSilver) {
    updateText(elements.marketStatusLabel, "Manual INR override is active.");
  } else {
    updateText(elements.marketStatusLabel, state.market.sourceLabel);
  }

  updateText(
    elements.marketTimestamp,
    state.market.fetchedAt
      ? `Updated ${formatTimestamp(state.market.fetchedAt)}. These are reference rates, not local retail city quotes.`
      : "Indian reference rates will appear here."
  );
}

function renderBreakdown(rows) {
  const visibleRows = rows.filter((row) => Math.abs(row.value) > 0);
  const signature = JSON.stringify(
    visibleRows.map((row) => [row.label, row.value, row.reason, row.negative ? 1 : 0])
  );

  if (elements.breakdownRows.dataset.signature === signature) {
    return;
  }

  elements.breakdownRows.dataset.signature = signature;

  if (!visibleRows.length) {
    elements.breakdownRows.innerHTML = '<div class="empty-note">Start entering values to see the breakdown.</div>';
    animateChildren(elements.breakdownRows);
    return;
  }

  elements.breakdownRows.innerHTML = "";
  visibleRows.forEach((row) => {
    const article = document.createElement("article");
    article.className = "list-row";
    article.innerHTML = `
      <div class="list-row-top">
        <strong>${row.label}</strong>
        <span class="value">${row.negative ? "-" : ""}${formatter.format(Math.abs(row.value))}</span>
      </div>
      <p>${row.reason}</p>
    `;
    elements.breakdownRows.appendChild(article);
  });

  animateChildren(elements.breakdownRows);
}

function renderSpecialRows(agriculture, rikaz, livestock) {
  const rows = [
    {
      label: "Agriculture",
      value: formatter.format(agriculture.payableNow),
      reason: agriculture.reason,
    },
    {
      label: "Rikaz",
      value: formatter.format(rikaz.payableNow),
      reason: rikaz.reason,
    },
    ...livestock.map((item) => ({
      label: item.label,
      value: item.value,
      reason: item.reason,
    })),
  ];

  const signature = JSON.stringify(rows.map((row) => [row.label, row.value, row.reason]));
  if (elements.specialRows.dataset.signature === signature) {
    updateText(
      elements.livestockNote,
      state.settings.hawlCompleted
        ? "Livestock dues are shown as animals due in kind."
        : "Livestock dues are paused because hawl is not complete."
    );
    return;
  }

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
  updateText(
    elements.livestockNote,
    state.settings.hawlCompleted
      ? "Livestock dues are shown as animals due in kind."
      : "Livestock dues are paused because hawl is not complete."
  );
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

function formatTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.settings = { ...state.settings, ...saved.settings };
    state.inputs = { ...state.inputs, ...saved.inputs };
  } catch (_error) {
    // Ignore corrupted local state.
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
      ".reveal, .surface, .hero-copy, .field-group, .optional-block, .site-footer, .result-stats article"
    )
  );

  nodes.forEach((node, index) => {
    node.classList.add("motion-item");
    node.style.setProperty("--motion-delay", `${Math.min(index * 40, 240)}ms`);
    observer.observe(node);
  });
}

function updateText(element, nextValue) {
  if (!element) return;
  if (element.textContent === nextValue) return;
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
        delay: index * 35,
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
      { opacity: 0.55, transform: "translateY(8px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    {
      duration: 220,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    }
  );
}
