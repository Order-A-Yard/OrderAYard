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

/* ============================================================
   BROADCAST CHANNEL
   Syncs game events (moves, turn changes) instantly across all
   open tabs/windows for this game, without waiting for the
   3-second server poll.
   ============================================================ */
const gameChannel = gameId ? new BroadcastChannel(`oay_game_${gameId}`) : null;

if (gameChannel) {
    gameChannel.onmessage = (event) => {
        const { type, isMrX, destination, state } = event.data;

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
    };
}

let currentGameState = 'open';
let turnRoleOverride = normalizeTurnRole(localStorage.getItem(turnRoleStorageKey));
let myRole = null; // 'fugitive' or 'detective'
let mrXPlayerId = null;
let resolveMrXPromise = null;
let mrXFallbackApplied = false;
let randomFallbackApplied = false;
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
        /* ============================================================
           MAP DATA
           Loaded at runtime from "mini map.json".
           mapData is null until the fetch resolves; all rendering
           waits until loadMapData() resolves.
           ============================================================ */
        let mapData = null;

        
        /* ============================================================
           LOAD MAP DATA FROM JSON
           Fetches "mini map.json" and assigns it to mapData.
           Falls back to the commented _mapDataFallback object above
           if the fetch fails (e.g. file:// protocol with no server).
           ============================================================ */
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
         /* ============================================================
           Used to validate if player has the right ticket for a route.
           
           Transport types for this map:
           - Red lines   = Taxi routes
           - Green lines = E-Bike routes
           - Blue lines  = Bus routes
           ============================================================ */

        //server expects these ticket types exactly 
        const ticketTypeMap = {
            red: 'red',       // red routes = red tickets
            green: 'green',   // green routes = green tickets  
            blue: 'yellow',   // blue routes = yellow tickets
            black: 'black'    // black routes = black tickets
        };

/* ============================================================
    GAME STATE VARIABLES
    These track the current state of the game:
    - currentPosition: Which location the player is at
    - selectedTicketType: Which ticket is currently selected
    - ticketCounts: How many of each ticket the player has
    ============================================================ */

/* ============================================================
    TICKET SELECTION FUNCTION
    Called when player clicks a ticket button.
    Highlights the selected ticket and stores the selection.
    Clicking same ticket again deselects it.
    ============================================================ */
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
/* ============================================================
    GAME STATE VARIABLES
    These track the current state of the game:
    - currentPosition: Which location the player is at
    - selectedTicketType: Which ticket is currently selected
    - ticketCounts: How many of each ticket the player has
    ============================================================ */
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

/* ============================================================
   MR. X LAST-KNOWN LOCATION HELPERS
   Detective screens can't see Mr. X's real server position
   (it comes back as "hidden"). These helpers let Mr. X's tab
   broadcast their real location so all other screens can place
   a fallback "last seen" marker on the map.
   ============================================================ */
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

/* 
    TICKET SELECTION FUNCTION
    Called when player clicks a ticket button.
    Highlights the selected ticket and stores the selection.
    Clicking same ticket again deselects it.
*/


/* ============================================================
    GET TRANSPORT TYPES FOR A LOCATION
    Returns an object with boolean flags for each transport type
    that connects to this location.
    ============================================================ */
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

/* ============================================================
    GET MARKER COLOR CLASS
    Returns the CSS class for a location based on available
    transport types (red=taxi, green=ebike, blue=bus).
    ============================================================ */
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

/* ============================================================
    MAP INITIALIZATION FUNCTION
    Called when page loads to set up the game board:
    - Creates location markers from mapData
    - Adds event listeners for drag/drop and click
    - Positions the player piece at starting location
    - Colors each marker based on available transport types
    ============================================================ */
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

/* ============================================================
    PLAYER PIECE POSITION UPDATE
    Moves the player piece visually to match currentPosition.
    Calculates correct pixel position from map data.
    ============================================================ */
