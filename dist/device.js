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
