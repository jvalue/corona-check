'use strict';

const ODS_ZIP_CODE_URL = 'http://localhost:9000/api/storage/1?order=id.desc&limit=1';
const ODS_CORONA_URL = 'http://localhost:9000/api/storage/2?order=id.desc&limit=1';

var zip_lookup;

/**
 * Gets called when the DOM finished loading,
 * compareable to JQuery's .ready() function.
 */
async function onLoad() {
  // check if browser supports templates
  if (!('content' in document.createElement('template'))) {
    setStatusZIP('Browser unterstützt keine Templates.', true);
    // App is non-functioning without templates, so disable the form elements
    disableForm();
    return false;
  }

  try {
    setStatusZIP('Lade Postleitzahlenverzeichnis...');
    zip_lookup = await fetchODSData(ODS_ZIP_CODE_URL);
    // zip_lookup is an object mapping zip to county code,
    // so we need to use Object.keys to get the number of zip codes
    const count = Object.keys(zip_lookup).length;
    setStatusZIP(`${count} Postleitzahlen geladen.`);

  } catch (err) {
    setStatusZIP('Fehler beim Laden der Postleitzahlen!', true);
    console.log(err);
    // App is non-functioning without the zip codes, so disable the form elements
    disableForm();
  }
}

/**
 * Gets called when either the button is pressed, or the enter key is used while in the text box.
 * @param {Event} ev FormEvent
 */
async function onFormSubmit(ev) {
  // this stops the form from actually submitting and reloading the page
  ev.preventDefault();

  const zip_regex = /^\d\d\d\d\d$/
  const zip = document.getElementById('zip').value;
  if (!zip_regex.test(zip)) {
    setStatusLookup('Unzulässiges PLZ-Format.', true);
    return false;
  }
  
  let corona_lookup;
  try {
    setStatusLookup('Lade Corona-Daten...');
    corona_lookup = await fetchODSData(ODS_CORONA_URL);
    // corona_lookup is an object mapping county code to data,
    // so we need to use Object.keys to get the number of counties
    const count = Object.keys(corona_lookup).length;
    setStatusLookup(`${count} Landkreisdaten geladen.`);
  } catch (err) {
    setStatusLookup('Fehler beim Laden der Corona-Daten!', true);
    return false;
  }

  const countyCode = zip_lookup[zip];
  if (countyCode === undefined) {
    setStatusLookup(`Keine Zuordnung für PLZ ${zip} gefunden.`, true);
    return false;
  }

  setStatusLookup(`PLZ ${zip} gehört zu Landkreis ${countyCode}.`);

  const result = corona_lookup[countyCode];
  if (result === undefined) {
    setStatusLookup(`Keine Corona-Werte für Landkreis ${countyCode} gefunden.`, true);
    return false;
  }

  const template = document.getElementById('result-template');
  
  // Clone the new row and insert it into the table
  const clone = template.content.cloneNode(true);
  clone.querySelector('.name').textContent = result.name;
  clone.querySelector('.type').textContent = result.type;
  clone.querySelector('.population').textContent =
    numberFormat(result.population, false, 4);
  
  clone.querySelector('.cases').textContent = numberFormat(result.cases);
  clone.querySelector('.deaths').textContent = numberFormat(result.deaths);
  clone.querySelector('.casesPerHundredThousand').textContent =
    numberFormat(result['cases_per_100k'], true);
  
  clone.querySelector('.casesWeekPerHundredThousand').textContent =
    numberFormat(result['cases7_per_100k'], true);
  
  clone.querySelector('.state').textContent = result.state;
  clone.querySelector('.populationState').textContent =
    numberFormat(result.population_state / 1e6, false, 3);
  clone.querySelector('.casesWeekStatePerHundredThousand').textContent =
    numberFormat(result['cases7_bl_per_100k'], true);
  
  clone.querySelector('.lastUpdate').textContent = result.last_update;
  
  document.getElementById('results').prepend(clone);

  setStatusLookup('');
  return false;
}

/**
 * Inserts the current message into the status DOMElement provided. Supports formatting as error.
 * @param {string} id The id of the DOMElement used for status
 * @param {string} status The status message
 * @param {boolean} error If the message should be formatted as an error
 */
function setStatus(id, status, error) {
  const element = document.getElementById(id);
  element.textContent = status;
  if (error) {
    element.classList.add('error');
  } else {
    element.classList.remove('error');
  }
}

/**
 * Shortcut method to set the zip loading status.
 * @param {string} status The status message
 * @param {boolean} error If the message should be formatted as an error
 */
function setStatusZIP(status, error = false) {
  setStatus('status-zip', status, error);
}

/**
 * Shortcut method to set the corona lookup status.
 * @param {string} status The status message
 * @param {boolean} error If the message should be formatted as an error
 */
function setStatusLookup(status, error = false) {
  setStatus('status-lookup', status, error);
}

/**
 * Fetches the data from the supplied URL. Automatically parses the json and returns the data contained in the reply.
 * @param {string} url The url to fetch
 * @throws Throws an error if the response status code is not 200.
 */
async function fetchODSData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unexpected status code ${response.status} while fetching $url`);
  }
  const json = await response.json();
  return json[0].data;
}

/**
 * Disables the form elements.
 */
function disableForm() {
  document.getElementById('zip').setAttribute('disabled', 'disabled');
  document.getElementById('submit').setAttribute('disabled', 'disabled');
}

/**
 * Formats a number using german localization including optional rounding.
 * @param {number} number The number to display
 * @param {boolean} round If the number should be rounded to the nearest integer
 * @param {number} maxDigits Maximum amount of significant digits (including decimals)
 */
function numberFormat(number, round = false, maxDigits = 21) {
  if (round) number = Math.round(number);
  return new Intl.NumberFormat('de-DE', { maximumSignificantDigits: maxDigits }).format(number);
}

// register events
document.addEventListener('DOMContentLoaded', async (ev) => {
  document.getElementById('form').addEventListener('submit', onFormSubmit);
  onLoad();
});
