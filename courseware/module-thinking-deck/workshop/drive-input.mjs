// Independent input sources prevent releasing steering from cancelling thrust.
export function createDriveInput(){
 const held=new Map();
 return {
  press(source,action){if(['forward','reverse','thrust','brake','left','right'].includes(action))held.set(source,action);},
  release(source){held.delete(source);},
  clear(){held.clear();},
  read(){const actions=new Set(held.values());return {forward:actions.has('forward')&&!actions.has('reverse'),reverse:actions.has('reverse')&&!actions.has('forward'),thrust:actions.has('thrust'),brake:actions.has('brake'),steer:Number(actions.has('left'))-Number(actions.has('right')),holding:held.size>0};}
 };
}
