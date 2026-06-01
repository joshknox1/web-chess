/**
 * trainer.js
 * Contains the curriculum database for openings and puzzles, and manages the training state.
 */

// 1. OPENINGS DATABASE
const OPENINGS_DATABASE = [
    {
        id: 'ruy-lopez',
        name: 'Ruy Lopez',
        eco: 'C60',
        description: 'One of the oldest and most popular chess openings, focusing on quick kingside development and applying pressure to Black\'s central knight on c6.',
        moves: [
            { white: 'e4', black: 'e5', comment: 'Establish central pawns.' },
            { white: 'Nf3', black: 'Nc6', comment: 'Develop knight, attack pawn / defend pawn.' },
            { white: 'Bb5', black: '', comment: 'The Spanish signature. Pressure the c6 knight.' }
        ],
        hintMap: {
            1: { expected: 'e4', tip: 'Start with 1. e4 to control the center and free your bishop.' },
            2: { expected: 'Nf3', tip: 'Develop your knight to f3 to attack Black\'s e5 pawn.' },
            3: { expected: 'Bb5', tip: 'Develop your light-squared bishop to b5 to pin or pressure the c6 knight.' }
        }
    },
    {
        id: 'queens-gambit',
        name: 'Queen\'s Gambit',
        eco: 'D06',
        description: 'A classic queen-side fight. White offers a flank pawn on c4 to gain control of the center, which Black can accept or decline.',
        moves: [
            { white: 'd4', black: 'd5', comment: 'Symmetric queen pawn start.' },
            { white: 'c4', black: '', comment: 'The Gambit. Sacrificing a flank pawn to clear the center.' }
        ],
        hintMap: {
            1: { expected: 'd4', tip: 'Start with 1. d4 to stake a claim in the center.' },
            2: { expected: 'c4', tip: 'Play 2. c4 to challenge Black\'s d5 pawn. This is the Queen\'s Gambit!' }
        }
    },
    {
        id: 'sicilian-defense',
        name: 'Sicilian Defense (Open)',
        eco: 'B90',
        description: 'The most popular response to 1. e4. Black fights for the center asymmetrically with c5, leading to sharp, aggressive games.',
        moves: [
            { white: 'e4', black: 'c5', comment: 'Asymmetrical fight for the d4 square.' },
            { white: 'Nf3', black: 'd6', comment: 'Develop knight, preparing for center open.' },
            { white: 'd4', black: 'cxd4', comment: 'White opens the center.' },
            { white: 'Nxd4', black: 'Nf6', comment: 'Re-capture with Knight. Black attacks e4.' },
            { white: 'Nc3', black: '', comment: 'Develop knight to c3 to protect the e4 pawn.' }
        ],
        hintMap: {
            1: { expected: 'e4', tip: 'Begin with 1. e4, the king\'s pawn opening.' },
            2: { expected: 'Nf3', tip: 'Develop your knight to f3 to support the d4 thrust.' },
            3: { expected: 'd4', tip: 'Play 3. d4 to break open the center.' },
            4: { expected: 'Nxd4', tip: 'Capture back on d4 with your knight.' },
            5: { expected: 'Nc3', tip: 'Develop your knight to c3 to defend your e4 pawn.' }
        }
    },
    {
        id: 'caro-kann',
        name: 'Caro-Kann Defense',
        eco: 'B12',
        description: 'A highly solid and resilient defense for Black. Prepared by playing c6, Black intends to support d5 next, leading to a secure structure.',
        moves: [
            { white: 'e4', black: 'c6', comment: 'Prepares to support d5.' },
            { white: 'd4', black: 'd5', comment: 'Establish full pawn center / counter-attack.' }
        ],
        hintMap: {
            1: { expected: 'e4', tip: 'Play 1. e4 to occupy the center.' },
            2: { expected: 'd4', tip: 'Seize the full pawn center with 2. d4.' }
        }
    },
    {
        id: 'french-defense',
        name: 'French Defense',
        eco: 'C00',
        description: 'Black defends e4 with e6, intending to push d5 next. It creates a closed pawn structure with deep strategical complexities.',
        moves: [
            { white: 'e4', black: 'e6', comment: 'Prepares d5, blocks light-squared bishop.' },
            { white: 'd4', black: 'd5', comment: 'Control center / challenge White pawn.' }
        ],
        hintMap: {
            1: { expected: 'e4', tip: 'Play 1. e4 to release your pieces.' },
            2: { expected: 'd4', tip: 'Occupy the center with 2. d4.' }
        }
    }
];

