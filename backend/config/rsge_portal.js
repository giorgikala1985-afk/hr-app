const puppeteer = require('puppeteer-core');

const PORTAL_URL = 'https://eservices.rs.ge';
const LOGIN_URL = `${PORTAL_URL}/Login.aspx`;
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Store active browser sessions per user
const sessions = new Map();

// ══════════════════════════════════════════════════════
// PORTAL LOGIN
// ══════════════════════════════════════════════════════

async function startLogin(userId, { username, password }) {
  await closeSession(userId);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: EDGE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-notifications'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  sessions.set(userId, { browser, page, status: 'logging_in' });

  try {
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#username', { timeout: 10000 });

    await page.click('#username');
    await page.type('#username', username, { delay: 30 });
    await page.click('#password');
    await page.type('#password', password, { delay: 30 });

    // Click login — this triggers JS
    await page.click('#btnLogin');

    // Poll for state changes (up to 10 seconds)
    let result = null;
    for (let i = 0; i < 20; i++) {
      await delay(500);
      try {
        const state = await page.evaluate(() => {
          const smsInput = document.querySelector('#smsText');
          const smsVisible = smsInput && smsInput.offsetParent !== null;
          const bodyText = document.body.innerText;
          const hasError = bodyText.includes('შეცდომა') || bodyText.includes('შეამოწმოთ');
          return { url: location.href, smsVisible, hasError };
        });

        if (!state.url.includes('Login')) {
          result = { status: 'logged_in', message: 'Successfully logged in to RS.ge portal' };
          break;
        }
        if (state.smsVisible) {
          result = { status: 'needs_2fa', message: 'SMS verification code sent to your phone. Enter the code below.' };
          break;
        }
        if (state.hasError) {
          throw new Error('Login failed — check your eservices.rs.ge username and password');
        }
      } catch (evalErr) {
        // Frame might have detached due to redirect = login success
        if (evalErr.message.includes('detached') || evalErr.message.includes('Execution context')) {
          result = { status: 'logged_in', message: 'Successfully logged in to RS.ge portal' };
          break;
        }
        if (evalErr.message.includes('Login failed')) throw evalErr;
      }
    }

    if (!result) {
      throw new Error('Login timed out — RS.ge did not respond. Try again.');
    }

    sessions.get(userId).status = result.status;
    return result;
  } catch (err) {
    await closeSession(userId);
    throw err;
  }
}

async function submit2FACode(userId, code) {
  const session = sessions.get(userId);
  if (!session || session.status !== 'needs_2fa') {
    throw new Error('No pending 2FA verification');
  }

  const { page } = session;

  try {
    await page.click('#smsText');
    await page.type('#smsText', code, { delay: 30 });
    await page.click('#btnSmsLogin');

    // Poll for result
    let result = null;
    for (let i = 0; i < 16; i++) {
      await delay(500);
      try {
        const state = await page.evaluate(() => {
          const smsInput = document.querySelector('#smsText');
          const smsVisible = smsInput && smsInput.offsetParent !== null;
          return { url: location.href, smsVisible };
        });

        if (!state.url.includes('Login')) {
          result = { status: 'logged_in', message: 'Successfully verified and logged in' };
          break;
        }
      } catch (evalErr) {
        // Frame detached = redirect = login success
        if (evalErr.message.includes('detached') || evalErr.message.includes('Execution context')) {
          result = { status: 'logged_in', message: 'Successfully verified and logged in' };
          break;
        }
      }
    }

    if (!result) {
      // Clear input for retry
      try { await page.evaluate(() => { document.querySelector('#smsText').value = ''; }); } catch {}
      throw new Error('Invalid SMS code. Please try again.');
    }

    session.status = result.status;
    return result;
  } catch (err) {
    if (err.message.includes('Invalid SMS') || err.message.includes('try again')) throw err;
    await closeSession(userId);
    throw err;
  }
}

// ══════════════════════════════════════════════════════
// DECLARATION PAGE — navigate using a NEW tab (avoids detached frame)
// ══════════════════════════════════════════════════════

