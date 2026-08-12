(function () {
  "use strict";

  var root = document.querySelector("[data-dfq-contact]");
  var form = document.querySelector("[data-dfq-form]");
  if (!root || !form) return;
  if (root.__dfqLeadIntakeReady) return;
  root.__dfqLeadIntakeReady = true;

  var flow = root.querySelector("[data-dfq-flow]");
  var success = root.querySelector("[data-dfq-success]");
  var alertBox = root.querySelector("[data-dfq-alert]");
  var primary = root.querySelector("[data-dfq-primary]");
  var primaryText = root.querySelector("[data-dfq-primary-text]");
  var back = root.querySelector("[data-dfq-back]");
  var steps = Array.prototype.slice.call(root.querySelectorAll("[data-dfq-step]"));
  var progress = root.querySelector("[data-dfq-progress]");
  var groups = Array.prototype.slice.call(root.querySelectorAll("[data-dfq-group]"));
  var startedAt = Date.now();
  var currentStep = 0;
  var submissionId = null;
  var isSubmitting = false;
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var projectTypes = ["Sito vetrina", "E-commerce", "Landing page", "Altro progetto"];
  var goals = ["Ricevere più contatti", "Vendere online", "Rafforzare il brand", "Lanciare un nuovo progetto"];
  var timelines = ["Il prima possibile", "Entro 1-2 mesi", "Tra 3 mesi o più", "Sto valutando"];
  var utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var clickIdKeys = ["gclid", "fbclid", "ttclid"];
  var trackingMaxLengths = { utm_source: 120, utm_medium: 120, utm_campaign: 160, utm_content: 160, utm_term: 160, gclid: 512, fbclid: 512, ttclid: 512 };

  function field(name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function checkedValue(name) {
    var item = form.querySelector('[name="' + name + '"]:checked');
    return item ? String(item.value || "").trim() : "";
  }

  function checkedValues(name) {
    return Array.prototype.slice.call(form.querySelectorAll('[name="' + name + '"]:checked'))
      .map(function (item) { return String(item.value || "").trim(); })
      .filter(Boolean);
  }

  function value(name) {
    var item = field(name);
    return item ? String(item.value || "").trim() : "";
  }

  function setAlert(message) {
    if (!alertBox) return;
    alertBox.textContent = message || "";
    alertBox.hidden = !message;
    if (message) alertBox.setAttribute("role", "alert");
  }

  function clearGroupErrors() {
    groups.forEach(function (group) {
      group.removeAttribute("data-invalid");
      var error = group.querySelector("[data-dfq-group-error]");
      if (error) error.textContent = "";
    });
  }

  function setGroupError(name, message) {
    var control = form.querySelector('[name="' + name + '"], [name="' + name + '[]"]');
    var group = control ? control.closest("[data-dfq-group]") : null;
    if (!group) return;
    group.setAttribute("data-invalid", "true");
    var error = group.querySelector("[data-dfq-group-error]");
    if (error) {
      error.textContent = message;
      error.setAttribute("role", "alert");
    }
  }

  function showStep(index) {
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach(function (step, i) {
      var active = i === currentStep;
      step.hidden = !active;
      step.setAttribute("aria-hidden", active ? "false" : "true");
    });
    if (progress) {
      var pct = steps.length ? Math.round(((currentStep + 1) / steps.length) * 100) : 100;
      progress.style.width = pct + "%";
      progress.setAttribute("aria-valuenow", String(pct));
    }
    if (back) back.hidden = currentStep === 0;
    if (primaryText) primaryText.textContent = currentStep === steps.length - 1 ? "Invia richiesta" : "Continua";
    if (!reducedMotion) {
      var activeStep = steps[currentStep];
      if (activeStep) activeStep.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function isEmail(input) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  }

  function isPhone(input) {
    return /^\+?[0-9][0-9\s()./-]{6,29}$/.test(input);
  }

  function includesAllowed(list, allowed) {
    return list.every(function (item) { return allowed.indexOf(item) !== -1; });
  }

  function validateAll() {
    clearGroupErrors();
    setAlert("");
    var errors = [];
    var selectedGoals = checkedValues("obiettivi[]");

    if (projectTypes.indexOf(checkedValue("tipo_progetto")) === -1) errors.push(["tipo_progetto", "Seleziona un tipo di progetto."]);
    if (selectedGoals.length < 1 || selectedGoals.length > 2 || !includesAllowed(selectedGoals, goals)) errors.push(["obiettivi", "Seleziona uno o due obiettivi."]);
    if (timelines.indexOf(checkedValue("tempistica")) === -1) errors.push(["tempistica", "Seleziona una tempistica."]);
    if (value("nome_cognome").length < 3) errors.push(["nome_cognome", "Inserisci nome e cognome."]);
    if (!isEmail(value("email").toLowerCase())) errors.push(["email", "Inserisci un indirizzo email valido."]);
    if (!isPhone(value("telefono"))) errors.push(["telefono", "Inserisci un numero di telefono valido."]);
    if (value("provincia").length < 2) errors.push(["provincia", "Inserisci la provincia."]);
    if (!field("privacy") || !field("privacy").checked) errors.push(["privacy", "Accetta l'informativa privacy per continuare."]);

    errors.forEach(function (entry) { setGroupError(entry[0], entry[1]); });
    return errors;
  }

  function validateCurrentStep() {
    var all = validateAll();
    if (!steps.length) return all.length === 0;
    var current = steps[currentStep];
    var currentErrors = all.filter(function (entry) {
      var control = form.querySelector('[name="' + entry[0] + '"], [name="' + entry[0] + '[]"]');
      return control && current && current.contains(control);
    });
    return currentErrors.length === 0;
  }

  function enforceGoalsLimit(event) {
    if (!event.target || event.target.name !== "obiettivi[]") return;
    var selected = checkedValues("obiettivi[]");
    if (selected.length > 2) {
      event.target.checked = false;
      setGroupError("obiettivi", "Puoi selezionare al massimo due obiettivi.");
    }
  }

  function tracking() {
    var params = new URLSearchParams(window.location.search);
    return utmKeys.concat(clickIdKeys).reduce(function (acc, key) {
      var raw = params.get(key);
      acc[key] = raw ? raw.trim().slice(0, trackingMaxLengths[key]) : undefined;
      return acc;
    }, {});
  }

  function payload() {
    if (!submissionId) submissionId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : fallbackUuid();
    var attribution = tracking();
    return {
      submission_id: submissionId,
      form_version: form.getAttribute("data-form-version") || "doflow-contact-v1",
      project_type: checkedValue("tipo_progetto"),
      goals: checkedValues("obiettivi[]"),
      timeline: checkedValue("tempistica"),
      name: value("nome_cognome"),
      company: value("azienda") || undefined,
      email: value("email").toLowerCase(),
      phone: value("telefono"),
      province: value("provincia"),
      privacy_accepted: Boolean(field("privacy") && field("privacy").checked),
      website: value("website"),
      landing_url: window.location.href,
      referrer: document.referrer || undefined,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      gclid: attribution.gclid,
      fbclid: attribution.fbclid,
      ttclid: attribution.ttclid,
      completion_seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    };
  }

  function fallbackUuid() {
    var cryptoApi = window.crypto || window.msCrypto;
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
      return (Number(c) ^ cryptoApi.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16);
    });
  }

  function publicMessage(status) {
    if (status === 400) return "Controlla i campi evidenziati e riprova.";
    if (status === 403) return "Non siamo riusciti a verificare l'origine della richiesta.";
    if (status === 429) return "Sono arrivate troppe richieste. Riprova tra qualche minuto.";
    if (status >= 500) return "Servizio momentaneamente non disponibile. Riprova più tardi.";
    return "Invio non riuscito. Riprova.";
  }

  function setSubmitting(next) {
    isSubmitting = next;
    if (primary) primary.disabled = next;
    if (back) back.disabled = next;
    if (primaryText) primaryText.textContent = next ? "Invio..." : (currentStep === steps.length - 1 ? "Invia richiesta" : "Continua");
  }

  async function submitForm() {
    if (isSubmitting) return;
    if (validateAll().length > 0) {
      setAlert("Controlla i campi richiesti.");
      return;
    }

    var endpoint = form.getAttribute("data-endpoint");
    if (!endpoint) {
      setAlert("Endpoint non configurato.");
      return;
    }

    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 15000);
    setSubmitting(true);

    try {
      var response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(payload())
      });

      if (!response.ok) {
        setAlert(publicMessage(response.status));
        return;
      }

      if (flow) flow.hidden = true;
      if (success) success.hidden = false;
      setAlert("");
      form.dispatchEvent(new CustomEvent("dfq:submitted", { bubbles: true, detail: { reference: submissionId } }));
    } catch (error) {
      setAlert(error && error.name === "AbortError" ? "Invio scaduto. Riprova." : "Errore di rete. Riprova.");
    } finally {
      window.clearTimeout(timer);
      setSubmitting(false);
    }
  }

  form.addEventListener("change", enforceGoalsLimit);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (currentStep < steps.length - 1) {
      if (validateCurrentStep()) showStep(currentStep + 1);
      else setAlert("Controlla i campi richiesti.");
      return;
    }
    submitForm();
  });

  if (primary) {
    primary.addEventListener("click", function (event) {
      event.preventDefault();
      form.requestSubmit();
    });
  }

  if (back) {
    back.addEventListener("click", function (event) {
      event.preventDefault();
      showStep(currentStep - 1);
    });
  }

  showStep(0);
})();
