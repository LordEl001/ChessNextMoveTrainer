import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Chess } from "chess.js";

// Helper to fetch with an abortable timeout (e.g., 5 seconds)
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Maps difficulty to engine depth consistently
function mapDifficultyToDepth(level: number): number {
  if (level <= 5) {
    return Math.max(1, Math.round(level));
  }
  return 5 + (Math.round(level) - 5) * 2;
}

// Parses varied move strings (e.g., UCI "e2e4" or SAN "Nf3") and aligns coordinates if legal
function parseMoveToCoordinates(fen: string, moveString: string): { from: string; to: string; promotion?: string } | null {
  if (!moveString) return null;
  const temp = new Chess(fen);
  
  // 1. Try standard play via chess.js (SAN/UCI auto-align)
  try {
    const res = temp.move(moveString);
    if (res) {
      return {
        from: res.from,
        to: res.to,
        promotion: res.promotion,
      };
    }
  } catch (e) {
    // Continue
  }

  // 2. Clear UCI notation (e.g., d2d4, g1f3, e7e8q)
  const cleanStr = moveString.trim().replace(/[^a-zA-Z0-9]/g, "");
  if (cleanStr.length === 4 || cleanStr.length === 5) {
    const from = cleanStr.substring(0, 2);
    const to = cleanStr.substring(2, 4);
    const promotion = cleanStr.length === 5 ? cleanStr.substring(4, 5) : undefined;
    try {
      const trial = new Chess(fen);
      const res = trial.move({ from, to, promotion });
      if (res) {
        return { from, to, promotion };
      }
    } catch (_) {}
  }

  // 3. Fallback legal search list
  const legalMoves = temp.moves({ verbose: true });
  for (const m of legalMoves) {
    if (
      m.san.toLowerCase() === moveString.toLowerCase() ||
      m.lan.toLowerCase() === moveString.toLowerCase() ||
      `${m.from}${m.to}`.toLowerCase() === moveString.toLowerCase()
    ) {
      return {
        from: m.from,
        to: m.to,
        promotion: m.promotion,
      };
    }
  }

  return null;
}

// Resilient fallback/fail-fast fetch loop executing server-side
async function getBackendComputerMove(fen: string, difficulty: number): Promise<{ from: string; to: string; promotion?: string }> {
  const depth = mapDifficultyToDepth(difficulty);
  const apis = [];

  // API 1: Chess-API
  apis.push({
    name: "Chess-API",
    func: async () => {
      const response = await fetchWithTimeout("https://chess-api.com/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen, depth }),
      }, 2000);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      const rawMove = data.move || data.bestmove;
      if (!rawMove) throw new Error("No move found key in Chess-API response");
      const parsed = parseMoveToCoordinates(fen, rawMove);
      if (!parsed) throw new Error(`Could not parse move: "${rawMove}"`);
      return parsed;
    }
  });

  // API 2: Stockfish Online
  apis.push({
    name: "Stockfish Online",
    func: async () => {
      const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${depth}`;
      const response = await fetchWithTimeout(url, { method: "GET" }, 2000);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      const dataString = data.data;
      if (!dataString || typeof dataString !== "string") throw new Error("Empty data string in Stockfish Online response");
      const match = dataString.match(/bestmove\s+([a-zA-Z0-9]+)/);
      if (!match || !match[1]) throw new Error(`Could not locate bestmove inside: "${dataString}"`);
      const parsed = parseMoveToCoordinates(fen, match[1]);
      if (!parsed) throw new Error(`Could not parse Stockfish move: "${match[1]}"`);
      return parsed;
    }
  });

  // API 3: Lichess Cloud (Skipped for difficulty level <= 7 as requested)
  if (difficulty >= 8) {
    apis.push({
      name: "Lichess Cloud",
      func: async () => {
        const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`;
        const response = await fetchWithTimeout(url, { method: "GET" }, 2000);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        if (!data.pvs || !Array.isArray(data.pvs) || data.pvs.length === 0) throw new Error("Empty PV lines from Lichess");
        const pv = data.pvs[0];
        if (!pv || !pv.moves || typeof pv.moves !== "string") throw new Error("Moves PV list empty");
        const movesArray = pv.moves.trim().split(/\s+/);
        const rawMove = movesArray[0];
        if (!rawMove) throw new Error("Lichess moves split array empty");
        const parsed = parseMoveToCoordinates(fen, rawMove);
        if (!parsed) throw new Error(`Could not parse Lichess move: "${rawMove}"`);
        return parsed;
      }
    });
  }

  let attemptCount = 0;
  while (true) {
    for (let i = 0; i < apis.length; i++) {
      const api = apis[i];
      try {
        console.log(`[Proxy AI] Activating ${api.name} (attempt ${attemptCount + 1}) for FEN: ${fen}`);
        const result = await api.func();
        if (result) {
          console.log(`[Proxy AI] Match! Move returned by ${api.name}: ${result.from} -> ${result.to}`);
          return result;
        }
      } catch (err: any) {
        console.warn(`[Proxy AI] Warning: ${api.name} query failed: ${err.message || err}`);
      }
    }
    
    attemptCount++;
    if (attemptCount >= 1) {
      // Robust emergency fail-fast fallback (after 1 attempt on each API) if hosts are offline/blocked to prevent game lockup
      console.warn("[Proxy AI] Warning: All API fallback query attempts exhausted. Selecting local legal fallback move.");
      const gameObj = new Chess(fen);
      const legal = gameObj.moves({ verbose: true });
      if (legal.length > 0) {
        // Attempt heavy capture or pick first
        const captures = legal.filter(m => m.captured);
        const fallbackMove = captures.length > 0 ? captures[0] : legal[Math.floor(Math.random() * legal.length)];
        return {
          from: fallbackMove.from,
          to: fallbackMove.to,
          promotion: fallbackMove.promotion,
        };
      }
      throw new Error("Game position has zero legal moves left.");
    }
    
    // Non-blocking wait before cycling again
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route proxying requests server-side
  app.get("/api/computer-move", async (req, res) => {
    const fen = req.query.fen as string;
    const difficultyLevel = Number(req.query.difficulty || "5");

    if (!fen) {
      return res.status(400).json({ error: "Query parameter 'fen' is required" });
    }

    try {
      const result = await getBackendComputerMove(fen, difficultyLevel);
      res.json(result);
    } catch (err: any) {
      console.error("[Backend computer-move Route error]:", err);
      res.status(500).json({ error: err.message || "Failed to parse a legal computer chess action" });
    }
  });

  // Dev server and production file-host routing
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: true,
        strictPort: true,
        hmr: {
          host: "localhost",
          protocol: "ws"
        },
        watch: {
          usePolling: true
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Chess Server loaded! Interactive on port ${PORT}`);
  });
}

startServer();
