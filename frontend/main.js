import { mountGiftSupport } from './gift-support.js';
import { safetyEducation } from './safety-education.js';

(() => {
  mountGiftSupport();
  const toggle = document.getElementById('hamburger');
  const nav = document.getElementById('nav-menu');

  if (toggle && nav) {
    const closeMenu = () => {
      nav.classList.remove('active');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    };

    toggle.addEventListener('click', event => {
      event.stopPropagation();

      const isOpen = nav.classList.toggle('active');
      toggle.classList.toggle('active', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute(
        'aria-label',
        isOpen ? 'Close navigation' : 'Open navigation'
      );
    });

    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('click', event => {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 850) {
        closeMenu();
      }
    });
  }

  const year = document.getElementById('year');

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const educationList = document.getElementById('safety-education-list');
  const educationSearch = document.getElementById('safety-education-search');
  const educationSearchStatus = document.getElementById('safety-search-status');

  if (educationList && educationSearch && educationSearchStatus) {
    const renderEducation = () => {
      const query = educationSearch.value.trim().toLocaleLowerCase();
      const matches = safetyEducation.filter(article => {
        const content = `${article.category} ${article.en.title} ${article.en.summary} ${article.source}`.toLocaleLowerCase();
        return content.includes(query);
      });
      educationList.replaceChildren();
      matches.forEach(article => {
        const details = document.createElement('details');
        details.className = 'safety-education-item';
        const summary = document.createElement('summary');
        summary.textContent = article.en.title;
        const category = document.createElement('span');
        category.className = 'safety-education-category';
        category.textContent = article.category;
        const text = document.createElement('p');
        text.textContent = article.en.summary;
        const source = document.createElement('a');
        source.href = article.url;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
        source.textContent = `Source: ${article.source}`;
        details.append(summary, category, text, source);
        educationList.appendChild(details);
      });
      educationSearchStatus.textContent = matches.length
        ? `${matches.length} ${matches.length === 1 ? 'topic' : 'topics'} found.`
        : 'No topics match that search. Try another word or clear the search.';
    };
    educationSearch.addEventListener('input', renderEducation);
    renderEducation();
  }

  const medicationForm = document.getElementById('medication-entry-form');
  const medicationOutput = document.getElementById('medication-list-output');
  const medicationStatus = document.getElementById('medication-list-status');
  const printSummary = document.getElementById('medication-print-summary');
  const medicationRecords = [];

  if (medicationForm && medicationOutput && medicationStatus && printSummary) {
    const inputById = id => document.getElementById(id);
    const editId = inputById('medication-edit-id');
    const saveButton = inputById('medication-save-button');
    const cancelEditButton = inputById('medication-cancel-edit');
    const printButton = inputById('medication-print-button');
    const clearButton = inputById('medication-clear-button');
    const clearSessionButton = inputById('medication-clear-session-button');
    const reviewedDate = inputById('record-reviewed-date');
    if (reviewedDate && !reviewedDate.value) {
      const today = new Date();
      reviewedDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    const readRecord = () => ({
      name: inputById('record-medicine-name').value.trim(),
      strength: inputById('record-medicine-strength').value.trim(),
      form: inputById('record-medicine-form').value.trim(),
      instructions: inputById('record-medicine-instructions').value.trim(),
      prescriber: inputById('record-medicine-prescriber').value.trim(),
      notes: inputById('record-medicine-notes').value.trim(),
    });
    const appendLabel = (parent, label, value) => {
      if (!value) return;
      const row = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `${label}: `;
      row.append(strong, document.createTextNode(value));
      parent.appendChild(row);
    };
    const renderMedicationList = () => {
      medicationOutput.replaceChildren();
      printSummary.replaceChildren();
      const entries = document.createElement('ol');
      entries.className = 'medication-entry-list';
      medicationRecords.forEach((record, index) => {
        const item = document.createElement('li');
        const content = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = record.name;
        content.appendChild(title);
        appendLabel(content, 'Strength', record.strength);
        appendLabel(content, 'Form', record.form);
        appendLabel(content, 'Prescribed instructions', record.instructions);
        appendLabel(content, 'Prescriber or facility', record.prescriber);
        appendLabel(content, 'Notes', record.notes);
        const actions = document.createElement('div');
        actions.className = 'medication-entry-actions';
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'public-secondary-button';
        edit.textContent = 'Edit';
        edit.setAttribute('aria-label', `Edit ${record.name}`);
        edit.addEventListener('click', () => {
          editId.value = String(index);
          inputById('record-medicine-name').value = record.name;
          inputById('record-medicine-strength').value = record.strength;
          inputById('record-medicine-form').value = record.form;
          inputById('record-medicine-instructions').value = record.instructions;
          inputById('record-medicine-prescriber').value = record.prescriber;
          inputById('record-medicine-notes').value = record.notes;
          saveButton.textContent = 'Save changes';
          cancelEditButton.hidden = false;
          inputById('record-medicine-name').focus();
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'public-secondary-button';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove ${record.name}`);
        remove.addEventListener('click', () => {
          if (!window.confirm(`Remove ${record.name} from this list?`)) return;
          medicationRecords.splice(index, 1);
          renderMedicationList();
        });
        actions.append(edit, remove);
        item.append(content, actions);
        entries.appendChild(item);
      });
      if (medicationRecords.length) medicationOutput.appendChild(entries);
      const contextCard = document.createElement('article');
      contextCard.className = 'medication-context-preview';
      const contextTitle = document.createElement('h4');
      contextTitle.textContent = 'Other information for your care team';
      contextCard.appendChild(contextTitle);
      appendLabel(contextCard, 'Known allergies or status', inputById('record-allergies').value.trim());
      appendLabel(contextCard, 'Vitamins, supplements and non-prescription medicines', inputById('record-nonprescription').value.trim());
      appendLabel(contextCard, 'Notes or questions', inputById('record-questions').value.trim());
      appendLabel(contextCard, 'Date last reviewed', reviewedDate.value);
      medicationOutput.appendChild(contextCard);
      medicationStatus.textContent = medicationRecords.length
        ? `${medicationRecords.length} ${medicationRecords.length === 1 ? 'medicine' : 'medicines'} on your list. This record has not been clinically verified.`
        : 'Your list is empty. Add medicines above to begin.';
      printButton.disabled = medicationRecords.length === 0;
      clearButton.disabled = medicationRecords.length === 0;

      const printTitle = document.createElement('h1');
      printTitle.textContent = 'My Medication List';
      const printDate = document.createElement('p');
      printDate.textContent = `Date last reviewed: ${reviewedDate.value || 'Not provided'}`;
      const printItems = document.createElement('ol');
      medicationRecords.forEach(record => {
        const item = document.createElement('li');
        const title = document.createElement('h2');
        title.textContent = record.name;
        item.appendChild(title);
        appendLabel(item, 'Strength', record.strength);
        appendLabel(item, 'Dosage form', record.form);
        appendLabel(item, 'Prescribed instructions', record.instructions);
        appendLabel(item, 'Prescriber or facility', record.prescriber);
        appendLabel(item, 'Notes', record.notes);
        printItems.appendChild(item);
      });
      printSummary.append(printTitle, printDate, printItems);
      appendLabel(printSummary, 'Known allergies or allergy status', inputById('record-allergies').value.trim());
      appendLabel(printSummary, 'Vitamins, supplements and non-prescription medicines', inputById('record-nonprescription').value.trim());
      appendLabel(printSummary, 'Notes or questions', inputById('record-questions').value.trim());
      const verification = document.createElement('p');
      verification.className = 'print-verification-note';
      verification.textContent = 'This is a user-prepared record and has not been verified. Review all entries with a pharmacist or clinician.';
      printSummary.appendChild(verification);
    };
    const resetEditor = () => {
      medicationForm.reset();
      editId.value = '';
      saveButton.textContent = 'Add to my list';
      cancelEditButton.hidden = true;
    };

    medicationForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!medicationForm.reportValidity()) return;
      const record = readRecord();
      if (!record.name) {
        medicationStatus.textContent = 'Enter a medicine name to add it.';
        inputById('record-medicine-name').focus();
        return;
      }
      const index = editId.value === '' ? -1 : Number(editId.value);
      if (index >= 0 && medicationRecords[index]) medicationRecords[index] = record;
      else medicationRecords.push(record);
      resetEditor();
      renderMedicationList();
      medicationStatus.textContent = index >= 0 ? 'Medicine updated in this page session.' : 'Medicine added to this page session.';
    });
    cancelEditButton.addEventListener('click', () => { resetEditor(); medicationStatus.textContent = 'Edit cancelled.'; });
    clearButton.addEventListener('click', () => {
      if (!window.confirm('Start a new list and remove all current entries and notes?')) return;
      medicationRecords.splice(0);
      ['record-allergies', 'record-nonprescription', 'record-questions'].forEach(id => { inputById(id).value = ''; });
      reviewedDate.value = '';
      resetEditor();
      renderMedicationList();
    });
    clearSessionButton.addEventListener('click', () => {
      medicationRecords.splice(0);
      ['record-allergies', 'record-nonprescription', 'record-questions'].forEach(id => { inputById(id).value = ''; });
      reviewedDate.value = '';
      resetEditor();
      renderMedicationList();
      medicationStatus.textContent = 'Your information has been cleared from this page.';
    });
    printButton.addEventListener('click', () => window.print());
    ['record-allergies', 'record-nonprescription', 'record-questions', 'record-reviewed-date'].forEach(id => {
      inputById(id).addEventListener('input', renderMedicationList);
      inputById(id).addEventListener('change', renderMedicationList);
    });
    renderMedicationList();
  }

  const items = document.querySelectorAll('.reveal');
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -25px 0px',
      }
    );

    items.forEach(item => observer.observe(item));
  } else {
    items.forEach(item => item.classList.add('visible'));
  }

  const newsTrack = document.getElementById('safety-news-track');
  const safetySourceNote = document.getElementById('safety-source-note');
  const safetyStatsMeta = document.getElementById('safety-stats-meta');
  const safetyLiveStatus = document.getElementById('safety-live-status');

  if (newsTrack && safetySourceNote && safetyStatsMeta) {
    const sourceUrl = 'https://pv.pharmacyboardkenya.org/reports/medications_summary';
    const apiBase = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://localhost:8000'
      : '';
    const numberFormat = new Intl.NumberFormat('en-KE');
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reportDate = document.getElementById('safety-report-date');
    const applyReportDate = document.getElementById('safety-date-apply');
    const dateSummary = document.getElementById('safety-date-summary');
    const countyList = document.getElementById('safety-county-list');
    const monthlyChart = document.getElementById('safety-monthly-chart');
    const chartCaption = document.getElementById('safety-chart-caption');
    const explorerLive = document.getElementById('safety-explorer-live');
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const svgNamespace = 'http://www.w3.org/2000/svg';

    if (reportDate) {
      const today = new Date();
      const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (!reportDate.value) reportDate.value = todayValue;
      reportDate.max = todayValue;
    }

    const addSvgElement = (tag, attributes, parent = monthlyChart) => {
      const element = document.createElementNS(svgNamespace, tag);
      Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
      parent.appendChild(element);
      return element;
    };

    let latestSafetyData = null;

    const renderBreakdowns = () => {
      if (!latestSafetyData || !reportDate || !reportDate.value) return;
      const [selectedYear, selectedMonth] = reportDate.value.split('-').map(Number);
      const monthlyReports = Array.isArray(latestSafetyData.monthlyReports) ? latestSafetyData.monthlyReports : [];
      const selectedReport = monthlyReports.find(report => Number(report.year) === selectedYear && Number(report.month) === selectedMonth);
      const selectedDateLabel = reportDate.value
        ? new Date(`${reportDate.value}T12:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      if (dateSummary) {
        dateSummary.textContent = selectedReport
          ? `For ${selectedDateLabel}: PPB lists ${numberFormat.format(Number(selectedReport.count))} reports for ${monthLabels[selectedMonth - 1]} ${selectedYear}.`
          : `For ${selectedDateLabel}: no monthly total is currently listed for ${monthLabels[selectedMonth - 1]} ${selectedYear}.`;
      }
      if (chartCaption) chartCaption.textContent = `Monthly medication-error reports for ${selectedYear}`;
      if (monthlyChart) {
        monthlyChart.replaceChildren();
        const reportsForYear = monthLabels.map((_, index) => monthlyReports.find(report => Number(report.year) === selectedYear && Number(report.month) === index + 1));
        const counts = reportsForYear.map(report => report ? Math.max(0, Number(report.count) || 0) : 0);
        const maxCount = Math.max(1, ...counts);
        const left = 48;
        const right = 770;
        const top = 24;
        const baseline = 212;
        const plotHeight = baseline - top;
        const slotWidth = (right - left) / 12;
        const barWidth = 25;
        const points = [];

        [0, 0.5, 1].forEach(fraction => {
          const y = baseline - plotHeight * fraction;
          addSvgElement('line', { x1: left, y1: y, x2: right, y2: y, class: 'safety-chart-gridline' });
          const label = addSvgElement('text', { x: left - 9, y: y + 4, 'text-anchor': 'end', class: 'safety-chart-axis-label' });
          label.textContent = numberFormat.format(Math.round(maxCount * fraction));
        });

        counts.forEach((count, index) => {
          const centerX = left + slotWidth * index + slotWidth / 2;
          const barHeight = count ? Math.max(2, (count / maxCount) * plotHeight) : 0;
          const rect = addSvgElement('rect', {
            x: centerX - barWidth / 2,
            y: baseline - barHeight,
            width: barWidth,
            height: barHeight,
            rx: 6,
            class: index + 1 === selectedMonth ? 'safety-chart-bar is-selected' : 'safety-chart-bar',
          });
          const tooltip = addSvgElement('title', {}, rect);
          tooltip.textContent = `${monthLabels[index]} ${selectedYear}: ${numberFormat.format(count)} reports`;
          points.push({ x: centerX, y: baseline - (count / maxCount) * plotHeight });
          const monthLabel = addSvgElement('text', { x: centerX, y: baseline + 22, 'text-anchor': 'middle', class: 'safety-chart-month-label' });
          monthLabel.textContent = monthLabels[index];
        });

        const curve = points.map((point, index) => {
          if (index === 0) return `M ${point.x} ${point.y}`;
          const previous = points[index - 1];
          const beforePrevious = points[Math.max(0, index - 2)];
          const next = points[Math.min(points.length - 1, index + 1)];
          const controlOne = { x: previous.x + (point.x - beforePrevious.x) / 6, y: previous.y + (point.y - beforePrevious.y) / 6 };
          const controlTwo = { x: point.x - (next.x - previous.x) / 6, y: point.y - (next.y - previous.y) / 6 };
          return `C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${point.x} ${point.y}`;
        }).join(' ');
        addSvgElement('path', { d: curve, class: 'safety-chart-curve' });
        points.forEach(point => addSvgElement('circle', { cx: point.x, cy: point.y, r: 3.5, class: 'safety-chart-point' }));
        monthlyChart.setAttribute('aria-label', `Monthly medication-error reports for ${selectedYear}. ${counts.map((count, index) => `${monthLabels[index]}: ${count}`).join(', ')}.`);
      }

      if (countyList) {
        countyList.replaceChildren();
        const counties = Array.isArray(latestSafetyData.countyReports) ? latestSafetyData.countyReports.slice(0, 6) : [];
        const maxCountyCount = Math.max(1, ...counties.map(item => Number(item.count) || 0));
        counties.forEach(item => {
          const row = document.createElement('li');
          const heading = document.createElement('div');
          heading.className = 'safety-county-row-heading';
          const name = document.createElement('span');
          name.textContent = item.county;
          const count = document.createElement('strong');
          count.textContent = numberFormat.format(Number(item.count) || 0);
          heading.append(name, count);
          const track = document.createElement('span');
          track.className = 'safety-county-bar-track';
          const bar = document.createElement('span');
          bar.className = 'safety-county-bar';
          bar.style.width = `${Math.max(3, ((Number(item.count) || 0) / maxCountyCount) * 100)}%`;
          track.appendChild(bar);
          row.append(heading, track);
          countyList.appendChild(row);
        });
        if (!counties.length) {
          const emptyRow = document.createElement('li');
          emptyRow.textContent = 'County-level totals are unavailable right now.';
          countyList.appendChild(emptyRow);
        }
      }
      if (explorerLive) {
        const fetchedAt = new Date(latestSafetyData.fetchedAt);
        const updated = Number.isNaN(fetchedAt.valueOf()) ? 'Live PPB report' : `Updated ${fetchedAt.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' })} EAT`;
        explorerLive.classList.remove('is-offline');
        explorerLive.innerHTML = `<span></span>${updated}`;
      }
      if (dateSummary && selectedDateLabel) dateSummary.setAttribute('aria-label', `${selectedDateLabel}. ${dateSummary.textContent}`);
    };

    reportDate?.addEventListener('input', renderBreakdowns);
    reportDate?.addEventListener('change', renderBreakdowns);
    applyReportDate?.addEventListener('click', () => {
      if (!reportDate?.value) {
        if (dateSummary) dateSummary.textContent = 'Choose a date to view its published report information.';
        return;
      }
      renderBreakdowns();
      dateSummary?.scrollIntoView({ behavior: motionPreference.matches ? 'auto' : 'smooth', block: 'nearest' });
    });

    const animateValue = (element, target) => {
      const startValue = Number(element.dataset.currentValue || 0);
      const duration = motionPreference.matches ? 0 : 1050;
      const startTime = performance.now();

      const frame = now => {
        const progress = duration ? Math.min((now - startTime) / duration, 1) : 1;
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(startValue + (target - startValue) * eased);
        element.textContent = numberFormat.format(value);
        element.dataset.currentValue = String(value);
        if (progress < 1) requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    };

    const makeCard = ({ label, title, narration, image, alt }) => `
      <a class="safety-news-card" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">
        <img src="${image}" alt="${alt}">
        <div><span class="news-card-label">${label}</span><h3>${title}</h3><p>${narration}</p></div>
      </a>`;

    const showFailure = () => {
      const card = makeCard({
        label: 'Public dashboard',
        title: 'Live report temporarily unavailable',
        narration: 'Open the official PPB report to check the latest publicly listed medication-error figures.',
        image: '/images/safety-report.svg',
        alt: 'Medication safety report illustration',
      });
      newsTrack.innerHTML = `<div class="safety-news-set">${card}</div>`;
      if (safetyLiveStatus) {
        safetyLiveStatus.classList.add('is-offline');
        safetyLiveStatus.innerHTML = '<span></span>Source unavailable';
      }
      if (explorerLive) {
        explorerLive.classList.add('is-offline');
        explorerLive.innerHTML = '<span></span>Source unavailable';
      }
      safetySourceNote.innerHTML = `Could not retrieve the live report right now. <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Open the PPB dashboard</a>`;
      safetyStatsMeta.textContent = 'Live counts unavailable; no estimate is shown.';
    };

    const loadSafetyData = async () => {
      try {
        const response = await fetch(`${apiBase}/api/safety/live`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Live safety data request failed.');
        const data = await response.json();
        latestSafetyData = data;
        const total = Number(data.totalReportedErrors);
        const yearCount = Number(data.currentYearReportedErrors);
        const priorCount = Number(data.priorYearReportedErrors);
        const year = Number(data.currentYear);
        if (![total, yearCount, priorCount, year].every(Number.isFinite)) {
          throw new Error('Live safety data was incomplete.');
        }
        if (safetyLiveStatus) {
          safetyLiveStatus.classList.remove('is-offline');
          safetyLiveStatus.innerHTML = '<span></span>Live data';
        }

        document.querySelectorAll('[data-live-count]').forEach(element => {
          const count = Number(data[element.dataset.liveCount]);
          if (Number.isFinite(count)) animateValue(element, count);
        });
        document.querySelectorAll('[data-live-year]').forEach(element => {
          element.textContent = String(year);
        });
        renderBreakdowns();

        const change = yearCount - priorCount;
        const comparison = change > 0
          ? `The dashboard currently lists ${numberFormat.format(change)} more reports than in ${year - 1}.`
          : change < 0
            ? `The dashboard currently lists ${numberFormat.format(Math.abs(change))} fewer reports than in ${year - 1}.`
            : `The dashboard currently lists the same number as in ${year - 1}.`;
        const stories = [
          {
            label: 'PPB dashboard total',
            title: `${numberFormat.format(total)} medication-error reports`,
            narration: 'This is the total currently listed by Kenya’s public PvERS dashboard; submissions are not a census of every error.',
            image: '/images/safety-report.svg',
            alt: 'Illustration of a medication safety report',
          },
          {
            label: `${year} report snapshot`,
            title: `${numberFormat.format(yearCount)} reports listed for ${year}`,
            narration: `The official dashboard’s current year-by-year table lists ${numberFormat.format(yearCount)} medication-error reports for ${year}.`,
            image: '/images/safety-trend.svg',
            alt: 'Illustration of a medication safety reporting trend',
          },
          {
            label: 'Year-on-year context',
            title: `${numberFormat.format(priorCount)} reports listed for ${year - 1}`,
            narration: comparison,
            image: '/images/safety-counties.svg',
            alt: 'Illustration of county-level medication safety reporting',
          },
        ];
        const cards = stories.map(makeCard).join('');
        newsTrack.innerHTML = `<div class="safety-news-set">${cards}</div><div class="safety-news-set" aria-hidden="true" inert>${cards}</div>`;

        const fetchedAt = new Date(data.fetchedAt);
        const displayTime = Number.isNaN(fetchedAt.valueOf())
          ? 'recently'
          : fetchedAt.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' });
        safetySourceNote.innerHTML = `Last retrieved ${displayTime} (EAT). <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">View the official PPB dashboard</a>`;
        safetyStatsMeta.textContent = 'Automatically refreshed every 15 minutes from the official report page.';
      } catch {
        showFailure();
      }
    };

    loadSafetyData();
    window.setInterval(loadSafetyData, 15 * 60 * 1000);
  }

  const photoViewport = document.querySelector('[data-photo-viewport]');
  const photoTrack = document.querySelector('[data-photo-track]');

  if (photoViewport && photoTrack) {
    const originalSlides = Array.from(photoTrack.children);
    const slideCount = originalSlides.length;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let photoIndex = 0;
    let autoAdvance;
    let dragStartX = null;

    originalSlides.forEach(slide => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      photoTrack.appendChild(clone);
    });

    const slideDistance = () => {
      const slide = photoTrack.firstElementChild;
      if (!slide) return 0;
      const styles = getComputedStyle(photoTrack);
      return slide.getBoundingClientRect().width + (parseFloat(styles.columnGap || styles.gap) || 0);
    };

    const positionPhotos = (animate = true) => {
      photoTrack.style.transition = animate && !reduceMotion.matches ? '' : 'none';
      photoTrack.style.transform = `translate3d(${-photoIndex * slideDistance()}px, 0, 0)`;
    };

    const nextPhoto = () => {
      photoIndex += 1;
      positionPhotos();
    };

    const previousPhoto = () => {
      if (photoIndex === 0) {
        photoIndex = slideCount;
        positionPhotos(false);
        requestAnimationFrame(() => {
          photoIndex -= 1;
          positionPhotos();
        });
        return;
      }
      photoIndex -= 1;
      positionPhotos();
    };

    photoTrack.addEventListener('transitionend', event => {
      if (event.target !== photoTrack || photoIndex < slideCount) return;
      photoIndex = 0;
      positionPhotos(false);
    });

    const stopAutoAdvance = () => window.clearInterval(autoAdvance);
    const startAutoAdvance = () => {
      stopAutoAdvance();
      if (!reduceMotion.matches && !document.hidden) autoAdvance = window.setInterval(nextPhoto, 4200);
    };

    photoViewport.addEventListener('mouseenter', stopAutoAdvance);
    photoViewport.addEventListener('mouseleave', startAutoAdvance);
    photoViewport.addEventListener('focusin', stopAutoAdvance);
    photoViewport.addEventListener('focusout', event => {
      if (!photoViewport.contains(event.relatedTarget)) startAutoAdvance();
    });
    photoViewport.addEventListener('pointerdown', event => { dragStartX = event.clientX; });
    photoViewport.addEventListener('pointerup', event => {
      if (dragStartX === null) return;
      const distance = event.clientX - dragStartX;
      dragStartX = null;
      if (Math.abs(distance) > 45) {
        distance > 0 ? previousPhoto() : nextPhoto();
        startAutoAdvance();
      }
    });
    photoViewport.addEventListener('pointercancel', () => { dragStartX = null; });
    photoViewport.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); nextPhoto(); startAutoAdvance(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); previousPhoto(); startAutoAdvance(); }
    });
    document.querySelector('[data-photo-next]')?.addEventListener('click', () => { nextPhoto(); startAutoAdvance(); });
    document.querySelector('[data-photo-prev]')?.addEventListener('click', () => { previousPhoto(); startAutoAdvance(); });
    window.addEventListener('resize', () => positionPhotos(false));
    document.addEventListener('visibilitychange', startAutoAdvance);
    reduceMotion.addEventListener('change', () => { positionPhotos(false); startAutoAdvance(); });
    positionPhotos(false);
    startAutoAdvance();
  }
})();
