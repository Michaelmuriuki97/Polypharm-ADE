/* ============================================================
   POLYPHARM ADE CLINICAL SUPPORT
   PHARMACY RULE ENGINE
   ============================================================

   Purpose:
   - Store clinical safety rules separately from UI
   - Support broad medication classes
   - Support drug-drug interaction patterns
   - Support geriatric/polypharmacy screening
   - Support renal-risk screening
   - Support bleeding/fall/CNS/QT/serotonin risks
   - Support CYP and transporter interaction patterns
   - Produce explainable alerts

   IMPORTANT:
   This is a RESEARCH PROTOTYPE.
   It must not replace pharmacist/clinician assessment.

   Evidence architecture:
   - FDA drug-interaction / labeling principles
   - NLM RxNorm / RxClass normalization
   - AGS Beers Criteria 2023
   - STOPP/START version 3
   ============================================================ */


/* ============================================================
   ENGINE VERSION
============================================================ */

const PHARMACY_RULE_ENGINE_VERSION = "2.0.0";


/* ============================================================
   RISK LEVELS
============================================================ */

const RISK_LEVELS = {
    LOW: "LOW",
    MODERATE: "MODERATE",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL"
};


/* ============================================================
   NORMALIZED CLINICAL CLASSES
============================================================ */

const DRUG_CLASSES = {

    ANTICOAGULANT: [
        "warfarin",
        "apixaban",
        "rivaroxaban",
        "dabigatran",
        "edoxaban",
        "heparin",
        "enoxaparin"
    ],

    ANTIPLATELET: [
        "aspirin",
        "clopidogrel",
        "prasugrel",
        "ticagrelor"
    ],

    NSAID: [
        "ibuprofen",
        "naproxen",
        "diclofenac",
        "indomethacin",
        "ketorolac",
        "meloxicam",
        "celecoxib",
        "piroxicam",
        "ketoprofen"
    ],

    OPIOID: [
        "morphine",
        "codeine",
        "tramadol",
        "oxycodone",
        "hydrocodone",
        "fentanyl",
        "methadone",
        "buprenorphine"
    ],

    BENZODIAZEPINE: [
        "diazepam",
        "lorazepam",
        "alprazolam",
        "clonazepam",
        "midazolam",
        "temazepam",
        "oxazepam"
    ],

    SSRI: [
        "fluoxetine",
        "sertraline",
        "paroxetine",
        "citalopram",
        "escitalopram",
        "fluvoxamine"
    ],

    SNRI: [
        "venlafaxine",
        "duloxetine",
        "desvenlafaxine",
        "milnacipran"
    ],

    TCA: [
        "amitriptyline",
        "imipramine",
        "nortriptyline",
        "clomipramine",
        "doxepin"
    ],

    ANTIPSYCHOTIC: [
        "haloperidol",
        "risperidone",
        "quetiapine",
        "olanzapine",
        "clozapine",
        "chlorpromazine",
        "ziprasidone",
        "aripiprazole"
    ],

    ANTICHOLINERGIC: [
        "oxybutynin",
        "tolterodine",
        "solifenacin",
        "atropine",
        "scopolamine",
        "diphenhydramine",
        "chlorpheniramine",
        "promethazine"
    ],

    ACE_INHIBITOR: [
        "enalapril",
        "lisinopril",
        "ramipril",
        "captopril",
        "perindopril",
        "benazepril"
    ],

    ARB: [
        "losartan",
        "valsartan",
        "irbesartan",
        "candesartan",
        "telmisartan",
        "olmesartan"
    ],

    DIURETIC_LOOP: [
        "furosemide",
        "bumetanide",
        "torsemide"
    ],

    DIURETIC_THIAZIDE: [
        "hydrochlorothiazide",
        "chlorthalidone",
        "indapamide",
        "metolazone"
    ],

    POTASSIUM_SPARING: [
        "spironolactone",
        "eplerenone",
        "amiloride",
        "triamterene"
    ],

    BETA_BLOCKER: [
        "atenolol",
        "metoprolol",
        "bisoprolol",
        "carvedilol",
        "propranolol",
        "nebivolol"
    ],

    CALCIUM_CHANNEL_BLOCKER: [
        "amlodipine",
        "verapamil",
        "diltiazem",
        "nifedipine",
        "felodipine"
    ],

    STATIN: [
        "simvastatin",
        "atorvastatin",
        "lovastatin",
        "rosuvastatin",
        "pravastatin",
        "fluvastatin",
        "pitavastatin"
    ],

    SULFONYLUREA: [
        "glibenclamide",
        "glyburide",
        "glimepiride",
        "gliclazide",
        "glipizide"
    ],

    ANTIDIABETIC: [
        "metformin",
        "insulin",
        "glibenclamide",
        "glyburide",
        "glimepiride",
        "gliclazide",
        "glipizide",
        "empagliflozin",
        "dapagliflozin",
        "canagliflozin",
        "sitagliptin",
        "linagliptin",
        "saxagliptin",
        "semaglutide"
    ],

    PPI: [
        "omeprazole",
        "esomeprazole",
        "pantoprazole",
        "lansoprazole",
        "rabeprazole"
    ],

    H2_BLOCKER: [
        "cimetidine",
        "famotidine",
        "nizatidine"
    ],

    MACROLIDE: [
        "clarithromycin",
        "erythromycin",
        "azithromycin"
    ],

    FLUOROQUINOLONE: [
        "ciprofloxacin",
        "levofloxacin",
        "moxifloxacin",
        "ofloxacin"
    ],

    TETRACYCLINE: [
        "doxycycline",
        "tetracycline",
        "minocycline"
    ],

    AMINOGLYCOSIDE: [
        "gentamicin",
        "amikacin",
        "tobramycin",
        "streptomycin"
    ],

    ANTICONVULSANT: [
        "carbamazepine",
        "phenytoin",
        "phenobarbital",
        "valproate",
        "valproic acid",
        "lamotrigine",
        "levetiracetam"
    ],

    SEDATING_ANTIHISTAMINE: [
        "diphenhydramine",
        "chlorpheniramine",
        "promethazine",
        "hydroxyzine",
        "meclizine"
    ],

    CORTICOSTEROID: [
        "prednisone",
        "prednisolone",
        "dexamethasone",
        "hydrocortisone",
        "methylprednisolone"
    ],

    QT_RISK_DRUG: [
        "amiodarone",
        "sotalol",
        "quinidine",
        "haloperidol",
        "citalopram",
        "escitalopram",
        "azithromycin",
        "clarithromycin",
        "moxifloxacin",
        "ondansetron"
    ]
};


