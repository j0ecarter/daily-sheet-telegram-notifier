# Daily Sheet Figure Notifier

Pushes a single figure from a Google Sheet to Telegram every morning. No server, no API costs, no SMS fees.

```
Fri 11 Sep
Balance: £12,480.55
```

## Why

I needed one number from a spreadsheet at the start of each day, and opening the file to read a single cell is a poor use of a morning. The obvious answer — a text message — turns out to be the one option that isn't free: the UK email-to-SMS gateways are long dead, and Twilio and its competitors all charge per message. A push notification lands on the lock screen identically and costs nothing.

## How it works

An Apps Script time trigger fires daily, reads one cell, and posts the value to the Telegram Bot API. Everything runs on Google's infrastructure, so nothing needs to be open or logged in.

```
Apps Script (daily trigger) → read cell → Telegram Bot API → phone
```

## Design decisions

**Standalone, not bound.** Apps Script projects created via `Extensions → Apps Script` attach to the spreadsheet and are visible to anyone who opens that menu. On a shared file that's an unwelcome artefact in someone else's document. A standalone project in your own Drive reaching the sheet through `SpreadsheetApp.openById()` leaves the source file completely untouched, and inherits the access you already have rather than requiring anything new to be granted.

**Telegram over SMS or email.** Email gets buried; SMS costs money. A Telegram bot is free, delivers a real push notification, and takes about ten minutes to set up via BotFather.

**Script Properties for all configuration that varies.** The bot token, chat ID and source document ID all live in Project Settings rather than in source. This repo is therefore publishable as-is with no placeholder juggling between the committed copy and the running one.

**`getDisplayValue()` rather than `getValue()`.** The former returns the cell exactly as rendered, preserving the currency symbol, thousands separators and decimal rounding already applied by the sheet. The latter returns the raw float, so `£12,480.55` arrives as `12480.549999999999`.

**Read-only by construction.** There is no write path anywhere in the script. It cannot modify the source spreadsheet, appear in its version history, or trigger edit notifications.

## Setup

### 1. Create the Telegram bot

Message [@BotFather](https://t.me/botfather) and send `/newbot`. Follow the prompts; you'll be given an API token.

Open your new bot and press **START**. This step is mandatory and easily missed — bots cannot initiate contact, and until a user has started one, `sendMessage` returns `chat not found` for that user.

### 2. Get your chat ID

Message [@userinfobot](https://t.me/userinfobot) and press START. It replies with your numeric user ID, which is your chat ID for one-to-one messages. It's permanent.

### 3. Create the script project

Go to [script.google.com](https://script.google.com) → **New project**. Paste in `Code.gs`.

### 4. Add the Script Properties

**Project Settings → Script Properties → Add script property:**

| Property | Value |
|---|---|
| `SPREADSHEET_ID_ACCESS` | The long string in the sheet's URL between `/d/` and `/edit` |
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `TELEGRAM_CHAT_ID` | From @userinfobot |

While on that page, set **Time zone** — standalone projects default to a US timezone regardless of your account's locale.

### 5. Set the target

In the config block at the top of `Code.gs`, set `SHEET_TAB_NAME`, `TARGET_CELL_A1`, `FIGURE_LABEL` and `NOTIFY_HOUR_24H`.

### 6. Run the three functions in order

| Function | Purpose |
|---|---|
| `testConfiguration` | Validates everything and logs the message. Sends nothing. |
| `sendDailyFigureNotification` | Sends once, immediately. Confirms delivery. |
| `createDailyMorningTrigger` | Schedules it. Run once. |

The first run prompts for OAuth authorisation. The "unverified app" warning is expected for a personal script — **Advanced** → **Go to (project name)**.

`createDailyMorningTrigger` is the step that's easy to forget. Without it the script works perfectly and simply never fires on its own. Confirm it took by checking the **Triggers** panel (clock icon) shows one time-driven entry.

