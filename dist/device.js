// Choose the interface from the device, not the window size or attached input.
// Keep this choice stable while a phone rotates or a tablet connects a mouse.
export function deviceInterface(device = {}) {
  if (device.userAgentData?.mobile === true) return 'mobile';
  const userAgent = String(device.userAgent || '');
  if (/Android|iPhone|iPad|iPod|Windows Phone|Kindle|Silk|PlayBook/i.test(userAgent)) return 'mobile';
  // iPadOS can identify itself as a Mac when requesting desktop websites.
  if (device.platform === 'MacIntel' && Number(device.maxTouchPoints) > 1) return 'mobile';
  return 'desktop';
}

// Only phones require the landscape layout. Tablets can use either orientation,
// including iPadOS devices that report a desktop Mac user agent.
export function isPhoneDevice(device = {}) {
  const userAgent = String(device.userAgent || '');
  if (/iPad|Tablet|Kindle|Silk|PlayBook/i.test(userAgent)) return false;
  if (device.platform === 'MacIntel' && Number(device.maxTouchPoints) > 1) return false;
  if (device.userAgentData?.mobile === true) return true;
  return /iPhone|iPod|Windows Phone/i.test(userAgent) || (
    /Android/i.test(userAgent) && /\bMobile\b/i.test(userAgent)
  );
}

// Phones open on Pocket Shift, the portrait mode, unless the player has chosen
// the full landscape game. The choice is kept on the device under its own key;
// tablets and desktops always open on the full game.
export const POCKET_OPT_OUT_KEY = 'chip-rush-pocket-opt-out';

export function pocketOptedOut(storage) {
  try { return storage?.getItem(POCKET_OPT_OUT_KEY) === '1'; } catch { return false; }
}

export function setPocketOptOut(storage, optedOut) {
  try {
    if (optedOut) storage?.setItem(POCKET_OPT_OUT_KEY, '1');
    else storage?.removeItem(POCKET_OPT_OUT_KEY);
  } catch {}
}

// The home route ('' or '#/') opens Pocket Shift on a phone that has not opted out.
// '#/pocket' always opens it; every other route (challenges, Open for Business)
// keeps the full game.
export function opensPocket(hash, { phone = false, storage } = {}) {
  const route = String(hash || '').replace(/^#\/?/, '');
  if (route === 'pocket') return true;
  return route === '' && phone && !pocketOptedOut(storage);
}
