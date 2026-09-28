// Shared, original SVG pictograms for matching order cards to shop technology.
const MILL_DRAWING='<path d="M10 3h12v7H10zM13 10v6l3 4 3-4v-6M4 24h24v5H4zM7 21h18v3M14 13h4m-4 3h4"/>';
export const TECHNOLOGIES = {
  lathe:{name:'Turning · lathe',drawing:'<path d="M3 10h7v12H3zM10 13h7l4 3-4 3h-7M12 13l3 6M24 7h5v18h-5z"/>'},
  mill:{name:'Milling · CNC mill',drawing:MILL_DRAWING},
  edm:{name:'Wire EDM',drawing:'<path d="M6 4h20M6 28h20M16 4v24M4 12h8v9H4zM20 12h8v9h-8zM11 7h10M11 25h10M13 17l3-3 3 3-3 3z"/>'},
  im:{name:'Injection molding',drawing:'<path d="M3 11h10v17H3zM19 11h10v17H19zM13 16h2v7h-2m6-7h-2v7h2M13 3h6v5l-3 4-3-4zM16 12v5M6 15v9m20-9v9"/>'},
  sm:{name:'Sheet metal assembly',drawing:'<path d="M3 7h13v13h13v5H11V12H3zM16 7l5-3M29 20l2-4M21 4v12h10M16 20l5-4"/>'},
};

export function technologyIcon(key) {
  const tech=Object.hasOwn(TECHNOLOGIES,key)?TECHNOLOGIES[key]:null;
  return tech?`<svg class="technology-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${tech.drawing}</svg>`:'';
}

export function technologyBadges(keys) {
  return [...new Set(keys)].filter(key=>Object.hasOwn(TECHNOLOGIES,key)).map(key=>{
    const tech=TECHNOLOGIES[key];
    return `<span class="technology-badge tech-${key}" role="img" aria-label="${tech.name}" title="${tech.name}">${technologyIcon(key)}${['edm','im','sm'].includes(key)?`<span class="technology-code" aria-hidden="true">${key.toUpperCase()}</span>`:''}</span>`;
  }).join('');
}
