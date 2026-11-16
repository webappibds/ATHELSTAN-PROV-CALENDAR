(async () => {
  'use strict';
  const area = document.getElementById('months');
  const picker = document.getElementById('courtFilter');
  const panel = document.getElementById('courtSubscription');
  const help = document.getElementById('subscriptionHelp');
  const openHelp = document.getElementById('showGoogleCalendar');
  const link = document.getElementById('subscriptionUrl');
  const message = document.getElementById('subscriptionStatus');
  const events = document.getElementById('individualEvents');
  const switches = [...document.querySelectorAll('.lang-switch button')];

  // Fixed page wording. These are trusted constants, so they may contain markup.
  const ui = {
    en: {
      locale: 'en-GB',
      month: 'Month', language: 'Language', court: 'Court', city: 'City', date: 'Date', day: 'Day', type: 'Meeting Type',
      googleButton: 'Google Calendar',
      helpIntro: '<strong>Keep your Court dates in Google Calendar.</strong> Subscribe once using a computer web browser, then view the calendar on your phone or tablet with the same Google account.',
      step1: 'Copy the calendar link below.',
      step2: 'Open Google Calendar and choose the Google account you want to use.',
      step3: 'Beside <strong>Other calendars</strong>, choose <strong>+ → From URL</strong>, paste the link, then click <strong>Add calendar</strong>.',
      step4: 'Choose <strong>red</strong> for this Court calendar in your Google Calendar colour settings.',
      linkLabel: 'Your Court’s calendar link',
      copy: 'Copy calendar link',
      openGoogle: 'Open Google Calendar ↗',
      refreshNote: 'Published changes will appear when Google refreshes this subscription; updates may be delayed. You can unsubscribe in Google Calendar at any time.',
      individualSummary: 'Add individual dates on this device',
      individualHelp: 'These links open ready-filled all-day events. Check your Google account, choose <strong>red</strong> in the event’s colour picker, then click <strong>Save</strong> for each date. For an existing event, choose <strong>Edit → colour → red → Save</strong>. Google uses your own colour choice. These are one-time copies and will not receive programme changes.',
      copied: 'Calendar link copied. Paste it into Google Calendar’s “From URL” field.',
      copyManually: 'Select and copy the calendar link above, then paste it into Google Calendar’s “From URL” field.',
      count: n => n + (n === 1 ? ' all-day event' : ' all-day events') + ' · Location: the city of each meeting',
      loadError: 'The published calendar could not be loaded. Please reload this page.'
    },
    el: {
      locale: 'el-GR',
      month: 'Μήνας', language: 'Γλώσσα', court: 'Αυλή', city: 'Πόλη', date: 'Ημερομηνία', day: 'Ημέρα', type: 'Τύπος Συνεδρίας',
      googleButton: 'Ημερολόγιο Google',
      helpIntro: '<strong>Κρατήστε τις ημερομηνίες της Αυλής σας στο Ημερολόγιο Google.</strong> Εγγραφείτε μία φορά από πρόγραμμα περιήγησης σε υπολογιστή και δείτε το ημερολόγιο στο κινητό ή στο tablet σας με τον ίδιο λογαριασμό Google.',
      step1: 'Αντιγράψτε τον παρακάτω σύνδεσμο ημερολογίου.',
      step2: 'Ανοίξτε το Ημερολόγιο Google και επιλέξτε τον λογαριασμό Google που θέλετε.',
      step3: 'Δίπλα στο <strong>Άλλα ημερολόγια</strong>, επιλέξτε <strong>+ → Από URL</strong>, επικολλήστε τον σύνδεσμο και πατήστε <strong>Προσθήκη ημερολογίου</strong>.',
      step4: 'Επιλέξτε <strong>κόκκινο</strong> χρώμα για το ημερολόγιο της Αυλής στις ρυθμίσεις χρωμάτων του Ημερολογίου Google.',
      linkLabel: 'Ο σύνδεσμος ημερολογίου της Αυλής σας',
      copy: 'Αντιγραφή συνδέσμου',
      openGoogle: 'Άνοιγμα Ημερολογίου Google ↗',
      refreshNote: 'Οι δημοσιευμένες αλλαγές εμφανίζονται όταν το Google ανανεώσει τη συνδρομή· οι ενημερώσεις μπορεί να καθυστερήσουν. Μπορείτε να καταργήσετε τη συνδρομή στο Ημερολόγιο Google οποιαδήποτε στιγμή.',
      individualSummary: 'Προσθήκη μεμονωμένων ημερομηνιών σε αυτή τη συσκευή',
      individualHelp: 'Οι σύνδεσμοι ανοίγουν έτοιμες ολοήμερες εκδηλώσεις. Ελέγξτε τον λογαριασμό Google, επιλέξτε <strong>κόκκινο</strong> στο χρώμα της εκδήλωσης και πατήστε <strong>Αποθήκευση</strong> για κάθε ημερομηνία. Για υπάρχουσα εκδήλωση επιλέξτε <strong>Επεξεργασία → χρώμα → κόκκινο → Αποθήκευση</strong>. Είναι μεμονωμένα αντίγραφα και δεν ενημερώνονται με αλλαγές του προγράμματος.',
      copied: 'Ο σύνδεσμος αντιγράφηκε. Επικολλήστε τον στο πεδίο «Από URL» του Ημερολογίου Google.',
      copyManually: 'Επιλέξτε και αντιγράψτε τον παραπάνω σύνδεσμο και επικολλήστε τον στο πεδίο «Από URL» του Ημερολογίου Google.',
      count: n => n + (n === 1 ? ' ολοήμερη εκδήλωση' : ' ολοήμερες εκδηλώσεις') + ' · Τοποθεσία: η πόλη κάθε συνεδρίας',
      loadError: 'Δεν ήταν δυνατή η φόρτωση του ημερολογίου. Ανανεώστε τη σελίδα.'
    }
  };

  function readSaved() { try { return localStorage.getItem('provinceLanguage'); } catch { return null; } }
  function initialLanguage() {
    const requested = new URLSearchParams(location.search).get('lang');
    if (requested in ui) return requested;
    const saved = readSaved();
    if (saved in ui) return saved;
    return (navigator.languages || [navigator.language || '']).some(code => /^el\b/i.test(code)) ? 'el' : 'en';
  }
  let lang = initialLanguage();
  const t = key => ui[lang][key];

  function textElement(tag, text, className = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = className;
    return element;
  }
  function applyFixedWording() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-ui]').forEach(element => { element.innerHTML = t(element.dataset.ui); });
    switches.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
  }
  applyFixedWording();

  try {
    const share = CourtCalendars;
    let content = share.defaultContent();
    try {
      // Page texts and Courts are optional; the original wording remains if they cannot load.
      const answer = await fetch('calendar-content.js?updated=' + Date.now(), { cache: 'no-store' });
      if (answer.ok) content = share.parseContent(await answer.text());
    } catch { /* Keep the default texts. */ }
    share.useCourts(content.courts);
    for (const [id, key] of [['emblem', 'emblem'], ['portrait', 'portrait']]) {
      const path = content.images[key];
      if (share.isImagePath(path)) document.getElementById(id).style.backgroundImage = "url('" + path + "')";
    }
    const response = await fetch('calendar-data.js?updated=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Calendar download failed');
    const schedule = share.parseSchedule(await response.text());
    const courtNames = share.courtList(schedule);
    courtNames.forEach(court => picker.add(new Option(court[0], court[0])));

    // Cities, meeting types and languages use their Greek names when one is set.
    const word = value => lang === 'el' ? content.translations[value] || value : value;
    const pageText = key => (lang === 'el' ? content.textsGreek[key] : content.texts[key]) || content.texts[key] || '';
    const dateOptions = { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' };

    function applyLanguage() {
      applyFixedWording();
      document.querySelectorAll('[data-text]').forEach(element => { element.textContent = pageText(element.dataset.text); });
      document.title = pageText('pageTitle');
      [...picker.options].slice(1).forEach((option, i) => { option.textContent = courtNames[i][0] + ' — ' + word(courtNames[i][1]); });
      render();
    }
    function render() {
      area.replaceChildren();
      const locale = t('locale');
      const visible = (picker.value ? share.selected(schedule, picker.value) : schedule.slice()).sort((a, b) => a[3].localeCompare(b[3]));
      const months = new Map();
      for (const row of visible) {
        const date = share.date(row[3]);
        const month = date.toLocaleDateString(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' });
        let section = months.get(month);
        const first = !section;
        if (!section) { section = textElement('section', '', 'month'); section.dataset.month = month; area.append(section); months.set(month, section); }
        const court = share.courts.find(court => share.courtKey(court[0]) === share.courtKey(row[1]));
        const work = textElement('div', '', 'work' + (/installation/i.test(row[4]) ? ' installation' : ''));
        const flag = textElement('div', court ? court[3] : '', 'flag');
        flag.title = court ? word(court[2]) : '';
        work.append(textElement('div', first ? month : '', 'monthLabel'), flag,
          textElement('div', row[1]), textElement('div', word(row[2]), 'city'),
          textElement('div', date.toLocaleDateString(locale, dateOptions), 'date'),
          textElement('div', date.toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'long' }), 'day'),
          textElement('div', word(row[4]), 'type'));
        section.append(work);
      }
      if (!visible.length) area.append(textElement('p', pageText('noDates')));
      panel.hidden = !picker.value;
      message.textContent = '';
      events.replaceChildren();
      if (!picker.value) return;
      document.getElementById('subscriptionCourt').textContent = share.title(picker.value);
      document.getElementById('subscriptionCount').textContent = t('count')(visible.length);
      link.value = share.feedUrl(picker.value);
      for (const row of visible) {
        const item = document.createElement('li');
        const event = textElement('a', share.date(row[3]).toLocaleDateString(locale, dateOptions) + ' — ' + word(row[4]) + ' ↗');
        event.href = share.googleEventUrl(row);
        event.target = '_blank';
        event.rel = 'noopener noreferrer';
        item.append(event);
        events.append(item);
      }
      document.getElementById('individualDates').hidden = !visible.length;
    }
    picker.addEventListener('change', () => {
      help.hidden = true;
      openHelp.setAttribute('aria-expanded', 'false');
      render();
    });
    switches.forEach(button => button.addEventListener('click', () => {
      if (button.dataset.lang === lang) return;
      lang = button.dataset.lang;
      try { localStorage.setItem('provinceLanguage', lang); } catch { /* The choice applies to this visit. */ }
      // Keep the language in the address so a shared link opens in the same language.
      const url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState(null, '', url);
      applyLanguage();
    }));
    openHelp.onclick = () => {
      help.hidden = !help.hidden;
      openHelp.setAttribute('aria-expanded', String(!help.hidden));
    };
    document.getElementById('copySubscription').onclick = async () => {
      const requested = link.value;
      try {
        await navigator.clipboard.writeText(requested);
        if (link.value === requested) message.textContent = t('copied');
      } catch {
        link.focus();
        link.select();
        message.textContent = t('copyManually');
      }
    };
    applyLanguage();
  } catch {
    area.textContent = t('loadError');
    area.setAttribute('role', 'alert');
    picker.disabled = true;
    panel.hidden = true;
    switches.forEach(button => button.addEventListener('click', () => {
      lang = button.dataset.lang;
      applyFixedWording();
      area.textContent = t('loadError');
    }));
  }
})();
