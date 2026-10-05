import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceInterface, isPhoneDevice } from '../dist/device.js';

test('phones and tablets select the mobile interface', () => {
  const devices = [
    {userAgentData:{mobile:true}},
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},
    {userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'},
    {userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile'},
    {userAgent:'Mozilla/5.0 (Linux; Android 15; Tablet)',userAgentData:{mobile:false}},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',maxTouchPoints:5},
    {userAgent:'Mozilla/5.0 (Linux; Android 11) Silk/120'},
  ];
  for (const device of devices) assert.equal(deviceInterface(device),'mobile',device.userAgent);
});

test('desktop and touchscreen laptops retain the desktop interface', () => {
  const devices = [
    {},
    {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:10,userAgentData:{mobile:false}},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',maxTouchPoints:0},
    {userAgent:'Mozilla/5.0 (X11; Linux x86_64)',maxTouchPoints:2},
    {userAgent:'Mozilla/5.0 (X11; CrOS x86_64)',maxTouchPoints:10},
  ];
  for (const device of devices) assert.equal(deviceInterface(device),'desktop',device.userAgent);
});

test('window size, orientation and attached pointing devices do not select the interface', () => {
  const phone={userAgent:'Mozilla/5.0 (Linux; Android 15)',maxTouchPoints:5};
  const laptop={userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:10};
  for (const size of [{width:390,height:844},{width:844,height:390},{width:1280,height:800}]) {
    for (const pointer of ['fine','coarse']) {
      assert.equal(deviceInterface({...phone,...size,pointer}),'mobile');
      assert.equal(deviceInterface({...laptop,...size,pointer}),'desktop');
    }
  }
});

test('phone identities require the phone layout independently of viewport size', () => {
  const phones = [
    {userAgentData:{mobile:true}},
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'},
    {userAgent:'Mozilla/5.0 (iPod touch; CPU iPhone OS 18_0 like Mac OS X)'},
    {userAgent:'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1) Mobile'},
    {userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile',userAgentData:{mobile:false}},
    {userAgent:'Mozilla/5.0 (Linux; Android 15)',userAgentData:{mobile:true}},
  ];
  for (const phone of phones) {
    for (const size of [{width:390,height:844},{width:844,height:390},{width:1280,height:800}]) {
      assert.equal(isPhoneDevice({...phone,...size}),true,phone.userAgent);
    }
  }
});

test('tablets retain both orientations even with a mobile client hint or mobile user-agent token', () => {
  const tablets = [
    {userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile',userAgentData:{mobile:true}},
    {userAgent:'Mozilla/5.0 (Linux; Android 15; Tablet) Mobile',userAgentData:{mobile:true}},
    {userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel Tablet)',userAgentData:{mobile:false}},
    {userAgent:'Mozilla/5.0 (Linux; Android 15)',userAgentData:{mobile:false}},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',maxTouchPoints:5,userAgentData:{mobile:true}},
    {userAgent:'Mozilla/5.0 (Linux; Android 11) Silk/120 Mobile',userAgentData:{mobile:true}},
    {userAgent:'Mozilla/5.0 (PlayBook) Mobile'},
    {userAgent:'Mozilla/5.0 (Kindle Fire) Mobile'},
  ];
  for (const tablet of tablets) assert.equal(isPhoneDevice(tablet),false,tablet.userAgent);
});

test('small desktop windows and touchscreen laptops never become phones', () => {
  const desktops = [
    {},
    {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:10,userAgentData:{mobile:false}},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',maxTouchPoints:0},
    {userAgent:'Mozilla/5.0 (X11; Linux x86_64)',maxTouchPoints:2},
    {userAgent:'Mozilla/5.0 (X11; CrOS x86_64)',maxTouchPoints:10},
  ];
  for (const desktop of desktops) {
    assert.equal(isPhoneDevice({...desktop,width:390,height:844,pointer:'coarse'}),false,desktop.userAgent);
  }
});