/* ============================================================
   NORMALIZATION
============================================================ */

function normalizeDrugName(name) {

    return String(name || "")
        .toLowerCase()
        .trim()
        .replace(/\([^)]*\)/g, "")
        .replace(/\s+/g, " ");

}


/* ============================================================
   CLASS DETECTION
============================================================ */

function getLocalDrugClasses(drugName) {

    const normalized = normalizeDrugName(drugName);

    const classes = [];

    for (const [drugClass, drugs] of Object.entries(DRUG_CLASSES)) {

        if (
            drugs.some(drug =>
                normalized === drug ||
                normalized.includes(drug)
            )
        ) {
            classes.push(drugClass);
        }

    }

    return classes;
}


/* ============================================================
   CLASS HELPERS
============================================================ */

function hasClass(drug, className) {

    return getLocalDrugClasses(drug).includes(className);

}


function hasAnyClass(drug, classNames) {

    return classNames.some(
        className => hasClass(drug, className)
    );

}


/* ============================================================
   RULE BUILDER
============================================================ */

function createAlert({

    id,
    severity,
    category,
    title,
    drugs,
    mechanism,
    clinicalEffect,
    action,
    source = "Clinical pharmacy rule engine",
    confidence = "Rule-based"

}) {

    return {

        id,

        severity,

        category,

        title,

        drugs,

        mechanism,

        clinicalEffect,

        action,

        source,

        confidence,

        timestamp: new Date().toISOString()

    };

}


/* ============================================================
   RULES
============================================================ */

