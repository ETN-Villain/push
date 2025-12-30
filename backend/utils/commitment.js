const { keccak256, toUtf8Bytes } = "ethers";

/**
 * Creates a deterministic commitment hash for a team
 */
function makeTeamCommitment({
  gameId,
  player,
  teamData
}) {
const normalized = teamData.map(t => ({
  tokenId: t.tokenId.toString(),
  character: t.metadata?.name || `Token ${t.tokenId}`,
  background: t.metadata?.background || "Unknown",
  traits: t.metadata?.traits?.map(Number) || [0, 0, 0, 0, 0]
}));

  const payload = JSON.stringify({
    gameId,
    player: player.toLowerCase(),
    team: normalized
  });

  return keccak256(toUtf8Bytes(payload));
}