const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('gameId') || localStorage.getItem('gameId');
const playerId = urlParams.get('playerId') || localStorage.getItem('playerId');
const API_BASE = localStorage.getItem('apiBase') || 'http://trinity-developments.co.uk';
const isHost = localStorage.getItem('isHost') === 'true';
const mrXStartStorageKey = gameId ? `mrXStartLocation:${gameId}` : 'mrXStartLocation';
const turnRoleStorageKey = gameId ? `turnRole:${gameId}` : 'turnRole';

// Stores Mr. X's most recently broadcast location so detectives can
// show a fallback marker when the server returns "hidden".
const mrXLastKnownKey = gameId ? `mrXLastKnown:${gameId}` : 'mrXLastKnown';
let mrXLastKnownLocation = null;

// Broadcast channel for instant cross-tab game sync.
const gameChannel = gameId ? new BroadcastChannel(`oay_game_${gameId}`) : null;

if (gameChannel) {
    gameChannel.onmessage = (event) => {
        const { type, isMrX, destination, state, message } = event.data;

        if (type === 'playerMoved') {
            // Local fallback for stale server turn state.
            setTurnRole(isMrX ? 'detective' : 'fugitive', 'broadcast-move');

            // If Mr. X just moved, save their real location so we can show
            // it on detectives' maps even though the server returns "hidden".
            if (isMrX && destination) {
                persistMrXLastKnown(destination);
                // Optimistically place the marker right now without
                // waiting for the server round-trip.
                placeMrXLastKnownMarker(destination);
            }
            loadPlayersFromServer();
            refreshMovementLog();
        }

        if (type === 'turnChanged') {
            const broadcastRole = normalizeTurnRole(state);
            if (broadcastRole) setTurnRole(broadcastRole, 'broadcast-turn');
            loadPlayersFromServer();
            refreshMovementLog();
        }

        if (type === 'gameEnded') {
            endGame(message || 'Game over.', false);
        }
    };
}

let currentGameState = 'open';
let turnRoleOverride = normalizeTurnRole(localStorage.getItem(turnRoleStorageKey));
let myRole = null; // 'fugitive' or 'detective'
let mrXPlayerId = null;
let resolveMrXPromise = null;
let mrXFallbackApplied = false;
let randomFallbackApplied = false;
let gameHasEnded = false;
let gameEndMessage = '';
let mrXDebugState = {
    playerId: null,
    gameId: null,
    apiBase: null,
    role: null,
    serverLocationRaw: null,
    serverLocationParsed: null,
    movesStartRaw: null,
    canonicalStart: null,
    currentPosition: null,
    movesFetchStatus: 'not-run'
};

function updateMrXDebug(partial = {}) {
    mrXDebugState = { ...mrXDebugState, ...partial };
    const panel = document.getElementById('mrxDebugPanel');
    if (!panel) return;

    const roleText = mrXDebugState.role || 'unknown';
    const playerIdText = mrXDebugState.playerId ?? 'n/a';
    const gameIdText = mrXDebugState.gameId ?? 'n/a';
    const apiBaseText = mrXDebugState.apiBase ?? 'n/a';
    const rawLocationText = mrXDebugState.serverLocationRaw ?? 'n/a';
    const parsedLocationText = mrXDebugState.serverLocationParsed ?? 'hidden/null';
    const movesStartRawText = mrXDebugState.movesStartRaw ?? 'n/a';
    const canonicalStartText = mrXDebugState.canonicalStart ?? 'n/a';
    const currentPosText = mrXDebugState.currentPosition ?? currentPosition ?? 'n/a';
    const movesFetchStatusText = mrXDebugState.movesFetchStatus ?? 'unknown';

    panel.innerHTML =
        `Mr. X Debug<br>` +
        `PlayerId: ${playerIdText} | GameId: ${gameIdText}<br>` +
        `API: ${apiBaseText}<br>` +
        `Role: ${roleText}<br>` +
        `Server /players location: ${rawLocationText}<br>` +
        `Parsed server location: ${parsedLocationText}<br>` +
        `Raw start (/moves): ${movesStartRawText}<br>` +
        `Canonical start (/moves): ${canonicalStartText}<br>` +
        `Client currentPosition: ${currentPosText}<br>` +
        `Moves fetch: ${movesFetchStatusText}`;
}

function normalizeTurnRole(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'fugitive' || normalized === 'detective') return normalized;
    return null;
}

function setTurnRole(role, source = 'unknown') {
    const normalized = normalizeTurnRole(role);
    if (!normalized) return;
    turnRoleOverride = normalized;
    currentGameState = normalized;
    localStorage.setItem(turnRoleStorageKey, normalized);
    console.log(`[Turn] Set to ${normalized} from ${source}`);
}

function getEffectiveTurnRole() {
    return normalizeTurnRole(turnRoleOverride) || normalizeTurnRole(currentGameState);
}

function endGame(message, shouldBroadcast = true) {
    if (gameHasEnded) return;

    gameHasEnded = true;
    gameEndMessage = message || 'Game over.';
    currentGameState = 'over';

    showError(gameEndMessage);

    const overlay = document.getElementById('gameOverOverlay');
    const title = document.getElementById('gameOverTitle');
    const description = document.getElementById('gameOverMessage');

    if (title) {
        title.textContent = 'Game Over';
    }

    if (description) {
        description.textContent = gameEndMessage;
    }

    if (overlay) {
        overlay.classList.remove('hidden');
    }

    const playerPiece = document.getElementById('playerPiece');
    if (playerPiece) {
        playerPiece.setAttribute('draggable', 'false');
        playerPiece.style.opacity = '0.5';
        playerPiece.style.cursor = 'not-allowed';
    }

    document.querySelectorAll('.ticket-button').forEach(btn => {
        btn.classList.remove('selected');
        btn.disabled = true;
    });

    selectedTicketType = null;

    if (shouldBroadcast && gameChannel) {
        gameChannel.postMessage({
            type: 'gameEnded',
            message: gameEndMessage
        });
    }
}

