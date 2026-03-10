
         /* ============================================================
           COORDINATE CAPTURE TOOL
           Click on the map to capture stop positions.
           ============================================================ */
        let capturedLocations = [];
        let nextLocationId = 1;
        let captureMode = true; // Set to false when done capturing
        
        function initCaptureMode() {
            const gameMap = document.getElementById('gameMap');
            const mapInner = gameMap.querySelector('.map-inner');

            // Listen on gameMap (map-inner is pointer-events:none so clicks fall through to here)
            // Measure against mapInner — identical bounding rect to the image.
            gameMap.addEventListener('click', function(e) {
                if (!captureMode) return;
                // Ignore clicks on interactive children (buttons, markers)
                if (e.target.closest('button') || e.target.closest('.location-marker') || e.target.closest('.captured-marker')) return;

                const rect = mapInner.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // Clamp to 0-100 in case click lands on a border pixel
                const xPercent = Math.max(0, Math.min(100, (x / rect.width * 100))).toFixed(2);
                const yPercent = Math.max(0, Math.min(100, (y / rect.height * 100))).toFixed(2);
                
                // Store the location
                capturedLocations.push({
                    location: nextLocationId,
                    xPos: parseFloat(xPercent),
                    yPos: parseFloat(yPercent),
                    name: "Location " + nextLocationId
                });
                
                // Add visual marker
                addCapturedMarker(nextLocationId, xPercent, yPercent);
                
                // Update display
                document.getElementById('coordDisplay').innerHTML = 
                    `Captured #${nextLocationId}: (${xPercent}%, ${yPercent}%)`;
                nextLocationId++;
                document.getElementById('nextLocationId').textContent = nextLocationId;
                updateCapturedList();
            });
        }
        
        function addCapturedMarker(id, xPercent, yPercent) {
            const container = document.getElementById('capturedMarkers');
            const marker = document.createElement('div');
            marker.className = 'captured-marker';
            marker.id = 'marker-' + id;
            marker.style.cssText = `
                position: absolute;
                left: ${xPercent}%;
                top: ${yPercent}%;
                width: 24px;
                height: 24px;
                background: #4CAF50;
                border: 2px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                color: white;
                transform: translate(-50%, -50%);
                z-index: 100;
                pointer-events: none;
            `;
            marker.textContent = id;
            container.appendChild(marker);
        }
        
        // function undoLastCapture() {
        //     if (capturedLocations.length === 0) return;
            
        //     capturedLocations.pop();
        //     nextLocationId--;
            
        //     const marker = document.getElementById('marker-' + nextLocationId);
        //     if (marker) marker.remove();
            
        //     document.getElementById('nextLocationId').textContent = nextLocationId;
        //     document.getElementById('coordDisplay').innerHTML = 
        //         nextLocationId > 1 ? `Undone. Next: #${nextLocationId}` : 'Click on map to capture position';
        //     updateCapturedList();
        // }
        
        // function updateCapturedList() {
        //     const list = document.getElementById('capturedList');
        //     list.innerHTML = capturedLocations.map(loc => 
        //         `<div>#${loc.location}: (${loc.xPos}%, ${loc.yPos}%)</div>`
        //     ).join('');
        // }
        
        // function exportCoordinates() {
        //     const json = JSON.stringify(capturedLocations, null, 2);
        //     navigator.clipboard.writeText(json).then(() => {
        //         alert('Coordinates copied to clipboard! Paste them into mapData.locations array.');
        //     });
        //     console.log('Captured Locations:', json);
        // }
        
        // Initialize capture mode when page loads
        // document.addEventListener('DOMContentLoaded', initCaptureMode);
        
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
        const ticketTypeMap = {
            blue: 'taxi',     // blue routes require taxi tickets
            green: 'ebike',     // Green routes require e-bike tickets
            red: 'bus',        // Red routes require bus tickets
            black: 'boat'      // Black routes require boat tickets
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
    // Remove selection from all tickets first
    document.querySelectorAll('.ticket-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Get the clicked ticket button
    const ticketButton = document.getElementById(ticketType + 'Ticket');
    
    if (selectedTicketType === ticketType) {
        // Deselect if clicking the same ticket (toggle off)
        selectedTicketType = null;
    } else {
        // Select new ticket and highlight it
        selectedTicketType = ticketType;
        ticketButton.classList.add('selected');
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
            taxi: 3,     // Taxi for red routes
            ebike: 5,    // E-bike for green routes
            bus: 10,      // Bus for blue routes (most common)
            boat: 6       // Boat for black routes
        };

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
        function selectTicket(ticketType) {
            // Remove selection from all tickets first
            document.querySelectorAll('.ticket-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // Get the clicked ticket button
            const ticketButton = document.getElementById(ticketType + 'Ticket');
            
            if (selectedTicketType === ticketType) {
                // Deselect if clicking the same ticket (toggle off)
                selectedTicketType = null;
            } else {
                // Select new ticket and highlight it
                selectedTicketType = ticketType;
                ticketButton.classList.add('selected');
            }
        }

/* ============================================================
    GET TRANSPORT TYPES FOR A LOCATION
    Returns an object with boolean flags for each transport type
    that connects to this location.
    ============================================================ */
function getLocationTransports(locationId) {
    const transports = { taxi: false, ebike: false, bus: false };
    
    mapData.connections.forEach(conn => {
        if (conn.from === locationId || conn.to === locationId) {
            const ticketType = ticketTypeMap[conn.colour];
            if (ticketType) {
                transports[ticketType] = true;
            }
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
    const { taxi, ebike, bus } = transports;
    
    // All three transports
    if (taxi && ebike && bus) return 'all-transport';
    
    // Two transports
    if (taxi && ebike) return 'taxi-ebike';
    if (taxi && bus) return 'taxi-bus';
    if (ebike && bus) return 'ebike-bus';
    
    // Single transport
    if (taxi) return 'taxi-only';
    if (ebike) return 'ebike-only';
    if (bus) return 'bus-only';
    
    return ''; // No transports (shouldn't happen)
}
        /* ============================================================
           GET TRANSPORT TYPES FOR A LOCATION
           Returns an object with boolean flags for each transport type
           that connects to this location.
           ============================================================ */
        function getLocationTransports(locationId) {
            const transports = { taxi: false, ebike: false, bus: false, boat: false };
            
            mapData.connections.forEach(conn => {
                if (conn.from === locationId || conn.to === locationId) {
                    const ticketType = ticketTypeMap[conn.colour];
                    if (ticketType) {
                        transports[ticketType] = true;
                    }
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
            const { taxi, ebike, bus, boat } = transports;
            
            // Four transports
            if (taxi && ebike && bus && boat) return 'all-transport';
            
            // Three transports
            if (taxi && ebike && bus) return 'taxi-ebike-bus';
            if (taxi && ebike && boat) return 'taxi-ebike-boat';
            if (taxi && bus && boat) return 'taxi-bus-boat';
            if (ebike && bus && boat) return 'ebike-bus-boat';
            
            // Two transports
            if (taxi && ebike) return 'taxi-ebike';
            if (taxi && bus) return 'taxi-bus';
            if (taxi && boat) return 'taxi-boat';
            if (ebike && bus) return 'ebike-bus';
            if (ebike && boat) return 'ebike-boat';
            if (bus && boat) return 'bus-boat';
            
            // Single transport
            if (taxi) return 'taxi-only';
            if (ebike) return 'ebike-only';
            if (bus) return 'bus-only';
            if (boat) return 'boat-only';
            
            return ''; // No transports (shouldn't happen)
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
    
    const connection = getValidConnection(currentPosition, targetLocation);
    
    // Show green if valid move, red if invalid
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
    const connection = getValidConnection(currentPosition, targetLocation);
    
    // VALIDATION 1: Must have a ticket selected
    if (!selectedTicketType) {
        showError('Select a ticket type first!');
        return;
    }
    
    // VALIDATION 2: Must have direct connection
    if (!connection) {
        showError('No direct connection to this location!');
        return;
    }
    
    // VALIDATION 3: Ticket type must match route color
    if (!canMoveWithTicket(connection, selectedTicketType)) {
        showError(`Cannot use ${selectedTicketType} on this route. Need ${ticketTypeMap[connection.colour]}.`);
        return;
    }
    
    // VALIDATION 4: Must have tickets remaining
    if (ticketCounts[selectedTicketType] <= 0) {
        showError('No tickets remaining!');
        return;
    }
    
    // All validations passed - execute the move
    executeMove(targetLocation);
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
    
    // Deduct one ticket of the used type
    ticketCounts[selectedTicketType]--;
    updateTicketDisplay();
    
    // Update player's position in game state
    currentPosition = newPosition;
    document.getElementById('currentPosition').textContent = newPosition;
    
    // Move player piece visually on the map
    updatePlayerPiecePosition();
    highlightCurrentLocation();
    
    // Reset ticket selection (must select again for next move)
    selectedTicketType = null;
    document.querySelectorAll('.ticket-button').forEach(btn => btn.classList.remove('selected'));

    //sends move data to server through post request
    fetch(`http://trinity-developments.co.uk/players/${playerID}/moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "GameID":`${gameId}`,
            "ticket": `${selectedTicketType}`,
            "destination": `${destination}`,
        })
    })
    loadPlayersFromServer();
    
    console.log(`Moved to ${newPosition} using ${usedTicket}`);
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
    document.querySelector('#taxiTicket .ticket-count').textContent = ticketCounts.taxi;
    document.querySelector('#ebikeTicket .ticket-count').textContent = ticketCounts.ebike;
    document.querySelector('#busTicket .ticket-count').textContent = ticketCounts.bus;
            document.querySelector('#boatTicket .ticket-count').textContent = ticketCounts.boat;
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
           - Fetches map data from mini map.json
           - Sets up all location markers on the map
           - Adds drag event listeners to player piece
           - Displays starting position
           ============================================================ */
        document.addEventListener('DOMContentLoaded', () => {
            // Load map data from JSON, then initialise everything that depends on it
            loadMapData().then(() => {
                if (!mapData) {
                    console.error('[Map] mapData is null after load – markers will not render.');
                    return;
                }

                chooseRandomStartPosition();

                // Create all location markers and set up the map
                initializeMapLocations();

                // Set up drag events for the player piece
                const playerPiece = document.getElementById('playerPiece');
                playerPiece.addEventListener('dragstart', handleDragStart);
                playerPiece.addEventListener('dragend', handleDragEnd);

                // Show starting position in the UI
                document.getElementById('currentPosition').textContent = currentPosition;
            });

            // === COORDINATE HELPER ===
            // Click on the map to see and log percentage coordinates
            // Use these values to position your markers correctly
            const gameMap = document.getElementById('gameMap');
            const coordDisplay = document.getElementById('coordDisplay');

            gameMap.addEventListener('click', (e) => {
                const rect = gameMap.getBoundingClientRect();
                const xPercent = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
                const yPercent = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);

                coordDisplay.innerHTML = `xPos: ${xPercent}, yPos: ${yPercent}<br><small>Ctrl+Shift+I to see console log</small>`;
                console.log(`{ location: X, xPos: ${xPercent}, yPos: ${yPercent}, name: "NAME" },`);
            });

            gameMap.addEventListener('mousemove', (e) => {
                const rect = gameMap.getBoundingClientRect();
                const xPercent = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
                const yPercent = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
                coordDisplay.textContent = `Hover: ${xPercent}%, ${yPercent}%`;
            });
        });
/* ============================================================
    PAGE INITIALIZATION
    Runs when the DOM is fully loaded:
    - Sets up all location markers on the map
    - Adds drag event listeners to player piece
    - Displays starting position
    ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    // Create all location markers and set up the map
    initializeMapLocations();
    
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
    const coordDisplay = document.getElementById('coordDisplay');
    
    gameMap.addEventListener('click', (e) => {
        const rect = gameMap.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        const yPercent = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        
        coordDisplay.innerHTML = `xPos: ${xPercent}, yPos: ${yPercent}<br><small>Ctrl+Shift+I to see console log</small>`;
        console.log(`{ location: X, xPos: ${xPercent}, yPos: ${yPercent}, name: "NAME" },`);
    });
    
    gameMap.addEventListener('mousemove', (e) => {
        const rect = gameMap.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        const yPercent = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        coordDisplay.textContent = `Hover: ${xPercent}%, ${yPercent}%`;
    });
});

        

function loadPlayersFromServer(){
    //this part needs to get list of all players and save their IDs as local variables
    fetch(`http://trinity-developments.co.uk/games/${gameId}/players`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json'},
    })
    .then(response => response.json())
    .then(data => {
        // save all players from the response
        const players = data.players.map(player => ({
            id: player.playerId,
            name: player.playerName,
            colour: player.colour,
            location: player.location
        }));
        players.forEach(player => {
            console.log(`Player ${player.name} is at ${player.location}`);
        });
    })
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