async function submitDeclaration(userId, { month, employees }) {
  const session = sessions.get(userId);
  if (!session || session.status !== 'logged_in') {
    throw new Error('Not logged in to RS.ge portal. Please login first.');
  }

  const { browser } = session;

  try {
    // Open declaration page in a fresh tab (avoids detached frame from login redirect)
    const declPage = await browser.newPage();
    await declPage.setViewport({ width: 1280, height: 800 });

    await declPage.goto(`${PORTAL_URL}/app/Declaration`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    // Check if we got redirected to login (session expired)
    const currentUrl = declPage.url();
    if (currentUrl.includes('Login')) {
      session.status = 'not_connected';
      await declPage.close();
      throw new Error('Session expired. Please login again.');
    }

    // Capture page structure
    const pageInfo = await declPage.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim().substring(0, 100),
        href: a.href, id: a.id,
      })).filter(l => l.text.length > 2 && l.text.length < 100).slice(0, 50);

      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden])')).map(el => ({
        type: el.type, name: el.name, id: el.id,
        placeholder: el.placeholder,
        visible: el.offsetParent !== null,
      })).filter(el => el.visible);

      const selects = Array.from(document.querySelectorAll('select')).map(el => ({
        name: el.name, id: el.id,
        options: Array.from(el.options).map(o => ({ value: o.value, text: o.text.substring(0, 80) })).slice(0, 20),
      }));

      const buttons = Array.from(document.querySelectorAll('button, input[type=submit], input[type=button]')).map(el => ({
        tag: el.tagName, type: el.type, name: el.name, id: el.id,
        text: (el.textContent || el.value || '').trim().substring(0, 80),
        visible: el.offsetParent !== null,
      })).filter(el => el.visible);

      return {
        url: location.href, title: document.title,
        bodyText: document.body.innerText.substring(0, 5000),
        links, inputs, selects, buttons,
      };
    });

    // Store declaration page reference
    session.declPage = declPage;

    console.log('Declaration page loaded. Clicking "ახალი დეკლარაცია" (New Declaration)...');

    // Click "ახალი დეკლარაცია" (New Declaration) button
    const clicked = await declPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const newDeclBtn = btns.find(b => b.textContent.includes('ახალი დეკლარაცია'));
      if (newDeclBtn) { newDeclBtn.click(); return true; }
      return false;
    });

    if (!clicked) {
      throw new Error('Could not find "ახალი დეკლარაცია" (New Declaration) button');
    }

    await delay(3000);

    // Capture the new declaration form/dialog
    const formInfo = await declPage.evaluate(() => {
      const bodyText = document.body.innerText.substring(0, 8000);

      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden])')).map(el => {
        const label = el.closest('label')?.textContent?.trim() ||
          el.parentElement?.querySelector('label')?.textContent?.trim() ||
          el.getAttribute('aria-label') || el.placeholder || '';
        return {
          type: el.type, name: el.name, id: el.id,
          placeholder: el.placeholder, label: label.substring(0, 80),
          visible: el.offsetParent !== null,
          className: el.className.substring(0, 80),
          tagPath: el.parentElement?.className?.substring(0, 80) || '',
        };
      }).filter(el => el.visible);

      const selects = Array.from(document.querySelectorAll('select')).map(el => {
        const label = el.closest('label')?.textContent?.trim() ||
          el.parentElement?.querySelector('label')?.textContent?.trim() || '';
        return {
          name: el.name, id: el.id, label: label.substring(0, 80),
          className: el.className.substring(0, 80),
          options: Array.from(el.options).map(o => ({ value: o.value, text: o.text.substring(0, 80) })).slice(0, 30),
          visible: el.offsetParent !== null,
        };
      }).filter(el => el.visible);

      const buttons = Array.from(document.querySelectorAll('button, input[type=submit], input[type=button]')).map(el => ({
        tag: el.tagName, type: el.type, id: el.id,
        text: (el.textContent || el.value || '').trim().substring(0, 80),
        className: el.className.substring(0, 80),
        visible: el.offsetParent !== null,
      })).filter(el => el.visible);

      // Check for modals/dialogs
      const dialogs = Array.from(document.querySelectorAll('[class*="modal"], [class*="dialog"], [class*="popup"], [role="dialog"]')).map(el => ({
        className: el.className.substring(0, 100),
        visible: el.offsetParent !== null,
        text: el.innerText?.substring(0, 500) || '',
      })).filter(el => el.visible);

      return { url: location.href, bodyText, inputs, selects, buttons, dialogs };
    });

    console.log('=== NEW DECLARATION FORM ===');
    console.log(JSON.stringify(formInfo, null, 2));
    console.log('=== END FORM ===');

    const screenshot = await declPage.screenshot({ encoding: 'base64' });

    return {
      status: 'form_opened',
      formInfo,
      screenshot: `data:image/png;base64,${screenshot}`,
      message: 'New declaration form opened. Capturing form structure...',
    };
  } catch (err) {
    throw new Error('Declaration page error: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

async function getSessionStatus(userId) {
  const session = sessions.get(userId);
  if (!session) return { status: 'not_connected' };
  return { status: session.status };
}

async function closeSession(userId) {
  const session = sessions.get(userId);
  if (session) {
    try { await session.browser.close(); } catch {}
    sessions.delete(userId);
  }
}

async function takeScreenshot(userId) {
  const session = sessions.get(userId);
  if (!session) throw new Error('No active session');
  const page = session.declPage || session.page;
  const screenshot = await page.screenshot({ encoding: 'base64' });
  return `data:image/png;base64,${screenshot}`;
}

module.exports = {
  startLogin,
  submit2FACode,
  submitDeclaration,
  getSessionStatus,
  closeSession,
  takeScreenshot,
};
