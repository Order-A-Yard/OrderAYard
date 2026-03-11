const gameId = localStorage.getItem('gameId');
const playerId = localStorage.getItem('playerId');
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
        black: 'blackTicket'
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
    black: 6     // for black routes
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

    // Check it's the right turn for your role
    if (myRole === 'fugitive' && currentGameState !== 'fugitive') {
        showError("It's not your turn!");
        return;
    }
    if (myRole === 'detective' && currentGameState !== 'detective') {
        showError("It's not your turn!");
        return;
    }
    
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

    // Reset ticket selection immediately for responsiveness
    selectedTicketType = null;
    document.querySelectorAll('.ticket-button').forEach(btn => btn.classList.remove('selected'));

    // Send move to server
    fetch(`http://trinity-developments.co.uk/players/${playerId}/moves`, {
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
        loadPlayersFromServer(); // refresh all positions from server
    })
    .catch(error => {
        console.error('Move failed:', error);
        // The error message now comes through properly
        showError(error.message.replace('Server error: 400 - ', ''));
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
    loadMapData().then(() => {
    initializeMapLocations();
    loadMyPlayerData();
    loadPlayersFromServer();
    setInterval(loadPlayersFromServer, 3000);
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
    fetch(`http://trinity-developments.co.uk/games/${gameId}`)
    .then(response => response.json())
    .then(data => {
        currentGameState = data.state.toLowerCase(); // ← add this line
        
        const players = data.players.map(player => ({
            id: player.playerId,
            name: player.playerName,
            colour: player.colour,
            location: player.location
        }));

        loadMyPosition(players);
        updateOtherPlayersOnMap(players);
    })
    .catch(error => console.error('Failed to load players:', error));
}
function updateOtherPlayersOnMap(players) {
    // Remove all existing other-player pieces first
    document.querySelectorAll('.other-player-piece').forEach(piece => piece.remove());

    players.forEach(player => {
        // Skip the current player (they have their own piece)
        if (player.id === parseInt(playerId)) return;

        // Find location data for this player's position
        const loc = mapData.locations.find(l => l.location === parseInt(player.location));
        if (!loc) return; // skip if location is "Hidden" or invalid

        // Create a piece for this player
        const piece = document.createElement('div');
        piece.className = 'other-player-piece';
        piece.style.left = `${loc.xPos}%`;
        piece.style.top = `${loc.yPos}%`;
        piece.style.backgroundColor = player.colour;
        piece.title = player.name; // tooltip on hover
        piece.textContent = player.name.charAt(0); // first letter of name

        document.getElementById('locationMarkers').appendChild(piece);
    });
}

function loadMyPosition(players) {
    const me = players.find(p => p.id === parseInt(playerId));
    if (me && me.location && me.location !== 'Hidden') {
        currentPosition = parseInt(me.location);
        updatePlayerPiecePosition();
        highlightCurrentLocation();
        document.getElementById('currentPosition').textContent = currentPosition;
    }
}

let myRole = null; // 'fugitive' or 'detective'

function loadMyPlayerData() {
    fetch(`http://trinity-developments.co.uk/players/${playerId}`)
    .then(res => res.json())
    .then(data => {
        // Update ticket counts from server
        ticketCounts.yellow = data.yellow;
        ticketCounts.green = data.green;
        ticketCounts.red = data.red;
        ticketCounts.black = data.black;
        updateTicketDisplay();

        // Store role so we can show/hide controls
        myRole = data.role;

        // Update name display
        document.getElementById('playerName').textContent = data.playerName;
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
