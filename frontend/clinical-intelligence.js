/* ============================================================
   POLYPHARM ADE CLINICAL SUPPORT
   CLINICAL INTELLIGENCE ENGINE
   ============================================================

   Responsibilities:
   - Collect patient information
   - Collect medication list
   - Normalize medication names
   - Query NLM RxNorm when available
   - Run local pharmacy rules
   - Calculate explainable risk summary
   - Render clinical alerts
   - Keep clinical logic outside the UI

   IMPORTANT:
   Research prototype only.
   Clinical decisions require qualified healthcare-professional review.
============================================================ */


/* ============================================================
   CONFIGURATION
============================================================ */

const CLINICAL_CONFIG = {

    rxNormBase:
        "https://rxnav.nlm.nih.gov/REST",

    minimumMedicationCount:
        1,

    requestTimeout:
        8000

};


/* ============================================================
   STATE
============================================================ */

const ClinicalState = {

    medications: [],

    patient: {

        age: null,

        sex: "",

        renalStatus: "unknown",

        hepaticStatus: "unknown",

        conditions: [],

        allergies: []

    },

    alerts: [],

    normalizedDrugs: []

};


/* ============================================================
   DOM HELPERS
============================================================ */

function getElement(id) {

    return document.getElementById(id);

}


function safeText(value) {

    return String(value ?? "")
        .replace(/[&<>"']/g, char => {

            const map = {

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"

            };

            return map[char];

        });

}


/* ============================================================
   MEDICATION INPUT
============================================================ */

function getMedicationInput() {

    const input =
        getElement("medications");

    if (!input) {
        return [];
    }

    return input.value
        .split(/[\n,;]+/)
        .map(
            drug =>
                PharmacyRules.normalizeDrugName(drug)
        )
        .filter(Boolean);

}


/* ============================================================
   PATIENT INPUT
============================================================ */

function getPatientData() {

    const ageElement =
        getElement("patientAge");

    const renalElement =
        getElement("renalStatus");

    const hepaticElement =
        getElement("hepaticStatus");

    const conditionElement =
        getElement("conditions");

    return {

        age:
            ageElement &&
            ageElement.value
                ? Number(ageElement.value)
                : null,

        renalStatus:
            renalElement
                ? renalElement.value
                : "unknown",

        hepaticStatus:
            hepaticElement
                ? hepaticElement.value
                : "unknown",

        conditions:
            conditionElement
                ? conditionElement.value
                    .split(",")
                    .map(x => x.trim())
                    .filter(Boolean)
                : []

    };

}


/* ============================================================
   RXNORM LOOKUP
============================================================ */

