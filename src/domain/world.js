// Typemon MVP — world reducer (Slice 1). Pure: event -> state.
// No DOM, no Typejoy. Rail movement only (no tilemap in this slice).

export function newWorldState(routeId) {
  return { routeId, nodeIndex: 0, cleared: [], flags: {}, done: false };
}

// Move along the rail. dir is +1 (forward) or -1 (back). Clamped.
export function worldMove(state, dir, nodeCount) {
  const next = Math.min(nodeCount - 1, Math.max(0, state.nodeIndex + dir));
  return { ...state, nodeIndex: next };
}

// Commit a battle outcome at a node. Cleared nodes stay cleared; clearing
// the boss node ends the route.
export function commitNodeClear(state, nodeId, isBoss) {
  const cleared = state.cleared.includes(nodeId) ? state.cleared.slice() : state.cleared.concat([nodeId]);
  return { ...state, cleared, done: isBoss ? true : state.done };
}

export function isNodeCleared(state, nodeId) {
  return state.cleared.includes(nodeId);
}