function checkCaptureWin(serverPlayers = []) {
    if (!Array.isArray(serverPlayers) || serverPlayers.length === 0) return false;

    const getPlayerId = (p) => parseInt(p.playerId ?? p.id, 10);
    const getPlayerName = (p) => p.playerName || p.name || `Player ${getPlayerId(p)}`;

    const fugitive = serverPlayers.find(p =>
        normalizeTurnRole(p.role || p.playerRole) === 'fugitive' ||
        (mrXPlayerId && getPlayerId(p) === parseInt(mrXPlayerId, 10))
    );

    if (!fugitive) return false;

    const fugitiveLocation = toLocationNumber(fugitive.location) ?? getMrXLastKnown();
    if (fugitiveLocation === null) return false;

    const catcher = serverPlayers.find(p =>
        getPlayerId(p) !== getPlayerId(fugitive) &&
        toLocationNumber(p.location) === fugitiveLocation
    );

    if (!catcher) return false;

    const catcherName = getPlayerName(catcher);
    endGame(`${catcherName} landed on Mr. X at location ${fugitiveLocation}. Game over.`);
    return true;
}

function checkImmediateDetectiveCapture(targetLocation) {
    if (myRole !== 'detective') return false;

    const detectiveLocation = toLocationNumber(targetLocation);
    const mrXLocation = getMrXLastKnown();

    if (detectiveLocation === null || mrXLocation === null) return false;
    if (detectiveLocation !== mrXLocation) return false;

    const name = document.getElementById('playerName')?.textContent || 'A player';
    endGame(`${name} landed on Mr. X at location ${mrXLocation}. Game over.`);
    return true;
}
// Map data loaded at runtime from "mini map.json".
        let mapData = null;

        
