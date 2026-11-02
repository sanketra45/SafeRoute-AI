export function parseBlackspotsResponse(payload) {
  // Flask currently returns the array directly; also accept a wrapped payload.
  const records = Array.isArray(payload) ? payload : payload?.blackspots
  if (!Array.isArray(records)) {
    throw new Error('Blackspot API returned an invalid response')
  }
  return records
}
