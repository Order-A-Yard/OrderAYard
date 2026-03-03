
        let selectedTicketType = null;
        let ticketCounts = {
            bus: 5,
            ebike: 3,
            taxi: 8
        };

        function selectTicket(ticketType) {
            // Remove selection from all tickets
            document.querySelectorAll('.ticket-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // Select the clicked ticket
            const ticketButton = document.getElementById(ticketType + 'Ticket');
            
            if (selectedTicketType === ticketType) {
                // Deselect if clicking the same ticket
                selectedTicketType = null;
            } else {
                // Select new ticket
                selectedTicketType = ticketType;
                ticketButton.classList.add('selected');
            }
        }

        //Updated movement function to send move request to server - Ethan
        async function makeMove() { 
            if (!selectedTicketType) { 
                alert("Please select a ticket type first!"); 
                return; 
            } 
            const destination = prompt("Enter destination location:"); 
            if (!destination) return;
            const playerId = window.currentPlayerId; 
            const gameID = window.currentGameId; 
            
            const response = await fetch(`http://trinity-developments.co.uk/players/${playerId}/moves`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ 
                    gameID, 
                    ticket: selectedTicketType, 
                    destination: parseInt(destination)
                 }) 
            }); const data = await response.json(); 
            
            if (!response.ok) { 
                alert(data.message); 
                return; 
            } 
        
            document.getElementById("currentPosition").textContent = data.location;


            addMovementLog(selectedTicketType, destination, data.location);

            ticketCounts[selectedTicketType]--;
            updateTicketDisplay();

            document.querySelectorAll('.ticket-button').forEach(btn => btn.classList.remove('selected'));
            selectedTicketType = null;  
                
            alert("Move Successful"); 
        }

        //PLACHOLDER CODE FOR MOVEMENT
        // function makeMove() {
        //     if (!selectedTicketType) {
        //         alert('Please select a ticket type first!');
        //         return;
        //     }
            
        //     if (ticketCounts[selectedTicketType] <= 0) {
        //         alert('No tickets remaining for this type!');
        //         return;
        //     }
            
        //     // Decrease ticket count
        //     ticketCounts[selectedTicketType]--;
        //     updateTicketDisplay();
            
        //     // Simulate move (update position)
        //     const currentPos = parseInt(document.getElementById('currentPosition').textContent);
        //     const newPos = currentPos + Math.floor(Math.random() * 10) + 1;
        //     document.getElementById('currentPosition').textContent = newPos;
            
        //     // Reset ticket selection
        //     document.querySelectorAll('.ticket-button').forEach(btn => {
        //         btn.classList.remove('selected');
        //     });
        //     selectedTicketType = null;
            
        //     alert(`Move made using ${selectedTicketType}! New position: ${newPos}`);
        // }

        function updateTicketDisplay() {
            document.querySelector('#busTicket .ticket-count').textContent = ticketCounts.bus;
            document.querySelector('#ebikeTicket .ticket-count').textContent = ticketCounts.ebike;
            document.querySelector('#taxiTicket .ticket-count').textContent = ticketCounts.taxi;
        }

        function addMovementLog(ticket, destination, newLocation) { 
            const log = document.getElementById("movementLog"); 
            const entry = document.createElement("div"); 
            entry.textContent = `Used ${ticket.toUpperCase()} → moved to ${newLocation} (destination: ${destination})`;
            log.appendChild(entry); 
            log.scrollTop = log.scrollHeight; }

        function viewLargerMap() {
            document.getElementById('mapModal').style.display = 'flex';
        }

        function closeMapModal() {
            document.getElementById('mapModal').style.display = 'none';
        }

     
       

       
        // Close modal when clicking outside the image
        window.onclick = function(event) {
            const modal = document.getElementById('mapModal');
            if (event.target === modal) {
                closeMapModal();
            }
        }

        loadPlayersFromServer();
    