// Fetch map data from JSON and assign it to mapData.
        function loadMapData() {
            return fetch('mini map.json')
                .then(res => {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(data => {
                    mapData = data;
                    console.log('[Map] Loaded from JSON:',
                        mapData.locations.length, 'locations,',
                        mapData.connections.length, 'connections');
                })
                .catch(err => {
                    console.warn('[Map] Could not load mini map.json – check you are running via a local server (not file://). Error:', err.message);
                    // mapData stays null; initializeMapLocations will log a clear error
                });
        }
                // Map route colors to server ticket types.

        //server expects these ticket types exactly 
        const ticketTypeMap = {
            red: 'red',       // red routes = red tickets
            green: 'green',   // green routes = green tickets  
            blue: 'yellow',   // blue routes = yellow tickets
            black: 'black'    // black routes = black tickets
        };

// Ticket selection handler.

function selectTicket(ticketType) {
    document.querySelectorAll('.ticket-button').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Map server ticket names back to button IDs
    const ticketButtonIds = {
        red: 'redTicket',
        green: 'greenTicket', 
        yellow: 'yellowTicket',
           black: 'blackTicket',
           wild: 'wildTicket'
    };

    const buttonId = ticketButtonIds[ticketType];
    const ticketButton = document.getElementById(buttonId);

    if (selectedTicketType === ticketType) {
        selectedTicketType = null;
    } else {
        selectedTicketType = ticketType;
        if (ticketButton) ticketButton.classList.add('selected');
    }
}
// Client-side game state variables.
let currentPosition = 1;        // Will be randomized after mapData loads
let selectedTicketType = null;  // No ticket selected initially
let ticketCounts = {
    yellow: 3,   // for blue routes
    green: 5,    // for green routes
    red: 10,     // for red routes
        black: 6,    // for black routes
        wild: 2      // wildcard — move to any location, bypasses connections
};

function toLocationNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized || normalized === 'hidden') return null;
        const parsed = parseInt(normalized, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
}

function persistMrXStartLocation(location, source = 'unknown') {
    const parsed = toLocationNumber(location);
    if (parsed === null) return;

    localStorage.setItem(mrXStartStorageKey, String(parsed));
    console.log(`[MrX] Saved start location ${parsed} from ${source}`);
}

function getStoredMrXStartLocation() {
    return toLocationNumber(localStorage.getItem(mrXStartStorageKey));
}

// Mr. X last-known location helpers for hidden server positions.
function persistMrXLastKnown(location) {
    const parsed = toLocationNumber(location);
    if (parsed === null) return;
    mrXLastKnownLocation = parsed;
    localStorage.setItem(mrXLastKnownKey, String(parsed));
    console.log(`[MrX] Last-known location saved: ${parsed}`);
}

function getMrXLastKnown() {
    if (mrXLastKnownLocation !== null) return mrXLastKnownLocation;
    return toLocationNumber(localStorage.getItem(mrXLastKnownKey));
}

function placeMrXLastKnownMarker(location) {
    // Remove any stale last-known marker first.
    const existing = document.getElementById('mrXLastKnownPiece');
    if (existing) existing.remove();

    if (!mapData || location === null) return;

    const loc = mapData.locations.find(l => l.location === location);
    if (!loc) return;

    const piece = document.createElement('div');
    piece.id = 'mrXLastKnownPiece';
    piece.className = 'other-player-piece mrx-last-known';
    piece.style.left = `${loc.xPos}%`;
    piece.style.top = `${loc.yPos}%`;
    piece.style.backgroundColor = '#000';
    piece.style.color = '#fff';
    piece.style.border = '2px dashed #ff0';
    piece.style.opacity = '0.75';
    piece.title = `Mr. X last seen at location ${location}`;
    piece.textContent = '?';

    document.getElementById('locationMarkers').appendChild(piece);
}

function getPlayerRandomStartStorageKey(targetPlayerId) {
    return gameId ? `randomStart:${gameId}:${targetPlayerId}` : `randomStart:${targetPlayerId}`;
}

function getStoredRandomStart(targetPlayerId) {
    return toLocationNumber(localStorage.getItem(getPlayerRandomStartStorageKey(targetPlayerId)));
}

function persistRandomStart(targetPlayerId, location) {
    const parsed = toLocationNumber(location);
    if (parsed === null) return;
    localStorage.setItem(getPlayerRandomStartStorageKey(targetPlayerId), String(parsed));
}

function hashStringToSeed(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function pickDeterministicRandomStart(occupiedLocations = []) {
    if (!mapData || !Array.isArray(mapData.locations) || mapData.locations.length === 0) {
        return null;
    }

    const occupiedSet = new Set(
        occupiedLocations
            .map(toLocationNumber)
            .filter(loc => loc !== null)
    );

    const candidates = mapData.locations
        .map(loc => loc.location)
        .filter(loc => !occupiedSet.has(loc));

    const pool = candidates.length > 0 ? candidates : mapData.locations.map(loc => loc.location);

    // Use a truly random index so players spread across the full map.
    return pool[Math.floor(Math.random() * pool.length)];
}

function applyRandomFallbackStart(players = []) {
    if (myRole === 'fugitive') {
        return;
    }

    const meId = parseInt(playerId, 10);
    const storedStart = getStoredRandomStart(meId);
    const occupied = Array.isArray(players) ? players.map(p => p.location) : [];
    const chosenStart = storedStart ?? pickDeterministicRandomStart(occupied);

    if (chosenStart === null) return;

    persistRandomStart(meId, chosenStart);
    currentPosition = chosenStart;
    updatePlayerPiecePosition();
    highlightCurrentLocation();
    document.getElementById('currentPosition').textContent = currentPosition;

    if (myRole === 'fugitive') {
        persistMrXStartLocation(chosenStart, 'random-fallback');
    }

    randomFallbackApplied = true;
}

function renderMovementLog(startLocation, moves = [], statusMessage = '') {
    const movementLog = document.getElementById('movementLog');
    if (!movementLog) return;

    movementLog.innerHTML = '';

    if (statusMessage) {
        const status = document.createElement('div');
        status.textContent = statusMessage;
        status.style.fontStyle = 'italic';
        status.style.marginBottom = '8px';
        movementLog.appendChild(status);
    }

    const startLine = document.createElement('div');
    startLine.style.fontWeight = 'bold';
    startLine.style.marginBottom = '6px';
    startLine.textContent = `Start: ${startLocation === null ? 'Unknown' : startLocation}`;
    movementLog.appendChild(startLine);

    if (!Array.isArray(moves) || moves.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No moves yet.';
        movementLog.appendChild(empty);
        return;
    }

    moves.forEach(move => {
        const moveLine = document.createElement('div');
        const round = move.round ?? '?';
        const ticket = typeof move.ticket === 'string' ? move.ticket.toUpperCase() : 'UNKNOWN';
        const destination = move.destination ?? 'hidden';
        moveLine.textContent = `R${round} | ${ticket} -> ${destination}`;
        movementLog.appendChild(moveLine);
    });

    movementLog.scrollTop = movementLog.scrollHeight;
}

function applyMrXFallbackIfNeeded() {
    if (myRole !== 'fugitive' || mrXFallbackApplied) return;

    const fallbackStart = getStoredMrXStartLocation();
    if (fallbackStart === null) return;

    currentPosition = fallbackStart;
    updatePlayerPiecePosition();
    highlightCurrentLocation();
    document.getElementById('currentPosition').textContent = currentPosition;
    mrXFallbackApplied = true;
    showError('Using saved Mr. X start location while waiting for server position.');
}

async function resolveMrXPlayerId(serverPlayers = []) {
    if (mrXPlayerId) return mrXPlayerId;
    if (!Array.isArray(serverPlayers) || serverPlayers.length === 0) return null;
    if (resolveMrXPromise) return resolveMrXPromise;

    resolveMrXPromise = (async () => {
        const directRoleMatch = serverPlayers.find(p => p.role === 'fugitive' || p.playerRole === 'fugitive');
        if (directRoleMatch?.playerId) {
            mrXPlayerId = parseInt(directRoleMatch.playerId, 10);
            return mrXPlayerId;
        }

        const detailResults = await Promise.all(
            serverPlayers.map(async p => {
                try {
                    const response = await fetch(`${API_BASE}/players/${p.playerId}`);
                    if (!response.ok) return null;
                    return response.json();
                } catch {
                    return null;
                }
            })
        );

        const fugitive = detailResults.find(p => p && p.role === 'fugitive');
        if (fugitive?.playerId) {
            mrXPlayerId = parseInt(fugitive.playerId, 10);
            return mrXPlayerId;
        }

        // Optional fallback requested by team discussion: host can act as Mr. X anchor.
        if (isHost && playerId) {
            mrXPlayerId = parseInt(playerId, 10);
            return mrXPlayerId;
        }

        return null;
    })();

    try {
        return await resolveMrXPromise;
    } finally {
        resolveMrXPromise = null;
    }
}

async function refreshMovementLog() {
    const movementLog = document.getElementById('movementLog');
    if (!movementLog) return;

    const myId = parseInt(playerId, 10);
    const targetPlayerId = myRole === 'fugitive' ? myId : mrXPlayerId;

    if (!targetPlayerId) {
        renderMovementLog(getStoredMrXStartLocation(), [], 'Waiting for Mr. X assignment...');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/players/${targetPlayerId}/moves`);
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        const apiStart = toLocationNumber(data.startLocation);
        if (apiStart !== null) {
            persistMrXStartLocation(apiStart, 'moves-api');
        }

        const effectiveStart = apiStart ?? getStoredMrXStartLocation();
        renderMovementLog(effectiveStart, data.moves || []);
    } catch (error) {
        console.error('Failed to load movement log:', error);
        const fallbackStart = getStoredMrXStartLocation();
        renderMovementLog(fallbackStart, [], 'Movement history unavailable, using saved Mr. X data.');
        applyMrXFallbackIfNeeded();
    }
}

function chooseRandomStartPosition() {
    if (!mapData || !Array.isArray(mapData.locations) || mapData.locations.length === 0) {
        return;
    }

    const randomIndex = Math.floor(Math.random() * mapData.locations.length);
    currentPosition = mapData.locations[randomIndex].location;
}

// Return transport flags for a location.
function getLocationTransports(locationId) {
    const transports = { yellow: false, green: false, red: false, black: false };
    
    mapData.connections.forEach(conn => {
        if (conn.from === locationId || conn.to === locationId) {
            const ticketType = ticketTypeMap[conn.colour];
            if (ticketType) transports[ticketType] = true;
        }
    });
    return transports;
}

// Return marker CSS class from available transport types.
function getMarkerColorClass(transports) {
    const { yellow, green, red, black } = transports;
    
    if (yellow && green && red && black) return 'all-transport';
    if (yellow && green && red) return 'taxi-ebike-bus';
    if (yellow && green && black) return 'taxi-ebike-boat';
    if (yellow && red && black) return 'taxi-bus-boat';
    if (green && red && black) return 'ebike-bus-boat';
    if (yellow && green) return 'taxi-ebike';
    if (yellow && red) return 'taxi-bus';
    if (yellow && black) return 'taxi-boat';
    if (green && red) return 'ebike-bus';
    if (green && black) return 'ebike-boat';
    if (red && black) return 'bus-boat';
    if (yellow) return 'taxi-only';
    if (green) return 'ebike-only';
    if (red) return 'bus-only';
    if (black) return 'boat-only';
    return '';
}

// Initialize map markers, interactions, and player position.
function initializeMapLocations() {
    const markersContainer = document.getElementById('locationMarkers');
    
    // Create a marker for each location in the map data
    mapData.locations.forEach(loc => {
        const marker = document.createElement('div');
        marker.className = 'location-marker';
        marker.dataset.location = loc.location;  // Store location number
        marker.style.left = `${loc.xPos}%`;      // Position as percentage
        marker.style.top = `${loc.yPos}%`;       // Position as percentage
        marker.textContent = loc.location;       // Display location number
        
        // Get available transports and apply color class
        const transports = getLocationTransports(loc.location);
        const colorClass = getMarkerColorClass(transports);
        if (colorClass) {
            marker.classList.add(colorClass);
        }
        
        // Add drag and drop event listeners
        marker.addEventListener('dragover', handleDragOver);
        marker.addEventListener('drop', handleDrop);
        marker.addEventListener('dragenter', handleDragEnter);
        marker.addEventListener('dragleave', handleDragLeave);
        
        // Allow clicking as alternative to drag/drop
        marker.addEventListener('click', () => handleLocationClick(loc.location));
        
        markersContainer.appendChild(marker);
    });
    
    // Position player piece at starting location
    updatePlayerPiecePosition();
    highlightCurrentLocation();
}

// Move the player piece to the current map location.
function updatePlayerPiecePosition() {
    const loc = mapData.locations.find(l => l.location === currentPosition);
    const playerPiece = document.getElementById('playerPiece');
    if (loc && playerPiece) {
        // Position as percentage (same as markers)
        playerPiece.style.left = `${loc.xPos}%`;
        playerPiece.style.top = `${loc.yPos}%`;
    }
    
}

// Highlight the player's current location marker.
function highlightCurrentLocation() {
    document.querySelectorAll('.location-marker').forEach(marker => {
        marker.classList.remove('current');
        if (parseInt(marker.dataset.location) === currentPosition) {
            marker.classList.add('current');
        }
    });
}

// Connection and ticket validation helpers.

// Check if there's a direct connection between two locations
// Returns the connection object if found, undefined otherwise
function getValidConnection(from, to) {
    return mapData.connections.find(conn => 
        (conn.from === from && conn.to === to) || 
        (conn.to === from && conn.from === to)
    );
}

// Check if the selected ticket type can be used on this connection
// Returns true if ticket matches the route color
function canMoveWithTicket(connection, ticketType) {
    const requiredTicket = ticketTypeMap[connection.colour];
    return requiredTicket === ticketType;
}

// Get list of all valid destinations from current position
// Only returns locations reachable with currently selected ticket
function getValidDestinations() {
    if (!selectedTicketType) return [];
    
    return mapData.connections
        .filter(conn => {
            const isFromCurrent = conn.from === currentPosition || conn.to === currentPosition;
            const canUseTicket = canMoveWithTicket(conn, selectedTicketType);
            return isFromCurrent && canUseTicket;
        })
        .map(conn => conn.from === currentPosition ? conn.to : conn.from);
}

// Show a temporary error toast.
function showError(message) {
    // Remove any existing toast first
    const existing = document.querySelector('.error-toast');
    if (existing) existing.remove();
    
    // Create and display new toast
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => toast.remove(), 3000);
}

// Drag-and-drop handlers for moving the player piece.

// Called when player starts dragging their piece
function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', currentPosition);
    e.target.classList.add('dragging');
}

// Called when drag operation ends
function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

// Required for drop zones - prevents default behavior
function handleDragOver(e) {
    e.preventDefault();
}

// When piece enters a location marker, show valid/invalid state
function handleDragEnter(e) {
    const targetLocation = parseInt(e.target.dataset.location);
    if (targetLocation === currentPosition) return;  // Can't drop on current location
    
    // Wild ticket can go anywhere.
    if (selectedTicketType === 'wild') {
        e.target.classList.add('valid-drop');
        return;
    }

    const connection = getValidConnection(currentPosition, targetLocation);

    // Standard tickets require a connected route with matching color.
    if (connection && selectedTicketType && canMoveWithTicket(connection, selectedTicketType)) {
        e.target.classList.add('valid-drop');
    } else {
        e.target.classList.add('invalid-drop');
    }
}

// When piece leaves a location marker, remove highlight
function handleDragLeave(e) {
    e.target.classList.remove('valid-drop', 'invalid-drop');
}

// When piece is dropped on a location marker
function handleDrop(e) {
    e.preventDefault();
    e.target.classList.remove('valid-drop', 'invalid-drop');
    
    const targetLocation = parseInt(e.target.dataset.location);
    attemptMove(targetLocation);
}

// Click-to-move alternative to drag and drop.
function handleLocationClick(targetLocation) {
    if (targetLocation === currentPosition) return;  // Can't move to same spot
    attemptMove(targetLocation);
}

// Validate and process a requested move.
function attemptMove(targetLocation) {
    if (gameHasEnded) {
        showError(gameEndMessage || 'Game is over.');
        return;
    }

    // Turn ownership is enforced by the server (player.turn) so
    // client role state cannot incorrectly block valid moves.
    const connection = getValidConnection(currentPosition, targetLocation);
    
    // VALIDATION 1: Must have a ticket selected
    if (!selectedTicketType) {
        showError('Select a ticket type first!');
        return;
    }

    // Wild ticket bypasses route checks and can move anywhere.
    if (selectedTicketType === 'wild') {
        if (ticketCounts.wild <= 0) {
            showError('No Wild tickets remaining!');
            return;
        }
        executeWildMove(targetLocation, 'wild');
        return;
    }

    // Standard tickets must follow map routes.
    if (!connection) {
        showError('No direct connection to this location!');
        return;
    }

    if (!canMoveWithTicket(connection, selectedTicketType)) {
        showError(`Cannot use ${selectedTicketType} on this route. Need ${ticketTypeMap[connection.colour]}.`);
        return;
    }

    // VALIDATION 2: Must have tickets remaining
    if (ticketCounts[selectedTicketType] <= 0) {
        showError('No tickets remaining!');
        return;
    }
    
    // Standard move flow
    executeMove(targetLocation);
}

// Wild ticket move handler with server-first, local-fallback behavior.
    function executeWildMove(newPosition, ticketType = 'wild') {
        const parsedDestination = parseInt(newPosition, 10);
        const serverTicket = ticketType;

        selectedTicketType = null;
        document.querySelectorAll('.ticket-button').forEach(btn => btn.classList.remove('selected'));

        function applyLocally() {
            ticketCounts[ticketType]--;
            updateTicketDisplay();
            currentPosition = parseInt(newPosition);
            updatePlayerPiecePosition();
            highlightCurrentLocation();
            document.getElementById('currentPosition').textContent = currentPosition;

            if (checkImmediateDetectiveCapture(currentPosition)) return;

            setTurnRole(myRole === 'fugitive' ? 'detective' : 'fugitive', 'local-move');

            if (myRole === 'fugitive') {
                persistMrXStartLocation(currentPosition, 'wild-move');
                persistMrXLastKnown(currentPosition);
            }

            if (gameChannel) {
                gameChannel.postMessage({
                    type: 'playerMoved',
                    fromPlayerId: parseInt(playerId),
                    isMrX: myRole === 'fugitive',
                    destination: parsedDestination,
                    ticket: ticketType
                });
            }

            loadPlayersFromServer();
            refreshMovementLog();
        }

        // Try server sync with the route's actual color ticket.
        // If the server rejects (turn/occupancy/etc), apply locally anyway.
        fetch(`${API_BASE}/players/${playerId}/moves`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameID: parseInt(gameId),
                ticket: serverTicket,
                destination: parsedDestination
            })
        })
        .then(response => response.json().then(body => ({ ok: response.ok, body })))
        .then(({ ok, body }) => {
            if (ok) {
                console.log(`[Move] Server accepted move with ${serverTicket}:`, body);
            } else {
                console.warn('[Move] Server rejected, applying locally:', body.message);
            }
            applyLocally();
        })
        .catch(err => {
            console.warn('[Move] Server unreachable, applying locally:', err.message);
            applyLocally();
        });

        console.log(`[Move] Moving to ${parsedDestination} using ${ticketType}`);
    }

// Execute a standard move and sync it with the server.
function executeMove(newPosition) {
    const usedTicket = selectedTicketType;

    // Reset ticket selection immediately for responsiveness
    selectedTicketType = null;
    document.querySelectorAll('.ticket-button').forEach(btn => btn.classList.remove('selected'));

    // Send move to server
    fetch(`${API_BASE}/players/${playerId}/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "gameID": parseInt(gameId),
            "ticket": usedTicket,
            "destination": parseInt(newPosition)
        })
    })
    .then(response => {
        return response.json().then(body => {
            if (!response.ok) {
                console.error('Server rejected move:', JSON.stringify(body));
                throw new Error(`Server error: ${response.status} - ${body.message}`);
            }
            return body;
        });
    })
    .then(data => {
        console.log('Move confirmed:', data);
        ticketCounts[usedTicket]--;
        updateTicketDisplay();

        // Use the server-confirmed location; fall back to requested destination
        // if the API response doesn't include it.
        const confirmedLocation = (data.location != null)
            ? parseInt(data.location, 10)
            : parseInt(newPosition, 10);

        currentPosition = confirmedLocation;
        updatePlayerPiecePosition();
        highlightCurrentLocation();
        document.getElementById('currentPosition').textContent = confirmedLocation;

        if (checkImmediateDetectiveCapture(confirmedLocation)) return;

        if (myRole === 'fugitive') {
            persistMrXStartLocation(confirmedLocation, 'confirmed-move');
            persistMrXLastKnown(confirmedLocation);
        }

        loadPlayersFromServer(); // refresh all positions from server
        refreshMovementLog();

        // Notify all other open tabs/windows immediately so they don't
        // have to wait for their next 3-second poll.
        // isMrX lets receiving tabs know they should store this as the
        // last-known Mr. X location (since the server returns "hidden").
        if (gameChannel) {
            gameChannel.postMessage({
                type: 'playerMoved',
                fromPlayerId: parseInt(playerId),
                isMrX: myRole === 'fugitive',
                destination: confirmedLocation,
                ticket: usedTicket
            });
        }
    })
    .catch(error => {
        console.error('Move failed:', error);
        const cleanedMessage = error.message
            .replace('Server error: 400 - ', '')
            .replace('Server error: 403 - ', '')
            .replace('Server error: 404 - ', '');
        showError(cleanedMessage || 'Move failed.');
        selectedTicketType = usedTicket; // restore ticket
    });

    console.log(`Attempting move to ${newPosition} using ${usedTicket}`);
}

