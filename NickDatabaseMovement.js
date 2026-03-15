app.post("/players/:playerId/moves", async (req, res) => { 
    const playerId = parseInt(req.params.playerId); 
    const { gameID, ticket, destination } = req.body; 
    
    try { 
        // Validating player exists
        const playerRes = await db.query( 
            "SELECT * FROM players WHERE id = $1", 
            [playerId] 
        ); 
            if (playerRes.rowCount === 0)
                return res.status(404).json({ message: `Player with ID ${playerId} not found.` }); 
            const player = playerRes.rows[0]; 

            //Validating game exists for this player 
            if (player.game_id !== gameID) 
                return res.status(404).json({ message: `Game for Player with ID ${playerId} not found.` }); 
            const gameRes = await db.query("SELECT * FROM games WHERE id = $1", [gameID]); 
            const game = gameRes.rows[0]; 
            if (!game) 
                return res.status(404).json({ message: `Game for Player with ID ${playerId} not found.` }); 
            // Validating map exists 
            const mapRes = await db.query("SELECT * FROM maps WHERE id = $1", [game.map_id]); 
            if (mapRes.rowCount === 0) 
                return res.status(404).json({ message: `Map for Game for Player with ID ${playerId} not found.` }); 
            // Player must be active 
                if (!player.active) 
                    return res.status(400).json({ message: `Player with ID ${playerId} is not active in the game.` }); 
            // Game must have started 
                if (game.state === "open") 
                    return res.status(400).json({ message: `Game for Player with ID ${playerId} has not started.` }); 
            // Game must not be over 
                if (game.state === "over") 
                    return res.status(400).json({ message: `Game for Player with ID ${playerId} is over.` }); 
            // Turn validation 
                if (!player.turn) 
                    return res.status(400).json({ message: `It is not the Player with ID ${playerId}'s turn.` }); 
            // Ticket validation 
                const validTickets = ["yellow", "green", "red", "black", "x2"]; 
                if (!validTickets.includes(ticket)) 
                    return res.status(400).json({ message: `${ticket} is not a valid type of ticket.` }); 
                const ticketRes = await db.query( 
                    "SELECT * FROM tickets WHERE player_id = $1", 
                    [playerId] 
                ); 
                
                const t = ticketRes.rows[0]; 
                if (t[ticket] <= 0) 
                    return res.status(400).json({ message: `The Player with ID ${playerId} does not have a ${ticket} ticket.` 
                }); 
            // X2 special rule 
                if (ticket === "x2") { 
                    if (player.used_x2)
                        return res.status(400).json({ 
                            message: `The Player with ID ${playerId} cannot play more than one X2 ticket in a turn.` 
                        }); 
                        await db.query("UPDATE players SET used_x2 = TRUE WHERE id = $1", [playerId]); 
                        
                        return res.status(201).json({ 
                            message: "Move Successful", 
                            gameId: gameID, 
                            playerId, 
                            moveId: Date.now(), 
                            location: player.location 
                        }); 
                    } 

            // Workaround: if Mr. X is stored as "hidden" in the DB, treat their current location as their start location
            // so they can still make a move without requiring an immediate reveal.
            const storedLocation = Number(player.location);
            const effectiveLocation = Number.isFinite(storedLocation) ? storedLocation : player.start_location;

            // Validate map connection 
                const connRes = await db.query( 
                    `SELECT * FROM map_edges
                     WHERE (locationA = $1 AND locationB = $2 AND ticket = $3) 
                     OR (locationA = $2 AND locationB = $1 AND ticket = $3)`, 
                     [effectiveLocation, destination, ticket] 
                    ); 
                    
                    if (connRes.rowCount === 0) 
                        return res.status(400).json({ 
                            message: `The Player with ID ${playerId} cannot move to location ${destination} with a ${ticket} ticket.` 
                        }); 
            // Detectives cannot move onto occupied locations 
                if (player.role === "fugitive") { 
                    const detRes = await db.query( 
                        "SELECT * FROM players WHERE game_id = $1 AND role = 'detective' AND location = $2", 
                        [gameID, destination] 
                    ); 
                    if (detRes.rowCount > 0) 
                        return res.status(400).json({ 
                    message: `The Player with ID ${playerId} cannot move to location ${destination} as it is occupied by a detective.` 
                }); 
            } 
            // Deduct ticket 
                await db.query( 
                    `UPDATE tickets SET ${ticket} = ${ticket} - 1 WHERE player_id = $1`, 
                    [playerId] 
                ); 
            // Update location 
                await db.query( 
                    "UPDATE players SET location = $1 WHERE id = $2", 
                    [destination, playerId] 
                ); 
            // End turn 
                await db.query("UPDATE players SET turn = FALSE WHERE id = $1", [playerId]); 

                return res.status(201).json({
                     message: "Move Successful", 
                     gameId: gameID, 
                     playerId, 
                     moveId: Date.now(), 
                     location: destination }); } 
                catch (err) { 
                    console.error(err); 
                    res.status(500).json({ message: "Server error." }); 
                }
             });

    app.get("/players/:playerId/moves", async (req, res) => {
    const playerId = parseInt(req.params.playerId);

    try {
        // 1. Validate player exists
        const playerRes = await db.query(
            "SELECT * FROM players WHERE id = $1",
            [playerId]
        );

        if (playerRes.rowCount === 0)
            return res.status(404).json({ message: `Player with ID ${playerId} not found` });

        const player = playerRes.rows[0];

        // 2. Validate game exists
        const gameRes = await db.query(
            "SELECT * FROM games WHERE id = $1",
            [player.game_id]
        );

        if (gameRes.rowCount === 0)
            return res.status(404).json({ message: `Game for Player with ID ${playerId} not found` });

        const game = gameRes.rows[0];

        // 3. Get move history
        const movesRes = await db.query(
            "SELECT * FROM moves WHERE player_id = $1 ORDER BY round ASC",
            [playerId]
        );

        const moves = movesRes.rows;

        // 4. Fugitive hidden‑move logic
        const revealRounds = [3, 8, 13, 18, 24]; // example reveal rounds

        const formattedMoves = moves.map(m => {
            const isRevealRound = revealRounds.includes(m.round);
            const gameOver = game.state === "over";

            return {
                moveId: m.id,
                round: m.round,
                ticket: m.ticket,
                destination:
                    player.role === "fugitive" && !isRevealRound && !gameOver
                        ? "hidden"
                        : m.destination
            };
        });

        // 5. Starting location (hidden for fugitive except reveal rounds)
        let startLocation = player.start_location;

        if (player.role === "fugitive" && game.state !== "over") {
            const firstMoveRound = moves.length > 0 ? moves[0].round : null;
            const isReveal = revealRounds.includes(firstMoveRound);

            if (!isReveal) startLocation = "hidden";
        }

        // 6. Return response
        return res.status(200).json({
            playerId,
            startLocation,
            moves: formattedMoves
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error." });
    }
});
