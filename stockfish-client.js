/**
 * stockfish-client.js
 * Manages the client connection to the Stockfish chess engine running in a Web Worker.
 */

class StockfishClient {
    constructor(callbacks = {}) {
        this.onReady = callbacks.onReady || (() => {});
        this.onBestMove = callbacks.onBestMove || (() => {});
        this.onEvaluation = callbacks.onEvaluation || (() => {});
        this.onInfo = callbacks.onInfo || (() => {});
        
        this.worker = null;
        this.isReady = false;
        this.currentFen = 'startpos';
        this.isThinking = false;
        this.lastEval = 0.0;
        
        this.init();
    }

    /**
     * Initializes the Web Worker with Stockfish from a remote CDN using a Blob proxy
     */
    init() {
        try {
            console.log("Initializing Stockfish Engine (Loaded Locally)...");
            
            // Initialize local worker directly
            this.worker = new Worker('stockfish.js');
            
            this.worker.onmessage = (e) => {
                this.handleEngineMessage(e.data);
            };
            
            // Send initial UCI setup commands
            this.send('uci');
            this.send('isready');
            
        } catch (error) {
            console.error("Critical: Failed to spawn Stockfish Web Worker locally:", error);
        }
    }

    /**
     * Sends a raw command to the Web Worker
     */
    send(command) {
        if (this.worker) {
            this.worker.postMessage(command);
        }
    }

    /**
     * Terminates the engine worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

    /**
     * Starts calculating the best move for a given position
     * @param {string} fen - Chess FEN string
     * @param {number} level - AI Level (1 to 8)
     */
    calculateBestMove(fen, level) {
        if (this.isThinking) {
            this.send('stop');
        }
        
        this.currentFen = fen;
        this.isThinking = true;
        
        // Map UI level (1 to 8) to Stockfish options
        const settings = this.getDifficultySettings(level);
        
        this.send(`position fen ${fen}`);
        this.send(`setoption name Skill Level value ${settings.skill}`);
        
        // Send search command
        if (settings.depth > 0) {
            this.send(`go depth ${settings.depth} movetime ${settings.time}`);
        } else {
            this.send(`go movetime ${settings.time}`);
        }
    }

    /**
     * Requests evaluation of the current FEN without playing a move
     * @param {string} fen - Chess FEN string
     * @param {number} maxDepth - Max calculation depth
     */
    startEvaluation(fen, maxDepth = 15) {
        this.currentFen = fen;
        this.send(`position fen ${fen}`);
        this.send(`go depth ${maxDepth}`);
    }

    /**
     * Stops current engine calculations
     */
    stop() {
        this.send('stop');
        this.isThinking = false;
    }

    /**
     * Map levels to Stockfish UCI constraints
     */
    getDifficultySettings(level) {
        // Levels 1-8 mapping skill levels (0-20), max search depths, and thinking times
        const config = {
            1: { skill: 0, depth: 3, time: 200 },    // ~800 Elo
            2: { skill: 3, depth: 5, time: 400 },    // ~1100 Elo
            3: { skill: 7, depth: 8, time: 600 },    // ~1400 Elo
            4: { skill: 11, depth: 10, time: 800 },   // ~1700 Elo
            5: { skill: 14, depth: 12, time: 1200 },  // ~2000 Elo
            6: { skill: 17, depth: 14, time: 1500 },  // ~2200 Elo
            7: { skill: 19, depth: 16, time: 2000 },  // ~2400 Elo
            8: { skill: 20, depth: 18, time: 3000 }   // ~2700+ Elo
        };
        return config[level] || config[3];
    }

    /**
     * Processes message log text emitted by Stockfish worker
     */
    handleEngineMessage(message) {
        // Log to console for debugging if needed, but it outputs a lot.
        // console.log("SF Debug:", message);

        if (message === 'readyok') {
            this.isReady = true;
            this.onReady();
            return;
        }

        // 1. Parsing Best Move
        if (message.startsWith('bestmove')) {
            this.isThinking = false;
            const parts = message.split(' ');
            const moveUCI = parts[1];
            
            // Standard Stockfish can return '(none)' if game is checkmated/drawn
            if (moveUCI && moveUCI !== '(none)') {
                this.onBestMove(moveUCI);
            }
            return;
        }

        // 2. Parsing Info updates (evaluation and depth reports)
        if (message.startsWith('info')) {
            const info = this.parseInfoLine(message);
            if (info) {
                // If evaluation score was found
                if (info.score !== undefined) {
                    this.lastEval = info.score;
                    this.onEvaluation(info.score, info.type, info.depth);
                }
                
                this.onInfo(info);
            }
        }
    }

    /**
     * Parses the info output line containing depth, score, nps, pv (moves)
     */
    parseInfoLine(line) {
        const tokens = line.split(' ');
        const info = {
            raw: line,
            depth: 0,
            score: undefined,
            type: 'cp', // 'cp' for centipawns, 'mate' for mate in N
            pv: []
        };

        // Depth
        const depthIdx = tokens.indexOf('depth');
        if (depthIdx !== -1 && depthIdx + 1 < tokens.length) {
            info.depth = parseInt(tokens[depthIdx + 1], 10);
        }

        // Score centipawns or mate
        const scoreIdx = tokens.indexOf('score');
        if (scoreIdx !== -1 && scoreIdx + 2 < tokens.length) {
            const scoreType = tokens[scoreIdx + 1]; // 'cp' or 'mate'
            const scoreVal = parseInt(tokens[scoreIdx + 2], 10);
            
            info.type = scoreType;
            
            // Standard Stockfish returns scores relative to the side-to-move
            // Let's normalize it to be relative to WHITE (positive = white winning, negative = black winning)
            const activeColor = this.getActiveColorFromFen(this.currentFen);
            let scoreNormalized = scoreVal;
            
            if (activeColor === 'b') {
                scoreNormalized = -scoreVal;
            }
            
            if (scoreType === 'cp') {
                // Convert centipawns to standard pawn value (e.g. +120 -> +1.2)
                info.score = scoreNormalized / 100.0;
            } else if (scoreType === 'mate') {
                // Return moves to mate (e.g. 3 means white mates in 3, -3 means black mates in 3)
                info.score = scoreNormalized;
            }
        }

        // PV (Principal Variation - the list of suggested engine moves)
        const pvIdx = tokens.indexOf('pv');
        if (pvIdx !== -1) {
            info.pv = tokens.slice(pvIdx + 1);
        }

        return info;
    }

    /**
     * Extracts active player color ('w' or 'b') from FEN string
     */
    getActiveColorFromFen(fen) {
        if (!fen || fen === 'startpos') {
            return 'w';
        }
        const parts = fen.split(' ');
        if (parts.length > 1) {
            return parts[1]; // 'w' or 'b'
        }
        return 'w';
    }
}