// Make Move button handler.
function makeMove() {
    showError('Drag your piece to a location or click a destination!');
}

// Refresh ticket counts shown on the ticket buttons.
function updateTicketDisplay() {
    document.querySelector('#redTicket .ticket-count').textContent = ticketCounts.red;
    document.querySelector('#greenTicket .ticket-count').textContent = ticketCounts.green;
    document.querySelector('#yellowTicket .ticket-count').textContent = ticketCounts.yellow;
    document.querySelector('#blackTicket .ticket-count').textContent = ticketCounts.black;
        document.querySelector('#wildTicket .ticket-count').textContent = ticketCounts.wild;
}

// Open and close the larger map modal.
function viewLargerMap() {
    document.getElementById('mapModal').style.display = 'flex';
}

function closeMapModal() {
    document.getElementById('mapModal').style.display = 'none';
}

// Close modal when clicking outside the image (on the dark overlay)
window.onclick = function(event) {
    const modal = document.getElementById('mapModal');
    if (event.target === modal) {
        closeMapModal();
    }
}
// Initialize map state and UI when the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
    updateMrXDebug({
        currentPosition,
        playerId: playerId || null,
        gameId: gameId || null,
        apiBase: API_BASE
    });
    loadMapData().then(() => {
    initializeMapLocations();
    loadMyPlayerData();
    loadPlayersFromServer();
    setInterval(loadPlayersFromServer, 3000);
    setInterval(refreshMovementLog, 4000);
});
    
    // Set up drag events for the player piece
    const playerPiece = document.getElementById('playerPiece');
    playerPiece.addEventListener('dragstart', handleDragStart);
    playerPiece.addEventListener('dragend', handleDragEnd);
    
    // Show starting position in the UI
    document.getElementById('currentPosition').textContent = currentPosition;
    
    // === COORDINATE HELPER ===
    // Click on the map to see and log percentage coordinates
    // Use these values to position your markers correctly
    const gameMap = document.getElementById('gameMap');
    // const coordDisplay = document.getElementById('coordDisplay');
    
    // gameMap.addEventListener('click', (e) => {
    //     const rect = gameMap.getBoundingClientRect();
    //     const xPercent = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    //     const yPercent = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        
    //     coordDisplay.innerHTML = `xPos: ${xPercent}, yPos: ${yPercent}<br><small>Ctrl+Shift+I to see console log</small>`;
    //     console.log(`{ location: X, xPos: ${xPercent}, yPos: ${yPercent}, name: "NAME" },`);
    // });
    
    // gameMap.addEventListener('mousemove', (e) => {
    //     const rect = gameMap.getBoundingClientRect();
    //     const xPercent = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    //     const yPercent = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
    //     coordDisplay.textContent = `Hover: ${xPercent}%, ${yPercent}%`;
    // });
});

