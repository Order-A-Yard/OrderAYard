app.post("/players/:playerId/moves", async (req, res) => { 
    const playerId = parseInt(req.params.playerId); 
    const { gameID, ticket, destination } = req.body; 

    function parseLocation(value) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            if (!normalized || normalized === "hidden") return null;
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }
    
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
            // Determine the true origin location used for edge validation.
            // Some game views hide Mr. X as "hidden"; movement still needs
            // to validate from their real numeric position.
                let originLocation = parseLocation(player.location);

                if (originLocation === null) {
                    originLocation = parseLocation(player.start_location);
                }

                if (originLocation === null) {
                    const lastMoveRes = await db.query(
                        "SELECT destination FROM moves WHERE player_id = $1 ORDER BY round DESC LIMIT 1",
                        [playerId]
                    );
                    if (lastMoveRes.rowCount > 0) {
                        originLocation = parseLocation(lastMoveRes.rows[0].destination);
                    }
                }

                if (originLocation === null) {
                    return res.status(400).json({
                        message: `Player with ID ${playerId} has no valid numeric start location to move from.`
                    });
                }
            // Validate map connection 
                const ticketCodeMap = {
                    yellow: ["yellow", "0", 0],
                    green: ["green", "1", 1],
                    red: ["red", "2", 2],
                    black: ["black", "3", 3]
                };
                const ticketCandidates = ticketCodeMap[ticket] || [ticket];

                // Primary schema: map_edges(locationA, locationB, ticket)
                const connRes = await db.query(
                    `SELECT 1 FROM map_edges
                     WHERE ((locationA = $1 AND locationB = $2)
                         OR (locationA = $2 AND locationB = $1))
                       AND (ticket = ANY($3::text[]) OR ticket::text = ANY($3::text[]))
                     LIMIT 1`,
                    [originLocation, destination, ticketCandidates.map(String)]
                );

                let hasConnection = connRes.rowCount > 0;

                // Team SQL schema fallback: connections(MapId, A, B, Ticket)
                if (!hasConnection) {
                    try {
                        const fallbackConnRes = await db.query(
                            `SELECT 1 FROM connections
                             WHERE MapId = $1
                               AND ((A = $2 AND B = $3) OR (A = $3 AND B = $2))
                               AND (Ticket = ANY($4::text[]) OR Ticket::text = ANY($4::text[]))
                             LIMIT 1`,
                            [game.map_id, originLocation, destination, ticketCandidates.map(String)]
                        );
                        hasConnection = fallbackConnRes.rowCount > 0;
                    } catch (fallbackErr) {
                        // If this schema/table is not present, keep primary result.
                        hasConnection = hasConnection || false;
                    }
                }

                if (!hasConnection)
                    return res.status(400).json({
                        message: `The Player with ID ${playerId} cannot move to location ${destination} with a ${ticket} ticket.`
                    });
            // Detectives cannot move onto a location occupied by another detective
                if (player.role === "detective") { 
                    const occupiedRes = await db.query( 
                        "SELECT * FROM players WHERE game_id = $1 AND role = 'detective' AND location = $2 AND id != $3", 
                        [gameID, destination, playerId] 
                    ); 
                    if (occupiedRes.rowCount > 0) 
                        return res.status(400).json({ 
                            message: `The Player with ID ${playerId} cannot move to location ${destination} as it is occupied by another detective.` 
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

            // Record move in history
            // Round is derived from total moves made across all players in this game.
                const roundRes = await db.query(
                    "SELECT COUNT(*) FROM moves WHERE player_id IN (SELECT id FROM players WHERE game_id = $1)",
                    [gameID]
                );
                const roundNumber = parseInt(roundRes.rows[0].count, 10) + 1;

                await db.query(
                    "INSERT INTO moves (player_id, ticket, destination, round) VALUES ($1, $2, $3, $4)",
                    [playerId, ticket, destination, roundNumber]
                );

            // End turn 
                await db.query("UPDATE players SET turn = FALSE WHERE id = $1", [playerId]); 

            // Advance turn to the next active player in this game.
            // Round-robin order is based on player id and wraps back
            // to the lowest id when reaching the end.
                const activePlayersRes = await db.query(
                    "SELECT id FROM players WHERE game_id = $1 AND active = TRUE ORDER BY id ASC",
                    [gameID]
                );

                const activeIds = activePlayersRes.rows.map(r => r.id);
                let nextPlayerId = null;
                if (activeIds.length > 0) {
                    const currentIdx = activeIds.indexOf(playerId);
                    const nextIdx = currentIdx >= 0
                        ? (currentIdx + 1) % activeIds.length
                        : 0;
                    nextPlayerId = activeIds[nextIdx];

                    await db.query("UPDATE players SET turn = TRUE WHERE id = $1", [nextPlayerId]);
                }

                return res.status(201).json({
                     message: "Move Successful", 
                     gameId: gameID, 
                     playerId, 
                     nextPlayerId,
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
