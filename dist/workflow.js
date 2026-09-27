import { OPS } from './core.js';
// The office prepares the order; only the material rack creates its physical part.
export function orderWorkflow(order, programming=false) {
  const steps=[];
  if(programming)steps.push({key:'cad',label:'CAD',title:'Complete CAD at the office',done:order.programmed,active:!order.programmed});
  steps.push({key:'material',label:'MATERIAL',title:'Collect the billet at Material',done:order.started,active:order.programmed&&!order.started});
  for(const [index,key] of order.route.entries())steps.push({key,label:OPS[key].short,title:OPS[key].name,done:index<order.index,active:order.programmed&&order.started&&index===order.index});
  return steps;
}