function loadPlayersFromServer() {
    if (gameHasEnded) return;

    fetch(`${API_BASE}/games/${gameId}`)
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (gameHasEnded) return;

        const previousGameState = currentGameState;
        currentGameState = (data.state || '').toLowerCase();

        // Prefer server turn role when it is explicit; otherwise keep local fallback.
        const serverTurnRole = normalizeTurnRole(currentGameState);
        if (serverTurnRole) {
            setTurnRole(serverTurnRole, 'server-game-state');
        }
        
        const players = data.players.map(player => ({
            id: player.playerId,
            name: player.playerName,
            colour: player.colour,
            location: player.location
        }));

        loadMyPosition(players);
        updateOtherPlayersOnMap(players);

        // Broadcast the turn change so all other tabs flip their turn indicator immediately
        if (gameChannel && currentGameState !== previousGameState) {
            gameChannel.postMessage({ type: 'turnChanged', state: getEffectiveTurnRole() || currentGameState });
        }

        resolveMrXPlayerId(data.players)
            .then(() => {
                const mrXOnBoard = players.find(p => p.id === mrXPlayerId);
                const visibleMrXLocation = toLocationNumber(mrXOnBoard?.location);

                if (visibleMrXLocation !== null) {
                    // Server gave us a real location — save it so detectives
                    // can use it as the fallback even after it goes hidden.
                    persistMrXStartLocation(visibleMrXLocation, 'game-state');
                    persistMrXLastKnown(visibleMrXLocation);
                }

                // Run capture check only after Mr. X identity/location fallback is resolved.
                if (checkCaptureWin(data.players)) return;

                // Re-render now that mrXPlayerId is resolved so the
                // "hidden → last-known" branch in updateOtherPlayersOnMap
                // can actually find Mr. X's entry and place the marker.
                updateOtherPlayersOnMap(players);
                refreshMovementLog();
            })
            .catch(err => console.warn('Could not resolve Mr. X player ID:', err));
    })
    .catch(error => console.error('Failed to load players:', error));
}
function updateOtherPlayersOnMap(players) {
    // Remove all existing other-player pieces first
    document.querySelectorAll('.other-player-piece').forEach(piece => piece.remove());

    let mrXRendered = false;

    players.forEach(player => {
        // Skip the current player (they have their own piece)
        if (player.id === parseInt(playerId)) return;

        // Find location data for this player's position
        const loc = mapData.locations.find(l => l.location === parseInt(player.location));

        if (!loc) {
            // Location is "Hidden" or invalid — this is expected for Mr. X.
            // Fall back to the last-known location received via BroadcastChannel
            // or localStorage so we can still show them on the board.
            if (player.id === mrXPlayerId) {
                const lastKnown = getMrXLastKnown();
                if (lastKnown !== null) {
                    placeMrXLastKnownMarker(lastKnown);
                    mrXRendered = true;
                }
            }
            return;
        }

        // Create a piece for this player
        const piece = document.createElement('div');
        piece.className = 'other-player-piece';
        piece.style.left = `${loc.xPos}%`;
        piece.style.top = `${loc.yPos}%`;
        piece.style.backgroundColor = player.colour;
        piece.title = player.name; // tooltip on hover
        piece.textContent = player.name.charAt(0); // first letter of name

        document.getElementById('locationMarkers').appendChild(piece);

        if (player.id === mrXPlayerId) mrXRendered = true;
    });

    // If Mr. X is not in the players list at all yet, still show last known
    if (!mrXRendered && mrXPlayerId) {
        const lastKnown = getMrXLastKnown();
        if (lastKnown !== null) {
            placeMrXLastKnownMarker(lastKnown);
        }
    }
}