// 2. TACTICS PUZZLES DATABASE
const PUZZLES_DATABASE = [
    {
        id: 'back-rank',
        name: 'Back-Rank Blunder',
        theme: 'Back-Rank / Mate in 1',
        difficulty: 'Easy',
        fen: '6k1/5ppp/p7/1p6/1P6/8/2Q2PPP/6K1 w - - 0 1',
        instructions: 'White to move and win. Find the checkmate in 1 move.',
        moves: ['Qc8#'], // White move solution
        hint: 'Black\'s king is trapped on the back rank behind its own pawns. Look for a queen move that checks the king.'
    },
    {
        id: 'scholars-mate',
        name: 'Scholar\'s Lesson',
        theme: 'Checkmate / Mate in 1',
        difficulty: 'Easy',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        instructions: 'White to move. Deliver the famous Scholar\'s Mate in 1.',
        moves: ['Qxf7#'],
        hint: 'Attack Black\'s weakest square, f7, which is only defended by the king, using your queen supported by the bishop.'
    },
    {
        id: 'knight-fork',
        name: 'Knight Fork Frenzy',
        theme: 'Double Attack / Fork',
        difficulty: 'Medium',
        fen: 'q3k3/5ppp/8/3N4/8/8/5PPP/6K1 w - - 0 1',
        instructions: 'White to move. Fork the black King and Queen to win material.',
        moves: ['Nc7+', 'Nxa8'], // White moves only, computer responds automatically between them
        expectedReplies: ['Kd8'], // Black response
        hint: 'Find a square where the knight can check the king and attack the queen at the same time.'
    },
    {
        id: 'smothered-mate',
        name: 'Smothered Beauty',
        theme: 'Queen Sacrifice / Mate in 2',
        difficulty: 'Hard',
        fen: '6rk/5Qpp/7N/8/8/8/6PP/6RK w - - 0 1',
        instructions: 'White to move and mate in 2. A classic smothered checkmate.',
        moves: ['Qg8+', 'Nf7#'],
        expectedReplies: ['Rxg8'],
        hint: 'Sacrifice the queen on g8 to force Black\'s rook to trap its own king, then checkmate with the knight.'
    },
    {
        id: 'rook-deflection',
        name: 'Rook Deflection Mate',
        theme: 'Deflection / Mate in 2',
        difficulty: 'Medium',
        fen: '4r1k1/5ppp/8/8/2B5/8/5QPP/6RK w - - 0 1',
        instructions: 'White to move and win. Deflect the defender to force checkmate.',
        moves: ['Qxf7+', 'Qxe8#'],
        expectedReplies: ['Kh8'],
        hint: 'Attack f7 first. Since the king is forced to move, you will win the rook on e8 with mate.'
    }
];

// 3. TRAINING ENGINE STATE MANAGERS
class OpeningTrainer {
    constructor(openingId, onMoveCallback, onCompleteCallback, onErrorCallback) {
        this.opening = OPENINGS_DATABASE.find(o => o.id === openingId);
        if (!this.opening) throw new Error(`Opening ${openingId} not found.`);
        
        this.onMove = onMoveCallback;
        this.onComplete = onCompleteCallback;
        this.onError = onErrorCallback;
        
        this.currentTurn = 1; // 1-indexed turn index
        this.state = 'white-to-move'; // or 'black-to-move' or 'completed'
    }

    /**
     * Checks if a user's white move is correct
     * @param {string} userSan - SAN move e.g., 'e4'
     */
    verifyMove(userSan) {
        if (this.state !== 'white-to-move') return false;

        const turnObj = this.opening.moves[this.currentTurn - 1];
        if (!turnObj) return false;

        if (turnObj.white === userSan) {
            // Correct move!
            this.onMove({
                color: 'w',
                san: userSan,
                comment: turnObj.comment,
                turn: this.currentTurn
            });

            // Is there a black response?
            if (turnObj.black) {
                this.state = 'black-to-move';
                setTimeout(() => {
                    this.playOpponentReply(turnObj.black);
                }, 800);
            } else {
                // Completed (no black reply on last move, e.g. Ruy Lopez Bb5)
                this.state = 'completed';
                this.onComplete();
            }
            return true;
        } else {
            // Wrong move
            const tip = this.opening.hintMap[this.currentTurn]?.tip || "Try checking the moves list.";
            this.onError(tip);
            return false;
        }
    }

    playOpponentReply(blackSan) {
        this.onMove({
            color: 'b',
            san: blackSan,
            comment: '',
            turn: this.currentTurn
        });
        
        this.currentTurn++;
        this.state = 'white-to-move';
        
        // If there are no more turns in the book, we completed the sequence
        if (this.currentTurn > this.opening.moves.length) {
            this.state = 'completed';
            this.onComplete();
        }
    }

    getCurrentStepText() {
        if (this.state === 'completed') return "Opening completed! Great job.";
        const turnObj = this.opening.moves[this.currentTurn - 1];
        return `Play <strong>${this.currentTurn}. ${turnObj.white}</strong>`;
    }
}

class PuzzleTrainer {
    constructor(puzzleId, onCorrectMove, onWrongMove, onComplete) {
        this.puzzle = PUZZLES_DATABASE.find(p => p.id === puzzleId);
        if (!this.puzzle) throw new Error(`Puzzle ${puzzleId} not found.`);
        
        this.onCorrect = onCorrectMove;
        this.onWrong = onWrongMove;
        this.onComplete = onComplete;
        
        this.step = 0; // Index of White move in puzzle.moves
        this.isSolved = false;
    }

    /**
     * Verifies the user move (SAN format)
     */
    verifyMove(userSan) {
        if (this.isSolved) return false;
        
        // Handle '#' suffix which is often added/removed dynamically
        const expected = this.puzzle.moves[this.step];
        const cleanUser = userSan.replace('#', '').replace('+', '');
        const cleanExpected = expected.replace('#', '').replace('+', '');
        
        if (cleanUser === cleanExpected) {
            this.onCorrect(expected, this.step, 'user');
            
            // Is there a computer reply next?
            if (this.puzzle.expectedReplies && this.puzzle.expectedReplies[this.step]) {
                const reply = this.puzzle.expectedReplies[this.step];
                setTimeout(() => {
                    this.playOpponentReply(reply);
                }, 800);
            } else {
                // Puzzle fully solved!
                this.isSolved = true;
                this.onComplete();
            }
            return true;
        } else {
            this.onWrong(this.puzzle.hint);
            return false;
        }
    }

    playOpponentReply(replySan) {
        this.step++;
        // Emit computer move back to board
        this.onCorrect(replySan, this.step, 'computer'); // Pass 'computer' source
    }
}