const PHARMACY_RULES = [

    /* --------------------------------------------------------
       ANTICOAGULATION + NSAID
    -------------------------------------------------------- */

    {

        id: "BLEED-001",

        category: "Bleeding",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            return meds.some(
                drug => hasClass(drug, "ANTICOAGULANT")
            )
            &&
            meds.some(
                drug => hasClass(drug, "NSAID")
            );

        },

        build(meds) {

            const anticoagulants =
                meds.filter(
                    d => hasClass(d, "ANTICOAGULANT")
                );

            const nsaids =
                meds.filter(
                    d => hasClass(d, "NSAID")
                );

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Anticoagulant + NSAID bleeding risk",

                drugs:
                    [...anticoagulants, ...nsaids],

                mechanism:
                    "Additive impairment of hemostasis with potential gastrointestinal and systemic bleeding risk.",

                clinicalEffect:
                    "Potential increase in clinically significant bleeding.",

                action:
                    "Verify indication, consider safer alternatives where appropriate, and assess bleeding risk and monitoring requirements.",

                source:
                    "FDA labeling / clinical pharmacology principles"

            });

        }

    },


    /* --------------------------------------------------------
       ANTICOAGULANT + ANTIPLATELET
    -------------------------------------------------------- */

    {

        id: "BLEED-002",

        category: "Bleeding",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            return meds.some(
                d => hasClass(d, "ANTICOAGULANT")
            )
            &&
            meds.some(
                d => hasClass(d, "ANTIPLATELET")
            );

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Anticoagulant + antiplatelet combination",

                drugs: meds.filter(
                    d =>
                        hasAnyClass(
                            d,
                            [
                                "ANTICOAGULANT",
                                "ANTIPLATELET"
                            ]
                        )
                ),

                mechanism:
                    "Combined anticoagulant and platelet-inhibitory effects.",

                clinicalEffect:
                    "Increased bleeding risk.",

                action:
                    "Confirm that combined therapy has a documented indication and review bleeding-risk factors.",

                source:
                    "Clinical medication-safety rule"

            });

        }

    },


    /* --------------------------------------------------------
       MULTIPLE CNS DEPRESSANTS
    -------------------------------------------------------- */

    {

        id: "CNS-001",

        category: "CNS Depression",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            const opioids =
                meds.filter(
                    d => hasClass(d, "OPIOID")
                );

            const benzodiazepines =
                meds.filter(
                    d => hasClass(d, "BENZODIAZEPINE")
                );

            return opioids.length > 0 &&
                   benzodiazepines.length > 0;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Opioid + benzodiazepine CNS-depressant combination",

                drugs:
                    meds.filter(
                        d =>
                            hasAnyClass(
                                d,
                                [
                                    "OPIOID",
                                    "BENZODIAZEPINE"
                                ]
                            )
                    ),

                mechanism:
                    "Additive central nervous system depressant effects.",

                clinicalEffect:
                    "Potential excessive sedation and respiratory depression.",

                action:
                    "Verify indication and necessity of combined therapy and assess sedation and respiratory-risk factors.",

                source:
                    "Medication safety rule"

            });

        }

    },


    /* --------------------------------------------------------
       MULTIPLE SEROTONERGIC DRUGS
    -------------------------------------------------------- */

    {

        id: "SEROTONIN-001",

        category: "Serotonergic toxicity",

        severity: RISK_LEVELS.MODERATE,

        match(meds) {

            const serotonergic =
                meds.filter(
                    d =>
                        hasAnyClass(
                            d,
                            [
                                "SSRI",
                                "SNRI",
                                "TCA"
                            ]
                        )
                );

            const opioids =
                meds.filter(
                    d =>
                        hasClass(d, "OPIOID")
                );

            return serotonergic.length >= 2 ||
                   (
                       serotonergic.length > 0 &&
                       opioids.some(
                           d =>
                               normalizeDrugName(d)
                               === "tramadol"
                       )
                   );

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Multiple serotonergic medicines",

                drugs:
                    meds.filter(
                        d =>
                            hasAnyClass(
                                d,
                                [
                                    "SSRI",
                                    "SNRI",
                                    "TCA",
                                    "OPIOID"
                                ]
                            )
                    ),

                mechanism:
                    "Potential additive serotonergic activity.",

                clinicalEffect:
                    "Potential serotonin toxicity depending on the specific agents and exposure.",

                action:
                    "Review the complete serotonergic regimen and monitor for clinically relevant toxicity.",

                source:
                    "Clinical pharmacology interaction rule"

            });

        }

    },


    /* --------------------------------------------------------
       QT PROLONGATION
    -------------------------------------------------------- */

    {

        id: "QT-001",

        category: "Cardiac electrophysiology",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            const qtDrugs =
                meds.filter(
                    d =>
                        hasClass(d, "QT_RISK_DRUG")
                );

            return qtDrugs.length >= 2;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Multiple QT-risk medicines",

                drugs:
                    meds.filter(
                        d =>
                            hasClass(d, "QT_RISK_DRUG")
                    ),

                mechanism:
                    "Potential additive QT-interval prolongation.",

                clinicalEffect:
                    "Potential increased risk of clinically significant ventricular arrhythmia in susceptible patients.",

                action:
                    "Verify the combination and consider patient-specific ECG and electrolyte risk factors.",

                source:
                    "Clinical electrophysiology safety rule"

            });

        }

    },


    /* --------------------------------------------------------
       RAAS + POTASSIUM-SPARING
    -------------------------------------------------------- */

    {

        id: "K-001",

        category: "Electrolyte disturbance",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            const raas =
                meds.some(
                    d =>
                        hasAnyClass(
                            d,
                            [
                                "ACE_INHIBITOR",
                                "ARB"
                            ]
                        )
                );

            const potassiumSparing =
                meds.some(
                    d =>
                        hasClass(
                            d,
                            "POTASSIUM_SPARING"
                        )
                );

            return raas && potassiumSparing;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "RAAS inhibitor + potassium-sparing diuretic",

                drugs:
                    meds.filter(
                        d =>
                            hasAnyClass(
                                d,
                                [
                                    "ACE_INHIBITOR",
                                    "ARB",
                                    "POTASSIUM_SPARING"
                                ]
                            )
                    ),

                mechanism:
                    "Combined effects can reduce renal potassium excretion.",

                clinicalEffect:
                    "Potential hyperkalemia, particularly in susceptible patients.",

                action:
                    "Review renal function and potassium monitoring requirements.",

                source:
                    "Clinical pharmacology rule"

            });

        }

    },


    /* --------------------------------------------------------
       ACE INHIBITOR + ARB
    -------------------------------------------------------- */

    {

        id: "RAAS-001",

        category: "Therapeutic duplication",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            return meds.some(
                d =>
                    hasClass(d, "ACE_INHIBITOR")
            )
            &&
            meds.some(
                d =>
                    hasClass(d, "ARB")
            );

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "ACE inhibitor + ARB combination",

                drugs:
                    meds.filter(
                        d =>
                            hasAnyClass(
                                d,
                                [
                                    "ACE_INHIBITOR",
                                    "ARB"
                                ]
                            )
                    ),

                mechanism:
                    "Dual renin-angiotensin system blockade.",

                clinicalEffect:
                    "Potential increased risk of renal dysfunction and electrolyte abnormalities.",

                action:
                    "Verify indication and therapeutic rationale.",

                source:
                    "Medication safety rule"

            });

        }

    },


    /* --------------------------------------------------------
       NSAID + ACE/ARB + DIURETIC
    -------------------------------------------------------- */

    {

        id: "RENAL-001",

        category: "Renal safety",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            const nsaid =
                meds.some(
                    d =>
                        hasClass(d, "NSAID")
                );

            const raas =
                meds.some(
                    d =>
                        hasAnyClass(
                            d,
                            [
                                "ACE_INHIBITOR",
                                "ARB"
                            ]
                        )
                );

            const diuretic =
                meds.some(
                    d =>
                        hasAnyClass(
                            d,
                            [
                                "DIURETIC_LOOP",
                                "DIURETIC_THIAZIDE",
                                "POTASSIUM_SPARING"
                            ]
                        )
                );

            return nsaid && raas && diuretic;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "NSAID + RAAS blocker + diuretic renal-risk combination",

                drugs: meds.filter(
                    d =>
                        hasAnyClass(
                            d,
                            [
                                "NSAID",
                                "ACE_INHIBITOR",
                                "ARB",
                                "DIURETIC_LOOP",
                                "DIURETIC_THIAZIDE",
                                "POTASSIUM_SPARING"
                            ]
                        )
                ),

                mechanism:
                    "Combined effects can compromise renal perfusion and volume-dependent renal function.",

                clinicalEffect:
                    "Potential acute kidney injury, particularly in susceptible patients.",

                action:
                    "Review hydration status, renal function and therapeutic necessity.",

                source:
                    "Clinical medication-safety rule"

            });

        }

    },


    /* --------------------------------------------------------
       MULTIPLE NSAIDS
    -------------------------------------------------------- */

    {

        id: "NSAID-001",

        category: "Therapeutic duplication",

        severity: RISK_LEVELS.MODERATE,

        match(meds) {

            return meds.filter(
                d =>
                    hasClass(d, "NSAID")
            ).length >= 2;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Multiple NSAIDs detected",

                drugs:
                    meds.filter(
                        d =>
                            hasClass(d, "NSAID")
                    ),

                mechanism:
                    "Duplicate pharmacologic activity.",

                clinicalEffect:
                    "May increase adverse-effect burden without providing proportional therapeutic benefit.",

                action:
                    "Verify whether more than one NSAID is intentionally prescribed.",

                source:
                    "Therapeutic duplication rule"

            });

        }

    },


    /* --------------------------------------------------------
       MULTIPLE ANTICHOLINERGICS
    -------------------------------------------------------- */

    {

        id: "GERI-001",

        category: "Geriatric safety",

        severity: RISK_LEVELS.MODERATE,

        match(meds, patient) {

            if (!patient || patient.age < 65) {
                return false;
            }

            return meds.filter(
                d =>
                    hasClass(d, "ANTICHOLINERGIC")
            ).length >= 2;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Multiple anticholinergic medicines in older adult",

                drugs:
                    meds.filter(
                        d =>
                            hasClass(
                                d,
                                "ANTICHOLINERGIC"
                            )
                    ),

                mechanism:
                    "Additive anticholinergic burden.",

                clinicalEffect:
                    "Potential cognitive, urinary, gastrointestinal and other anticholinergic adverse effects.",

                action:
                    "Review cumulative anticholinergic burden and necessity of each medicine.",

                source:
                    "Geriatric medication-safety rule"

            });

        }

    },


    /* --------------------------------------------------------
       OLDER ADULT + BENZODIAZEPINE
    -------------------------------------------------------- */

    {

        id: "GERI-002",

        category: "Geriatric safety",

        severity: RISK_LEVELS.MODERATE,

        match(meds, patient) {

            return patient &&
                   patient.age >= 65 &&
                   meds.some(
                       d =>
                           hasClass(
                               d,
                               "BENZODIAZEPINE"
                           )
                   );

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Benzodiazepine detected in older adult",

                drugs:
                    meds.filter(
                        d =>
                            hasClass(
                                d,
                                "BENZODIAZEPINE"
                            )
                    ),

                mechanism:
                    "Older adults may have increased sensitivity and slower clearance of benzodiazepines.",

                clinicalEffect:
                    "Potential increased sedation and fall-related risk.",

                action:
                    "Review indication, duration and patient-specific risk factors.",

                source:
                    "AGS Beers Criteria 2023"

            });

        }

    },


    /* --------------------------------------------------------
       OLDER ADULT + SEDATING ANTIHISTAMINE
    -------------------------------------------------------- */

    {

        id: "GERI-003",

        category: "Geriatric safety",

        severity: RISK_LEVELS.MODERATE,

        match(meds, patient) {

            return patient &&
                   patient.age >= 65 &&
                   meds.some(
                       d =>
                           hasClass(
                               d,
                               "SEDATING_ANTIHISTAMINE"
                           )
                   );

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Sedating antihistamine detected in older adult",

                drugs:
                    meds.filter(
                        d =>
                            hasClass(
                                d,
                                "SEDATING_ANTIHISTAMINE"
                            )
                    ),

                mechanism:
                    "Many first-generation antihistamines have anticholinergic and sedating properties.",

                clinicalEffect:
                    "Potential cognitive impairment, sedation and fall-related harm.",

                action:
                    "Review necessity and consider patient-specific safer alternatives where appropriate.",

                source:
                    "AGS Beers Criteria 2023"

            });

        }

    },


    /* --------------------------------------------------------
       OLDER ADULT + OPIOID
    -------------------------------------------------------- */

    {

        id: "GERI-004",

        category: "Geriatric safety",

        severity: RISK_LEVELS.MODERATE,

        match(meds, patient) {

            return patient &&
                   patient.age >= 65 &&
                   meds.some(
                       d =>
                           hasClass(
                               d,
                               "OPIOID"
                           )
                   );

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Opioid therapy in older adult requires enhanced review",

                drugs:
                    meds.filter(
                        d =>
                            hasClass(
                                d,
                                "OPIOID"
                            )
                    ),

                mechanism:
                    "Older adults may be more susceptible to opioid-related adverse effects.",

                clinicalEffect:
                    "Potential sedation, falls, constipation and other adverse outcomes.",

                action:
                    "Review indication, duration, concurrent CNS depressants and patient-specific risk factors.",

                source:
                    "Geriatric medication-safety rule"

            });

        }

    },


    /* --------------------------------------------------------
       HIGH POLYPHARMACY BURDEN
    -------------------------------------------------------- */

    {

        id: "POLY-001",

        category: "Polypharmacy",

        severity: RISK_LEVELS.MODERATE,

        match(meds) {

            return meds.length >= 5;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Polypharmacy threshold reached",

                drugs:
                    meds,

                mechanism:
                    "Increasing medication count increases opportunities for drug interactions and medication-related problems.",

                clinicalEffect:
                    "Higher medication-review complexity.",

                action:
                    "Perform comprehensive medication reconciliation and assess indication, effectiveness, safety and adherence.",

                source:
                    "Polypharmacy screening rule"

            });

        }

    },


    /* --------------------------------------------------------
       VERY HIGH MEDICATION BURDEN
    -------------------------------------------------------- */

    {

        id: "POLY-002",

        category: "Polypharmacy",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            return meds.length >= 10;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "High medication burden",

                drugs:
                    meds,

                mechanism:
                    "Large medication burden increases the complexity of medication management.",

                clinicalEffect:
                    "Higher probability of clinically relevant medication-related problems.",

                action:
                    "Prioritize structured medication reconciliation and pharmacist-led review.",

                source:
                    "Polypharmacy risk rule"

            });

        }

    },


    /* --------------------------------------------------------
       STATIN + MACROLIDE
    -------------------------------------------------------- */

    {

        id: "CYP-001",

        category: "Pharmacokinetic interaction",

        severity: RISK_LEVELS.HIGH,

        match(meds) {

            const statin =
                meds.some(
                    d =>
                        hasClass(d, "STATIN")
                );

            const macrolide =
                meds.some(
                    d =>
                        hasClass(d, "MACROLIDE")
                );

            return statin && macrolide;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Statin + macrolide interaction requires review",

                drugs:
                    meds.filter(
                        d =>
                            hasAnyClass(
                                d,
                                [
                                    "STATIN",
                                    "MACROLIDE"
                                ]
                            )
                    ),

                mechanism:
                    "Some macrolides inhibit metabolic/transport pathways relevant to particular statins.",

                clinicalEffect:
                    "Potentially increased statin exposure and muscle toxicity depending on the specific agents.",

                action:
                    "Identify the exact statin/macrolide pair and verify the product-specific interaction guidance.",

                source:
                    "FDA CYP/transport interaction framework"

            });

        }

    },


    /* --------------------------------------------------------
       CYP INDUCER + MULTIPLE MEDICATIONS
    -------------------------------------------------------- */

    {

        id: "CYP-002",

        category: "Pharmacokinetic interaction",

        severity: RISK_LEVELS.MODERATE,

        match(meds) {

            return meds.some(
                d =>
                    [
                        "carbamazepine",
                        "phenytoin",
                        "phenobarbital",
                        "rifampicin",
                        "rifampin"
                    ].includes(
                        normalizeDrugName(d)
                    )
            )
            &&
            meds.length >= 2;

        },

        build(meds) {

            return createAlert({

                id: this.id,

                severity: this.severity,

                category: this.category,

                title:
                    "Potential enzyme-induction interaction",

                drugs:
                    meds,

                mechanism:
                    "Certain medicines can increase metabolic activity and reduce exposure of susceptible substrates.",

                clinicalEffect:
                    "Potential reduction in efficacy of affected medicines.",

                action:
                    "Identify susceptible substrates and verify product-specific interaction information.",

                source:
                    "FDA CYP interaction framework"

            });

        }

    }

];


/* ============================================================
   ANALYZE MEDICATION PROFILE
============================================================ */

function runPharmacyRules(medications = [], patient = {}) {

    const meds = medications
        .map(normalizeDrugName)
        .filter(Boolean);

    const alerts = [];

    for (const rule of PHARMACY_RULES) {

        try {

            if (rule.match(meds, patient)) {

                alerts.push(
                    rule.build(meds, patient)
                );

            }

        } catch (error) {

            console.error(
                "Pharmacy rule failed:",
                rule.id,
                error
            );

        }

    }

    return alerts;

}


/* ============================================================
   DRUG PROFILE
============================================================ */

function getDrugProfile(drug) {

    return {

        name: drug,

        normalized:
            normalizeDrugName(drug),

        localClasses:
            getLocalDrugClasses(drug)

    };

}


/* ============================================================
   EXPORT
============================================================ */

window.PharmacyRules = {

    version:
        PHARMACY_RULE_ENGINE_VERSION,

    riskLevels:
        RISK_LEVELS,

    classes:
        DRUG_CLASSES,

    rules:
        PHARMACY_RULES,

    normalizeDrugName,

    getDrugProfile,

    run:
        runPharmacyRules

};