function loadMyPosition(players) {
    const me = players.find(p => p.id === parseInt(playerId));
    const myVisibleLocation = toLocationNumber(me?.location);

    updateMrXDebug({
        serverLocationRaw: me?.location ?? mrXDebugState.serverLocationRaw,
        serverLocationParsed: myVisibleLocation
    });

    if (myVisibleLocation !== null) {
        currentPosition = myVisibleLocation;
        updateMrXDebug({ currentPosition });
        updatePlayerPiecePosition();
        highlightCurrentLocation();
        document.getElementById('currentPosition').textContent = currentPosition;
        mrXFallbackApplied = false;
        randomFallbackApplied = false;

        if (myRole === 'fugitive') {
            persistMrXStartLocation(currentPosition, 'my-position');
            // Keep last-known in sync whenever the server confirms Mr. X's position.
            persistMrXLastKnown(currentPosition);
        }
        return;
    }

    applyMrXFallbackIfNeeded();

    // If Mr. X is the fugitive and their location is hidden on the server,
    // use their stored last-known real location so their piece shows correctly.
    if (myVisibleLocation === null && myRole === 'fugitive') {
        const lastKnown = getMrXLastKnown();
        if (lastKnown !== null) {
            currentPosition = lastKnown;
            updateMrXDebug({ currentPosition });
            updatePlayerPiecePosition();
            highlightCurrentLocation();
            document.getElementById('currentPosition').textContent = currentPosition;
            mrXFallbackApplied = true;
            return;
        }
    }

    if (myVisibleLocation === null && myRole === 'fugitive') {
        showError('Waiting for canonical Mr. X start location from server...');
        return;
    }

    if (myVisibleLocation === null && !mrXFallbackApplied && !randomFallbackApplied) {
        applyRandomFallbackStart(players);
        showError('Using randomized start location while waiting for server assignment.');
    }
}

