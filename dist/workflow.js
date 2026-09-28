import { OPS, stockType } from './core.js';
export function orderWorkflow(order, programming=false) {
  const steps=[];
  if(programming)steps.push({key:'cad',label:'CAD',title:'Complete CAD at the office',done:order.programmed,active:!order.programmed});
  const stock=stockType(order),materialKey=`material-${stock}`;
  steps.push({key:materialKey,label:stock.toUpperCase(),title:`Collect ${stock} stock`,done:order.started,active:order.programmed&&!order.started});
  for(const [index,key] of order.route.entries())steps.push({key,label:OPS[key].short,title:OPS[key].name,done:index<order.index,active:order.programmed&&order.started&&index===order.index});
  return steps;
}

// Shared stock silhouettes link each customer ticket to its physical bin.
export function stockIcon(type) {
  const drawing=type==='round'?'<ellipse cx="8" cy="16" rx="4" ry="7"/><path d="M8 9h16c5 0 5 14 0 14H8M24 9c-5 0-5 14 0 14"/>':type==='plate'?'<path d="m3 12 16-6 10 5-16 6zM3 12v5l10 6 16-7v-5M13 17v6"/>':'<path d="m5 10 11-6 11 6v13l-11 6-11-6zM5 10l11 6 11-6M16 16v13"/>';
  return `<svg class="stock-pictogram" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${drawing}</svg>`;
}
