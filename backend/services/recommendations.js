// Actionable safety recommendations for out-of-range water readings.
// Every recommendation is bilingual (English + Marathi) so a critical alert
// can tell each registered subscriber exactly what to do — in their language.

const GENERIC = [
  {
    en: 'Use an alternative safe water source (boiled or packaged water) for drinking and cooking until the alert is cleared.',
    mr: 'अलर्ट काढल्यापर्यंत प्यायचे व रांगणीसाठी पर्यायी सुरक्षित पाणी (उकळलेले किंवा पॅकेजचे) वापरा.'
  },
  {
    en: 'Inform the village water officer / gram panchayat immediately if people nearby feel unwell.',
    mr: 'जवळच्यांना अस्वस्थता जाणवल्यास लगेच गाव पाण्याचे अधिकारी / ग्रामपंचायताला कळवा.'
  }
];

const ADVICE = {
  pH: {
    both: [
      {
        en: 'Do not drink, cook or brush teeth with this water until pH returns to the safe range.',
        mr: 'पीएच सुरक्षित श्रेणीत परत येईपर्यंत या पाण्याचे प्यायचे, रांगणी व दात मारण्यास वापरू नका.'
      },
      {
        en: 'Avoid washing clothes or bathing with it — very high or very low pH can irritate skin.',
        mr: 'त्यात कपडे धुणे किंवा स्नान करणे टाळा — खूप जास्त किंवा खूप कमी पीएच त्वचेला खवडू शकते.'
      }
    ]
  },
  TDS: {
    high: [
      {
        en: 'Do not drink this water — high TDS (dissolved solids) can cause stomach trouble and long-term health issues.',
        mr: 'हे पाणी प्यायचे नको — जास्त TDS (द्रवित घटक) पोटदुखी व दीर्घकालीन आरोग्यसमस्या निर्माण करू शकते.'
      },
      {
        en: 'Boiling does NOT reduce TDS — use RO or packaged drinking water instead.',
        mr: 'उकळण्याने TDS कमी होत नाही — त्याऐवजी RO किंवा पॅकेजचे पिण्याचे पाणी वापरा.'
      },
      {
        en: 'Fit a sediment + carbon filter or RO purifier before using this water.',
        mr: 'हे पाणी वापरण्यापूर्वी सिडिमेंट + कार्बन फिल्टर किंवा RO शुद्धीकरण यंत्र बसवा.'
      }
    ],
    low: [
      {
        en: 'Very low mineral content — not ideal for daily drinking; prefer packaged or RO water.',
        mr: 'खूप कमी खनिज आहे — रोजच्या प्यायच्या पाण्यासाठी योग्य नाही; पॅकेजचे किंवा RO पाणी पसंत करा.'
      }
    ]
  },
  Turbidity: {
    high: [
      {
        en: 'Water is cloudy or muddy — do not drink it as-is.',
        mr: 'पाणी चिकट किंवा गळगळीत आहे — तसेच प्यायचे नको.'
      },
      {
        en: 'Let it settle for a few hours, filter through a clean cloth — and still boil before drinking.',
        mr: 'काही तास गोठू द्या, नंतर स्वच्छ कापड्याने गाळा — आणि प्याण्यापूर्वी नक्की उकळा.'
      },
      {
        en: 'High turbidity often carries germs — boiling or disinfecting (chlorine / UV) is essential.',
        mr: 'जास्त कलमीपणा रोगकिरकिर्या घेऊन येतो — उकळणे किंवा क्लोरीन / UV निर्जंतुकीकरण आवश्यक.'
      }
    ]
  }
};

// Recommendations for one out-of-range parameter (direction-aware).
const buildRecommendations = (parameter, value, min, max) => {
  const key = parameter === 'pH' ? 'pH' : parameter === 'TDS' ? 'TDS' : 'Turbidity';
  const rule = ADVICE[key] || {};
  const direction = value > max ? 'high' : 'low';
  // pH is unsafe in BOTH directions; TDS / Turbidity advice differs by direction.
  const specific = key === 'pH' ? rule.both || [] : rule[direction] || rule.high || [];
  return [...specific, ...GENERIC];
};

// Short SMS body (English) with the single most important instruction first.
const buildSmsText = (parameter, value, min, max, recommendations = []) => {
  const first = recommendations[0] ? recommendations[0].en : 'Stop using this water.';
  return `🚨 EnviroSense CRITICAL: ${parameter} = ${value} (safe ${min}-${max}). ${first} Details sent to your registered email.`;
};

// One-line log-friendly summary used in demo mode.
const summarize = (recommendations) =>
  recommendations.map((r) => `• ${r.en}\n  ${r.mr}`).join('\n');

module.exports = { buildRecommendations, buildSmsText, summarize };
