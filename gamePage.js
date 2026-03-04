
         /* ============================================================
           COORDINATE CAPTURE TOOL
           Click on the map to capture stop positions.
           ============================================================ */
        let capturedLocations = [];
        let nextLocationId = 1;
        let captureMode = true; // Set to false when done capturing
        
        function initCaptureMode() {
            const gameMap = document.getElementById('gameMap');
            const mapImage = gameMap.querySelector('.map-image');
            
            gameMap.addEventListener('click', function(e) {
                if (!captureMode) return;
                
                const rect = mapImage.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Calculate percentage positions
                const xPercent = (x / rect.width * 100).toFixed(2);
                const yPercent = (y / rect.height * 100).toFixed(2);
                
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
        
        function undoLastCapture() {
            if (capturedLocations.length === 0) return;
            
            capturedLocations.pop();
            nextLocationId--;
            
            const marker = document.getElementById('marker-' + nextLocationId);
            if (marker) marker.remove();
            
            document.getElementById('nextLocationId').textContent = nextLocationId;
            document.getElementById('coordDisplay').innerHTML = 
                nextLocationId > 1 ? `Undone. Next: #${nextLocationId}` : 'Click on map to capture position';
            updateCapturedList();
        }
        
        function updateCapturedList() {
            const list = document.getElementById('capturedList');
            list.innerHTML = capturedLocations.map(loc => 
                `<div>#${loc.location}: (${loc.xPos}%, ${loc.yPos}%)</div>`
            ).join('');
        }
        
        function exportCoordinates() {
            const json = JSON.stringify(capturedLocations, null, 2);
            navigator.clipboard.writeText(json).then(() => {
                alert('Coordinates copied to clipboard! Paste them into mapData.locations array.');
            });
            console.log('Captured Locations:', json);
        }
        
        // Initialize capture mode when page loads
        document.addEventListener('DOMContentLoaded', initCaptureMode);
        
        /* ============================================================
           MAP DATA CONFIGURATION
           Contains all game board information:
           - connections: Routes between locations with their colors
           - locations: X/Y coordinates for each location marker
           
           Color meanings for routes:
           - red = bus routes
           - green = e-bike routes  
           - blue = water/ferry routes (light blue dashed lines)
           
           This is a SIMPLIFIED version with ~25 key locations.
           Full map has 100+ locations.
           ============================================================ */
        const mapData = {
            // All connections between locations
            // Each connection has: from (start), to (end), colour (route type)
            // Colors: yellow = taxi, green = e-bike, red = bus
            connections: [
                //Backup
                // // Yellow (taxi) connections - main routes
                // { from: 1, to: 2, colour: "yellow" },
                // { from: 2, to: 3, colour: "yellow" },
                // { from: 3, to: 4, colour: "yellow" },
                // { from: 4, to: 5, colour: "yellow" },
                // { from: 5, to: 6, colour: "yellow" },
                // { from: 6, to: 7, colour: "yellow" },
                // { from: 1, to: 7, colour: "yellow" },
                
                // // Green (e-bike) connections
                // { from: 1, to: 3, colour: "green" },
                // { from: 3, to: 6, colour: "green" },
                
                // // Red (bus) connection
                // { from: 1, to: 5, colour: "red" }

                //  // Blue (taxi) connections - main routes
                
                { from: 3, to: 25, colour: "blue" },
                { from: 6, to: 12, colour: "blue" },
                
                // Green (e-bike) connections
               
                { from: 6, to: 9, colour: "green" },
                
                // Red (bus) connection
                { from: 1, to: 5, colour: "red" },
                { from: 1, to: 2, colour: "red" },
                { from: 2, to: 3, colour: "red" },
                { from: 2, to: 7, colour: "red" },
                { from: 3, to: 4, colour: "red" },
                { from: 4, to: 5, colour: "red" },
                { from: 4, to: 8, colour: "red" },
                { from: 5, to: 6, colour: "red" },
                { from: 5, to: 9, colour: "red" },    
                { from: 6, to: 7, colour: "red" },
                { from: 6, to: 11, colour: "red" },
                


            ],
            
            // All map locations with PERCENTAGE coordinates
            // xPos/yPos: percentage position on the map image (0-100)
            // Based on mini map image size: 506 x 369 pixels
            // Using percentages so markers scale with the image
            locations: [
                // { location: 1, xPos: 11.07, yPos: 22.22, name: "Location 1" },
                // { location: 2, xPos: 44.07, yPos: 14.91, name: "Location 2" },
                // { location: 3, xPos: 69.57, yPos: 21.68, name: "Location 3" },
                // { location: 4, xPos: 85.97, yPos: 55.83, name: "Location 4" },
                // { location: 5, xPos: 71.34, yPos: 83.74, name: "Location 5" },
                // { location: 6, xPos: 39.33, yPos: 83.20, name: "Location 6" },
                // { location: 7, xPos: 15.61, yPos: 59.35, name: "Location 7" },
                { location: 1, xPos: 30, yPos: 4, name: "Location 2" },
                { location: 2, xPos: 27.2, yPos: 11.5, name: "Location 2" },
                { location: 3, xPos: 29.4, yPos: 11.5, name: "Location 3" },
                { location: 4, xPos: 31.3, yPos: 11.4, name: "Location 4" },
                { location: 5, xPos: 33.5, yPos: 9.5, name: "Location 5" },
                { location: 6, xPos: 35.6, yPos: 13, name: "Location 6" },
                { location: 8, xPos: 11.07, yPos: 22.22, name: "Location 7" },
                { location: 9, xPos: 44.07, yPos: 14.91, name: "Location 8" },
                { location: 10, xPos: 69.57, yPos: 21.68, name: "Location 9" },
                { location: 11, xPos: 85.97, yPos: 55.83, name: "Location 10" },
                { location: 12, xPos: 71.34, yPos: 83.74, name: "Location 11" },
                { location: 13, xPos: 39.33, yPos: 83.20, name: "Location 12" },
                { location: 14, xPos: 11.07, yPos: 22.22, name: "Location 13" },
                { location: 15, xPos: 44.07, yPos: 14.91, name: "Location 14" },
                { location: 16, xPos: 69.57, yPos: 21.68, name: "Location 15" },
                { location: 17, xPos: 85.97, yPos: 55.83, name: "Location 16" },
                { location: 18, xPos: 71.34, yPos: 83.74, name: "Location 17" },
                { location: 19, xPos: 39.33, yPos: 83.20, name: "Location 18" },
                { location: 20, xPos: 11.07, yPos: 22.22, name: "Location 19" },
                { location: 21, xPos: 44.07, yPos: 14.91, name: "Location 20" },
                { location: 22, xPos: 69.57, yPos: 21.68, name: "Location 21" },
                { location: 23, xPos: 85.97, yPos: 55.83, name: "Location 22" },
                { location: 24, xPos: 71.34, yPos: 83.74, name: "Location 23" },
                { location: 25, xPos: 39.33, yPos: 83.20, name: "Location 24" },
                { location: 26, xPos: 11.07, yPos: 22.22, name: "Location 25" },
                { location: 27, xPos: 44.07, yPos: 14.91, name: "Location 26" },
                { location: 28, xPos: 69.57, yPos: 21.68, name: "Location 27" },
                { location: 29, xPos: 85.97, yPos: 55.83, name: "Location 28" },
                { location: 30, xPos: 71.34, yPos: 83.74, name: "Location 29" },
                { location: 31, xPos: 39.33, yPos: 83.20, name: "Location 30" },
                { location: 32, xPos: 11.07, yPos: 22.22, name: "Location 31" },
                { location: 33, xPos: 44.07, yPos: 14.91, name: "Location 32" },
                { location: 34, xPos: 69.57, yPos: 21.68, name: "Location 33" },
                { location: 35, xPos: 85.97, yPos: 55.83, name: "Location 34" },
                { location: 36, xPos: 71.34, yPos: 83.74, name: "Location 35" },
                { location: 37, xPos: 11.07, yPos: 22.22, name: "Location 37" },
                { location: 38, xPos: 44.07, yPos: 14.91, name: "Location 38" },
                { location: 39, xPos: 69.57, yPos: 21.68, name: "Location 39" },
                { location: 40, xPos: 85.97, yPos: 55.83, name: "Location 40" },
                { location: 41, xPos: 71.34, yPos: 83.74, name: "Location 41" },
                { location: 42, xPos: 39.33, yPos: 83.20, name: "Location 42" },
                { location: 43, xPos: 11.07, yPos: 22.22, name: "Location 43" },
                { location: 44, xPos: 44.07, yPos: 14.91, name: "Location 44" },
                { location: 45, xPos: 69.57, yPos: 21.68, name: "Location 45" },
                { location: 46, xPos: 85.97, yPos: 55.83, name: "Location 46" },
                { location: 47, xPos: 71.34, yPos: 83.74, name: "Location 47" },
                { location: 48, xPos: 39.33, yPos: 83.20, name: "Location 48" },
                { location: 49, xPos: 11.07, yPos: 22.22, name: "Location 49" },
                { location: 50, xPos: 44.07, yPos: 14.91, name: "Location 50" },
                { location: 51, xPos: 69.57, yPos: 21.68, name: "Location 51" },
                { location: 52, xPos: 85.97, yPos: 55.83, name: "Location 52" },
                { location: 53, xPos: 71.34, yPos: 83.74, name: "Location 53" },
                { location: 54, xPos: 39.33, yPos: 83.20, name: "Location 54" },
                { location: 55, xPos: 11.07, yPos: 22.22, name: "Location 55" },
                { location: 56, xPos: 44.07, yPos: 14.91, name: "Location 56" },
                { location: 57, xPos: 69.57, yPos: 21.68, name: "Location 57" },
                { location: 58, xPos: 85.97, yPos: 55.83, name: "Location 58" },
                { location: 59, xPos: 71.34, yPos: 83.74, name: "Location 59" },
                { location: 60, xPos: 39.33, yPos: 83.20, name: "Location 60" },
                { location: 61, xPos: 11.07, yPos: 22.22, name: "Location 61" },
                { location: 62, xPos: 44.07, yPos: 14.91, name: "Location 62" },
                { location: 63, xPos: 69.57, yPos: 21.68, name: "Location 63" },
                { location: 64, xPos: 85.97, yPos: 55.83, name: "Location 64" },
                { location: 65, xPos: 71.34, yPos: 83.74, name: "Location 65" },
                { location: 66, xPos: 39.33, yPos: 83.20, name: "Location 66" },
                { location: 67, xPos: 11.07, yPos: 22.22, name: "Location 67" },
                { location: 68, xPos: 44.07, yPos: 14.91, name: "Location 68" },
                { location: 69, xPos: 69.57, yPos: 21.68, name: "Location 69" },
                { location: 70, xPos: 85.97, yPos: 55.83, name: "Location 70" },
                { location: 71, xPos: 71.34, yPos: 83.74, name: "Location 71" },
                { location: 72, xPos: 39.33, yPos: 83.20, name: "Location 72" },
                { location: 73, xPos: 11.07, yPos: 22.22, name: "Location 73" },
                { location: 74, xPos: 44.07, yPos: 14.91, name: "Location 74" },
                { location: 75, xPos: 69.57, yPos: 21.68, name: "Location 75" },
                { location: 76, xPos: 85.97, yPos: 55.83, name: "Location 76" },
                { location: 77, xPos: 71.34, yPos: 83.74, name: "Location 77" },
                { location: 78, xPos: 39.33, yPos: 83.20, name: "Location 78" },
                { location: 79, xPos: 11.07, yPos: 22.22, name: "Location 79" },
                { location: 80, xPos: 44.07, yPos: 14.91, name: "Location 80" },
                { location: 81, xPos: 69.57, yPos: 21.68, name: "Location 81" },
                { location: 82, xPos: 85.97, yPos: 55.83, name: "Location 82" },
                { location: 83, xPos: 71.34, yPos: 83.74, name: "Location 83" },
                { location: 84, xPos: 39.33, yPos: 83.20, name: "Location 84" },
                { location: 85, xPos: 11.07, yPos: 22.22, name: "Location 85" },
                { location: 86, xPos: 44.07, yPos: 14.91, name: "Location 86" },
                { location: 87, xPos: 69.57, yPos: 21.68, name: "Location 87" },
                { location: 88, xPos: 85.97, yPos: 55.83, name: "Location 88" },
                { location: 89, xPos: 71.34, yPos: 83.74, name: "Location 89" },
                { location: 90, xPos: 39.33, yPos: 83.20, name: "Location 90" },
                { location: 91, xPos: 11.07, yPos: 22.22, name: "Location 91" },
                { location: 92, xPos: 44.07, yPos: 14.91, name: "Location 92" },
                { location: 93, xPos: 69.57, yPos: 21.68, name: "Location 93" },
                { location: 94, xPos: 85.97, yPos: 55.83, name: "Location 94" },
                { location: 95, xPos: 71.34, yPos: 83.74, name: "Location 95" },
                { location: 96, xPos: 39.33, yPos: 83.20, name: "Location 96" },
                { location: 97, xPos: 11.07, yPos: 22.22, name: "Location 97" },
                { location: 98, xPos: 44.07, yPos: 14.91, name: "Location 98" },
                { location: 99, xPos: 69.57, yPos: 21.68, name: "Location 99" },
                { location: 100, xPos: 85.97, yPos: 55.83, name: "Location 100" },
                { location: 101, xPos: 71.34, yPos: 83.74, name: "Location 101" },
                { location: 102, xPos: 39.33, yPos: 83.20, name: "Location 102" },
                { location: 103, xPos: 11.07, yPos: 22.22, name: "Location 103" },
                { location: 104, xPos: 44.07, yPos: 14.91, name: "Location 104" },
                { location: 105, xPos: 69.57, yPos: 21.68, name: "Location 105" },
                { location: 106, xPos: 85.97, yPos: 55.83, name: "Location 106" },
                { location: 107, xPos: 71.34, yPos: 83.74, name: "Location 107" },
                { location: 108, xPos: 39.33, yPos: 83.20, name: "Location 108" },
                { location: 109, xPos: 11.07, yPos: 22.22, name: "Location 109" },
                { location: 110, xPos: 44.07, yPos: 14.91, name: "Location 110" },
                { location: 111, xPos: 69.57, yPos: 21.68, name: "Location 111" },
                { location: 112, xPos: 85.97, yPos: 55.83, name: "Location 112" },
                { location: 113, xPos: 71.34, yPos: 83.74, name: "Location 113" },
               
              
            ]
        };

        /* ============================================================
           TICKET TYPE MAPPING
           Maps route colors to the ticket type needed to use them.
           Used to validate if player has the right ticket for a route.
           
           Transport types for this map:
           - Red lines   = Taxi routes
           - Green lines = E-Bike routes
           - Blue lines  = Bus routes
           ============================================================ */
        const ticketTypeMap = {
            blue: 'taxi',     // blue routes require taxi tickets
            green: 'ebike',     // Green routes require e-bike tickets
            red: 'bus'          // Red routes require bus tickets
        };

        /* ============================================================
           GAME STATE VARIABLES
           These track the current state of the game:
           - currentPosition: Which location the player is at
           - selectedTicketType: Which ticket is currently selected
           - ticketCounts: How many of each ticket the player has
           ============================================================ */
        let currentPosition = 1;        // Player starts at location 1
        let selectedTicketType = null;  // No ticket selected initially
        let ticketCounts = {
            taxi: 10,    // Taxi for red routes (most common)
            ebike: 5,    // E-bike for green routes
            bus: 3       // Bus for blue routes
        };

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

        // TODO: Uncomment to load player data from server
        // loadPlayersFromServer();
       
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
    