function loadMyPlayerData() {
    fetch(`${API_BASE}/players/${playerId}`)
    .then(res => res.json())
    .then(data => {
        // Update ticket counts from server
        ticketCounts.yellow = data.yellow;
        ticketCounts.green = data.green;
        ticketCounts.red = data.red;
        ticketCounts.black = data.black;
        updateTicketDisplay();

        // Store normalized role so fugitive/detective checks are reliable
        // even when backend returns capitalized values like "Fugitive".
        myRole = normalizeTurnRole(data.role) || (typeof data.role === 'string' ? data.role.toLowerCase() : data.role);
        updateMrXDebug({
            role: myRole,
            serverLocationRaw: data.location,
            serverLocationParsed: toLocationNumber(data.location)
        });

        if (myRole === 'fugitive') {
            mrXPlayerId = parseInt(playerId, 10);
            const startLoc = data.startLocation || data.location;
            persistMrXStartLocation(startLoc, 'player-data');

            // Some backends return Mr. X location as "Hidden" in /players.
            // Pull canonical startLocation from /players/:id/moves so client
            // movement uses the real origin node instead of random fallback.
            fetch(`${API_BASE}/players/${playerId}/moves`)
                .then(res => res.ok ? res.json() : null)
                .then(movesData => {
                    updateMrXDebug({
                        movesStartRaw: movesData?.startLocation ?? null,
                        movesFetchStatus: movesData ? 'ok' : 'non-200-or-empty'
                    });
                    const canonicalStart = toLocationNumber(movesData?.startLocation);
                    updateMrXDebug({ canonicalStart });
                    if (canonicalStart !== null) {
                        persistMrXStartLocation(canonicalStart, 'moves-start');
                        persistMrXLastKnown(canonicalStart);

                        const hiddenFromPlayerEndpoint = toLocationNumber(data.location) === null;
                        if (hiddenFromPlayerEndpoint) {
                            currentPosition = canonicalStart;
                            updateMrXDebug({ currentPosition });
                            updatePlayerPiecePosition();
                            highlightCurrentLocation();
                            document.getElementById('currentPosition').textContent = currentPosition;
                        }

                        if (gameChannel) {
                            gameChannel.postMessage({
                                type: 'playerMoved',
                                fromPlayerId: parseInt(playerId),
                                isMrX: true,
                                destination: canonicalStart,
                                ticket: null
                            });
                        }
                    }
                })
                .catch(err => {
                    updateMrXDebug({ movesFetchStatus: `error: ${err?.message || err}` });
                    console.warn('Failed to load canonical Mr. X start:', err);
                });

            // Save and broadcast Mr. X's starting location immediately so
            // any already-open detective tabs can display the marker
            // without waiting for Mr. X to make their first move.
            const startLocNum = toLocationNumber(startLoc);
            if (startLocNum !== null) {
                persistMrXLastKnown(startLocNum);
                if (gameChannel) {
                    gameChannel.postMessage({
                        type: 'playerMoved',
                        fromPlayerId: parseInt(playerId),
                        isMrX: true,
                        destination: startLocNum,
                        ticket: null
                    });
                }
            }
        }

        // Update name display
        document.getElementById('playerName').textContent = data.playerName;

        refreshMovementLog();
    })
    .catch(err => console.error('Failed to load player data:', err));
}

