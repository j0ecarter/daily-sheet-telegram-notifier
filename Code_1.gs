/**
 * Daily Sheet Figure Notifier
 *
 * Standalone Apps Script: reads one cell from a Google Sheet on a daily
 * schedule and pushes the value to Telegram. Read-only; nothing is attached to
 * the source spreadsheet.
 *
 * Setup: add the three Script Properties named below, set the timezone, then
 * run testConfiguration -> sendDailyFigureNotification -> createDailyMorningTrigger.
 */

// --- Config -----------------------------------------------------------------

// Script Property keys, not the values themselves.
const SPREADSHEET_ID_PROPERTY_NAME = 'SPREADSHEET_ID_ACCESS';
const BOT_TOKEN_PROPERTY_NAME = 'TELEGRAM_BOT_TOKEN';
const CHAT_ID_PROPERTY_NAME = 'TELEGRAM_CHAT_ID';

const SHEET_TAB_NAME = 'Summary';
const TARGET_CELL_A1 = 'B2';
const FIGURE_LABEL = 'Balance';
const NOTIFY_HOUR_24H = 7;
const SKIP_SEND_WHEN_CELL_IS_BLANK = true;

// --- Main -------------------------------------------------------------------

/** Entry point for the daily trigger. */
function sendDailyFigureNotification() {
  const figureAsDisplayed = readTargetFigure();

  // A real zero arrives as "0", so only genuinely empty cells are skipped.
  if (SKIP_SEND_WHEN_CELL_IS_BLANK && figureAsDisplayed === '') {
    console.log('Target cell is blank; skipping send for today.');
    return;
  }

  const messageBody = buildMessageBody(figureAsDisplayed);
  sendTelegramMessage(messageBody);

  console.log('Sent successfully: ' + messageBody.replace(/\n/g, ' | '));
}


/**
 * @param {string} propertyName
 * @returns {string}
 * @throws {Error} If the property is unset or empty.
 */
function getRequiredScriptProperty(propertyName) {
  const propertyValue = PropertiesService.getScriptProperties().getProperty(propertyName);

  if (!propertyValue) {
    throw new Error(
      'Script Property "' + propertyName + '" is not set. Add it under ' +
      'Project Settings -> Script Properties.'
    );
  }

  return propertyValue;
}


/**
 * @returns {string} The target cell, formatted as displayed in the sheet.
 * @throws {Error} If the spreadsheet or tab cannot be reached.
 */
function readTargetFigure() {
  // Read here rather than at file scope: top-level code also runs during the
  // initial OAuth flow, before PropertiesService is available.
  const sourceSpreadsheetId = getRequiredScriptProperty(SPREADSHEET_ID_PROPERTY_NAME);

  let spreadsheet;

  try {
    spreadsheet = SpreadsheetApp.openById(sourceSpreadsheetId);
  } catch (error) {
    throw new Error(
      'Could not open the source spreadsheet. Check the "' +
      SPREADSHEET_ID_PROPERTY_NAME + '" Script Property holds a correct ID, ' +
      'that the file is a native Google Sheet rather than an uploaded Excel ' +
      'file, and that this account still has access. Underlying error: ' +
      error.message
    );
  }

  const sheet = spreadsheet.getSheetByName(SHEET_TAB_NAME);

  if (!sheet) {
    const availableTabNames = spreadsheet.getSheets()
      .map(eachSheet => '"' + eachSheet.getName() + '"')
      .join(', ');

    throw new Error(
      'No tab named "' + SHEET_TAB_NAME + '" in that spreadsheet. ' +
      'Tabs present: ' + availableTabNames
    );
  }

  // getDisplayValue preserves the sheet's own currency and rounding formatting.
  return sheet.getRange(TARGET_CELL_A1).getDisplayValue();
}


/**
 * @param {string} figureAsDisplayed
 * @returns {string} Date on line one, labelled figure on line two.
 */
function buildMessageBody(figureAsDisplayed) {
  const scriptTimeZone = Session.getScriptTimeZone();
  const todaysDateFormatted = Utilities.formatDate(new Date(), scriptTimeZone, 'EEE d MMM');

  return todaysDateFormatted + '\n' + FIGURE_LABEL + ': ' + figureAsDisplayed;
}

// --- Telegram ---------------------------------------------------------------

/**
 * @param {string} messageText
 * @throws {Error} If credentials are missing or Telegram rejects the request.
 */
function sendTelegramMessage(messageText) {
  const botToken = getRequiredScriptProperty(BOT_TOKEN_PROPERTY_NAME);
  const chatId = getRequiredScriptProperty(CHAT_ID_PROPERTY_NAME);

  // No separator between "bot" and the token.
  const telegramApiUrl = 'https://api.telegram.org/bot' + botToken + '/sendMessage';

  const requestOptions = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: messageText }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(telegramApiUrl, requestOptions);

  if (response.getResponseCode() !== 200) {
    throw new Error('Telegram rejected the message: ' + response.getContentText());
  }
}

// --- Setup and diagnostics --------------------------------------------------

/** Creates the daily trigger, replacing any existing one. Run manually. */
function createDailyMorningTrigger() {
  const existingTriggers = ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'sendDailyFigureNotification');

  existingTriggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('sendDailyFigureNotification')
    .timeBased()
    .atHour(NOTIFY_HOUR_24H)
    .everyDays(1)
    .create();

  console.log(
    'Daily trigger created for ~' + NOTIFY_HOUR_24H + ':00 (' +
    Session.getScriptTimeZone() + '). Removed ' + existingTriggers.length +
    ' previous trigger(s). Google fires these within a one-hour window.'
  );
}


/** Validates config and logs the message that would be sent, without sending. */
function testConfiguration() {
  console.log('--- Configuration check ---');
  console.log('Script timezone: ' + Session.getScriptTimeZone());

  const scriptProperties = PropertiesService.getScriptProperties();

  // Presence only — a revoked token still reports true.
  console.log('Spreadsheet ID present: ' + !!scriptProperties.getProperty(SPREADSHEET_ID_PROPERTY_NAME));
  console.log('Bot token present:      ' + !!scriptProperties.getProperty(BOT_TOKEN_PROPERTY_NAME));
  console.log('Chat ID present:        ' + !!scriptProperties.getProperty(CHAT_ID_PROPERTY_NAME));

  const figureAsDisplayed = readTargetFigure();
  console.log('Cell ' + TARGET_CELL_A1 + ' on "' + SHEET_TAB_NAME + '" reads: "' +
              figureAsDisplayed + '"');

  console.log('--- Message that would be sent ---');
  console.log(buildMessageBody(figureAsDisplayed));
}


/** Stops the daily notifications without deleting the project. */
function removeDailyMorningTrigger() {
  const removedCount = ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'sendDailyFigureNotification')
    .map(trigger => { ScriptApp.deleteTrigger(trigger); return trigger; })
    .length;

  console.log('Removed ' + removedCount + ' trigger(s).');
}