function updatePlayerPiecePosition() {
    const loc = mapData.locations.find(l => l.location === currentPosition);
    const playerPiece = document.getElementById('playerPiece');
    if (loc && playerPiece) {
        // Position as percentage (same as markers)
        playerPiece.style.left = `${loc.xPos}%`;
        playerPiece.style.top = `${loc.yPos}%`;
    }
    
}

/* ============================================================
    CURRENT LOCATION HIGHLIGHT
    Adds visual indicator to show which location player is on.
    Removes highlight from all others.
    ============================================================ */
function highlightCurrentLocation() {
    document.querySelectorAll('.location-marker').forEach(marker => {
        marker.classList.remove('current');
        if (parseInt(marker.dataset.location) === currentPosition) {
            marker.classList.add('current');
        }
    });
}

/* ============================================================
    CONNECTION VALIDATION FUNCTIONS
    These functions check if moves are valid based on:
    - Direct connections between locations
    - Ticket type matching route color
    ============================================================ */

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

/* ============================================================
    ERROR TOAST NOTIFICATION
    Displays a red error message at the bottom of the screen.
    Auto-removes after 3 seconds.
    ============================================================ */
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

/* ============================================================
    DRAG AND DROP HANDLERS
    Handle the drag-and-drop interaction for moving player piece:
    - handleDragStart: When user starts dragging the piece
    - handleDragEnd: When user stops dragging
    - handleDragOver: While dragging over a drop zone
    - handleDragEnter: When piece enters a drop zone
    - handleDragLeave: When piece leaves a drop zone
    - handleDrop: When piece is dropped on a location
    ============================================================ */

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

/* ============================================================
    CLICK TO MOVE HANDLER
    Alternative to drag/drop - click a location to move there.
    ============================================================ */
function handleLocationClick(targetLocation) {
    if (targetLocation === currentPosition) return;  // Can't move to same spot
    attemptMove(targetLocation);
}

/* ============================================================
    MOVE ATTEMPT FUNCTION
    Validates whether a move to target location is legal.
    Checks: ticket selected, connection exists, correct ticket type,
    and ticket availability. Shows error if invalid.
    ============================================================ */
function attemptMove(targetLocation) {
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

    /* ============================================================
        WILD MOVE (teleport)
        Wild can move to any destination. We attempt server sync with
        ticket 'wild', and if server rejects/unavailable we still apply
        locally for testing flow.
       ============================================================ */
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

/* ============================================================
    EXECUTE MOVE FUNCTION
    Actually performs the move after validation passes:
    - Deducts the used ticket
    - Updates player position
    - Moves the visual piece
    - Resets ticket selection
    ============================================================ */
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

/* ============================================================
    MAKE MOVE BUTTON HANDLER
    Currently just shows instruction since moves are made
    via drag/drop or clicking locations directly.
    ============================================================ */
function makeMove() {
    showError('Drag your piece to a location or click a destination!');
}

/* ============================================================
    TICKET DISPLAY UPDATE
    Refreshes the ticket count numbers shown on each button.
    Called after a move is made to show remaining tickets.
    ============================================================ */
function updateTicketDisplay() {
    document.querySelector('#redTicket .ticket-count').textContent = ticketCounts.red;
    document.querySelector('#greenTicket .ticket-count').textContent = ticketCounts.green;
    document.querySelector('#yellowTicket .ticket-count').textContent = ticketCounts.yellow;
    document.querySelector('#blackTicket .ticket-count').textContent = ticketCounts.black;
        document.querySelector('#wildTicket .ticket-count').textContent = ticketCounts.wild;
}

/* ============================================================
    MAP MODAL FUNCTIONS
    Control the larger map popup/modal:
    - viewLargerMap: Opens the modal
    - closeMapModal: Closes the modal
    ============================================================ */
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
/* ============================================================
    PAGE INITIALIZATION
    Runs when the DOM is fully loaded:
    - Sets up all location markers on the map
    - Adds drag event listeners to player piece
    - Displays starting position
    ============================================================ */
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
    fetch(`${API_BASE}/games/${gameId}`)
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(data => {
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