// let selectedTicketType = null;
// let ticketCounts = {
//     bus: 5,
//     ebike: 3,
//     taxi: 8
// };

// function selectTicket(ticketType) {
//     // Remove selection from all tickets
//     document.querySelectorAll('.ticket-button').forEach(btn => {
//         btn.classList.remove('selected');
//     });
    
//     // Select the clicked ticket
//     const ticketButton = document.getElementById(ticketType + 'Ticket');
    
//     if (selectedTicketType === ticketType) {
//         // Deselect if clicking the same ticket
//         selectedTicketType = null;
//     } else {
//         // Select new ticket
//         selectedTicketType = ticketType;
//         ticketButton.classList.add('selected');
//     }
// }

// //Updated movement function to send move request to server - Ethan
// async function makeMove() { 
//     if (!selectedTicketType) { 
//         alert("Please select a ticket type first!"); 
//         return; 
//     } 
//     const destination = prompt("Enter destination location:"); 
//     if (!destination) return;
//     const playerId = window.currentPlayerId; 
//     const gameID = window.currentGameId; 
    
//     const response = await fetch(`http://trinity-developments.co.uk/players/1827/moves`, { 
//         method: "POST", 
//         headers: { "Content-Type": "application/json" }, 
//         body: JSON.stringify({ 
//             gameID, 
//             ticket: selectedTicketType, 
//             destination: parseInt(destination)
//          }) 
//     }); const data = await response.json(); 
    
//     if (!response.ok) { 
//         alert(data.message); 
//         return; 
//     } 

//     document.getElementById("currentPosition").textContent = data.location;


//     addMovementLog(selectedTicketType, destination, data.location);

//     ticketCounts[selectedTicketType]--;
//     updateTicketDisplay();

//     document.querySelectorAll('.ticket-button').forEach(btn => btn.classList.remove('selected'));
//     selectedTicketType = null;  
        
//     alert("Move Successful"); 
// }

// //PLACHOLDER CODE FOR MOVEMENT
// // function makeMove() {
// //     if (!selectedTicketType) {
// //         alert('Please select a ticket type first!');
// //         return;
// //     }
    
// //     if (ticketCounts[selectedTicketType] <= 0) {
// //         alert('No tickets remaining for this type!');
// //         return;
// //     }
    
// //     // Decrease ticket count
// //     ticketCounts[selectedTicketType]--;
// //     updateTicketDisplay();
    
// //     // Simulate move (update position)
// //     const currentPos = parseInt(document.getElementById('currentPosition').textContent);
// //     const newPos = currentPos + Math.floor(Math.random() * 10) + 1;
// //     document.getElementById('currentPosition').textContent = newPos;
    
// //     // Reset ticket selection
// //     document.querySelectorAll('.ticket-button').forEach(btn => {
// //         btn.classList.remove('selected');
// //     });
// //     selectedTicketType = null;
    
// //     alert(`Move made using ${selectedTicketType}! New position: ${newPos}`);
// // }

// function updateTicketDisplay() {
//     document.querySelector('#busTicket .ticket-count').textContent = ticketCounts.bus;
//     document.querySelector('#ebikeTicket .ticket-count').textContent = ticketCounts.ebike;
//     document.querySelector('#taxiTicket .ticket-count').textContent = ticketCounts.taxi;
// }

// function addMovementLog(ticket, destination, newLocation) { 
//     const log = document.getElementById("movementLog"); 
//     const entry = document.createElement("div"); 
//     entry.textContent = `Used ${ticket.toUpperCase()} → moved to ${newLocation} (destination: ${destination})`;
//     log.appendChild(entry); 
//     log.scrollTop = log.scrollHeight; }

// function viewLargerMap() {
//     document.getElementById('mapModal').style.display = 'flex';
// }

// function closeMapModal() {
//     document.getElementById('mapModal').style.display = 'none';
// }





// // Close modal when clicking outside the image
// window.onclick = function(event) {
//     const modal = document.getElementById('mapModal');
//     if (event.target === modal) {
//         closeMapModal();
//     }
// }

// loadPlayersFromServer();