async function rxNormLookup(drugName) {

    const encoded =
        encodeURIComponent(drugName);

    const url =
        `${CLINICAL_CONFIG.rxNormBase}/rxcui.json?name=${encoded}&search=2`;

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () =>
                controller.abort(),
            CLINICAL_CONFIG.requestTimeout
        );

    try {

        const response =
            await fetch(
                url,
                {
                    signal:
                        controller.signal
                }
            );

        if (!response.ok) {
            throw new Error(
                `RxNorm HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        const rxcui =
            data?.idGroup?.rxnormId?.[0];

        return {

            input:
                drugName,

            rxcui:
                rxcui || null,

            normalized:
                drugName

        };

    } catch (error) {

        console.warn(
            "RxNorm lookup unavailable:",
            drugName,
            error
        );

        return {

            input:
                drugName,

            rxcui:
                null,

            normalized:
                drugName

        };

    } finally {

        clearTimeout(timeout);

    }

}


/* ============================================================
   NORMALIZE ALL DRUGS
============================================================ */

async function normalizeMedicationList(medications) {

    const results = [];

    for (const medication of medications) {

        const result =
            await rxNormLookup(
                medication
            );

        results.push(result);

    }

    return results;

}


/* ============================================================
   CLASSIFY LOCALLY
============================================================ */

function classifyMedication(drug) {

    const profile =
        PharmacyRules.getDrugProfile(
            drug
        );

    return {

        ...profile,

        classes:
            profile.localClasses

    };

}


/* ============================================================
   RISK SCORE
============================================================ */

function calculateRiskScore(alerts) {

    let score = 0;

    for (const alert of alerts) {

        switch (alert.severity) {

            case "CRITICAL":
                score += 40;
                break;

            case "HIGH":
                score += 25;
                break;

            case "MODERATE":
                score += 12;
                break;

            case "LOW":
                score += 4;
                break;

        }

    }

    return Math.min(
        100,
        score
    );

}


/* ============================================================
   RISK LABEL
============================================================ */

function getRiskLabel(score) {

    if (score >= 75) {
        return "CRITICAL";
    }

    if (score >= 50) {
        return "HIGH";
    }

    if (score >= 20) {
        return "MODERATE";
    }

    return "LOW";

}


/* ============================================================
   RISK COLOR CLASS
============================================================ */

function getRiskClass(severity) {

    return {

        CRITICAL: "risk-critical",

        HIGH: "risk-high",

        MODERATE: "risk-moderate",

        LOW: "risk-low"

    }[severity] || "risk-low";

}


/* ============================================================
   RENDER ALERT
============================================================ */

function renderAlert(alert) {

    const drugs =
        alert.drugs
            .map(
                drug =>
                    `<span class="alert-drug">
                        ${safeText(drug)}
                    </span>`
            )
            .join("");

    return `

        <article class="clinical-alert ${getRiskClass(alert.severity)}">

            <div class="alert-header">

                <span class="alert-severity">
                    ${safeText(alert.severity)}
                </span>

                <span class="alert-category">
                    ${safeText(alert.category)}
                </span>

            </div>


            <h3>
                ${safeText(alert.title)}
            </h3>


            <div class="alert-drugs">
                ${drugs}
            </div>


            <div class="alert-detail">

                <strong>
                    Mechanism
                </strong>

                <p>
                    ${safeText(alert.mechanism)}
                </p>

            </div>


            <div class="alert-detail">

                <strong>
                    Potential clinical effect
                </strong>

                <p>
                    ${safeText(alert.clinicalEffect)}
                </p>

            </div>


            <div class="alert-action">

                <strong>
                    Suggested review
                </strong>

                <p>
                    ${safeText(alert.action)}
                </p>

            </div>


            <div class="alert-source">

                Source:
                ${safeText(alert.source)}

            </div>

        </article>

    `;

}


/* ============================================================
   RENDER RESULTS
============================================================ */

function renderResults(alerts, medications) {

    const results =
        getElement("clinicalResults");

    const riskScoreElement =
        getElement("riskScore");

    const riskLabelElement =
        getElement("riskLabel");

    const medicationCountElement =
        getElement("medicationCount");

    if (medicationCountElement) {

        medicationCountElement.textContent =
            medications.length;

    }


    const score =
        calculateRiskScore(
            alerts
        );

    const label =
        getRiskLabel(
            score
        );


    if (riskScoreElement) {

        riskScoreElement.textContent =
            score;

    }


    if (riskLabelElement) {

        riskLabelElement.textContent =
            label;

    }


    if (!results) {
        return;
    }


    if (!alerts.length) {

        results.innerHTML = `

            <div class="no-alerts">

                <div class="no-alert-icon">
                    ✓
                </div>

                <h3>
                    No configured alerts triggered
                </h3>

                <p>
                    No rule in the current prototype
                    matched the submitted medication profile.
                </p>

                <small>
                    This does not prove that the medication
                    regimen is clinically risk-free.
                </small>

            </div>

        `;

        return;

    }


    results.innerHTML =
        alerts
            .map(renderAlert)
            .join("");

}


/* ============================================================
   RENDER MEDICATION PROFILE
============================================================ */

function renderMedicationProfile(
    medications
) {

    const container =
        getElement("medicationProfile");

    if (!container) {
        return;
    }


    container.innerHTML =
        medications
            .map(drug => {

                const profile =
                    classifyMedication(
                        drug
                    );

                return `

                    <div class="medication-chip">

                        <strong>
                            ${safeText(drug)}
                        </strong>

                        ${
                            profile.classes.length
                            ?
                            `<small>
                                ${safeText(
                                    profile.classes.join(" • ")
                                )}
                            </small>`
                            :
                            `<small>
                                Class not locally mapped
                            </small>`
                        }

                    </div>

                `;

            })
            .join("");

}


/* ============================================================
   RUN ANALYSIS
============================================================ */

async function analyzeMedicationProfile() {

    const medications =
        getMedicationInput();

    const patient =
        getPatientData();


    if (
        medications.length <
        CLINICAL_CONFIG.minimumMedicationCount
    ) {

        alert(
            "Please enter at least one medication."
        );

        return;

    }


    ClinicalState.medications =
        medications;

    ClinicalState.patient =
        patient;


    setAnalysisStatus(
        "Analyzing medication profile..."
    );


    renderMedicationProfile(
        medications
    );


    /* --------------------------------------------------------
       RxNorm normalization
    -------------------------------------------------------- */

    ClinicalState.normalizedDrugs =
        await normalizeMedicationList(
            medications
        );


    /* --------------------------------------------------------
       Local pharmacy rules
    -------------------------------------------------------- */

    const alerts =
        PharmacyRules.run(
            medications,
            patient
        );


    ClinicalState.alerts =
        alerts;


    renderResults(
        alerts,
        medications
    );


    updateStatistics(
        alerts,
        medications
    );


    setAnalysisStatus(
        "Analysis complete"
    );

}


/* ============================================================
   STATISTICS
============================================================ */

function updateStatistics(
    alerts,
    medications
) {

    const high =
        alerts.filter(
            a =>
                a.severity === "HIGH" ||
                a.severity === "CRITICAL"
        ).length;

    const moderate =
        alerts.filter(
            a =>
                a.severity === "MODERATE"
        ).length;


    const totalElement =
        getElement("alertCount");

    const highElement =
        getElement("highRiskCount");

    const moderateElement =
        getElement("moderateRiskCount");


    if (totalElement) {

        totalElement.textContent =
            alerts.length;

    }

    if (highElement) {

        highElement.textContent =
            high;

    }

    if (moderateElement) {

        moderateElement.textContent =
            moderate;

    }

}


/* ============================================================
   STATUS
============================================================ */

function setAnalysisStatus(
    message
) {

    const status =
        getElement("analysisStatus");

    if (status) {

        status.textContent =
            message;

    }

}


/* ============================================================
   CLEAR
============================================================ */

function clearClinicalAnalysis() {

    const medications =
        getElement("medications");

    const patientAge =
        getElement("patientAge");

    const renalStatus =
        getElement("renalStatus");

    const hepaticStatus =
        getElement("hepaticStatus");

    const conditions =
        getElement("conditions");


    if (medications) {
        medications.value = "";
    }

    if (patientAge) {
        patientAge.value = "";
    }

    if (renalStatus) {
        renalStatus.value = "unknown";
    }

    if (hepaticStatus) {
        hepaticStatus.value = "unknown";
    }

    if (conditions) {
        conditions.value = "";
    }


    ClinicalState.medications =
        [];

    ClinicalState.alerts =
        [];

    ClinicalState.normalizedDrugs =
        [];


    renderResults(
        [],
        []
    );

    renderMedicationProfile(
        []
    );


    updateStatistics(
        [],
        []
    );


    setAnalysisStatus(
        "Ready for analysis"
    );

}


/* ============================================================
   DEMO PROFILE
============================================================ */

function loadDemoPatient() {

    const age =
        getElement("patientAge");

    const medications =
        getElement("medications");

    const renal =
        getElement("renalStatus");

    const hepatic =
        getElement("hepaticStatus");

    const conditions =
        getElement("conditions");


    if (age) {

        age.value =
            "74";

    }


    if (renal) {

        renal.value =
            "moderate";

    }


    if (hepatic) {

        hepatic.value =
            "normal";

    }


    if (conditions) {

        conditions.value =
            "hypertension, type 2 diabetes";

    }


    if (medications) {

        medications.value = [

            "warfarin",
            "ibuprofen",
            "lisinopril",
            "spironolactone",
            "diazepam",
            "sertraline",
            "amlodipine"

        ].join("\n");

    }

}


/* ============================================================
   BUTTON EVENTS
============================================================ */

function initializeClinicalUI() {

    const analyzeButton =
        getElement("analyzeButton");

    const clearButton =
        getElement("clearButton");

    const demoButton =
        getElement("demoButton");


    if (analyzeButton) {

        analyzeButton.addEventListener(
            "click",
            analyzeMedicationProfile
        );

    }


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearClinicalAnalysis
        );

    }


    if (demoButton) {

        demoButton.addEventListener(
            "click",
            () => {

                loadDemoPatient();

                analyzeMedicationProfile();

            }
        );

    }

}


/* ============================================================
   KEYBOARD SHORTCUT
============================================================ */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.ctrlKey &&
            event.key === "Enter"
        ) {

            analyzeMedicationProfile();

        }

    }
);


/* ============================================================
   START
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeClinicalUI();

        setAnalysisStatus(
            "Ready for analysis"
        );

    }
);


/* ============================================================
   PUBLIC API
============================================================ */

window.ClinicalIntelligence = {

    analyze:
        analyzeMedicationProfile,

    clear:
        clearClinicalAnalysis,

    demo:
        loadDemoPatient,

    state:
        ClinicalState

};
