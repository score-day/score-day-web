import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export interface ScoreCardData {
  date: string;
  score: number;
  total: number;
  pct: number;
  streak: number;
  tasks: { title: string; completed: boolean; weight: number }[];
  username?: string | null;
}

const W = 900;
const H = 520;

// Always rendered in dark style so the card looks consistent regardless of app theme.
function drawCard(ctx: CanvasRenderingContext2D, data: ScoreCardData): void {
  const { date, pct, score, total, streak, tasks, username } = data;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d0d0f");
  bg.addColorStop(1, "#111318");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Accent glow behind score
  const glow = ctx.createRadialGradient(220, 260, 0, 220, 260, 200);
  const accentColor = pct >= 80 ? "#7c3aed" : pct >= 50 ? "#d97706" : "#dc2626";
  glow.addColorStop(0, accentColor + "22");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Left column: score ──
  ctx.textAlign = "left";

  // App name
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("SCORE DAY", 48, 58);

  // Score percentage — big
  const pctStr = `${pct}%`;
  ctx.font = `bold 112px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = pct >= 80 ? "#a78bfa" : pct >= 50 ? "#fbbf24" : "#f87171";
  ctx.fillText(pctStr, 40, 200);

  // pts sub-label
  ctx.font = "22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(`${score} / ${total} pts`, 48, 238);

  // Date
  ctx.font = "15px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillText(date, 48, 272);

  // Streak badge
  if (streak > 0) {
    const badgeX = 48;
    const badgeY = 305;
    const badgeTxt = `🔥 ${streak} day streak`;

    ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
    const tw = ctx.measureText(badgeTxt).width;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, badgeX - 8, badgeY - 18, tw + 24, 30, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(badgeTxt, badgeX, badgeY);
  }

  // Score bar
  const barX = 48, barY = 360, barW = 300, barH = 6;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, barX, barY, barW, barH, 3);
  ctx.fill();
  const filled = Math.round((pct / 100) * barW);
  if (filled > 0) {
    const barGrad = ctx.createLinearGradient(barX, 0, barX + filled, 0);
    barGrad.addColorStop(0, accentColor);
    barGrad.addColorStop(1, accentColor + "bb");
    ctx.fillStyle = barGrad;
    roundRect(ctx, barX, barY, filled, barH, 3);
    ctx.fill();
  }

  // Username footer
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillText(username ? `@${username}` : "scoreday.app", 48, H - 36);

  // ── Right column: task list ──
  const listX = 500;
  const topTasks = tasks.slice(0, 6);

  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillText("TASKS", listX, 58);

  topTasks.forEach((t, i) => {
    const y = 90 + i * 64;
    const done = t.completed;

    // Card background
    ctx.fillStyle = done ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.04)";
    roundRect(ctx, listX, y, W - listX - 48, 52, 10);
    ctx.fill();

    // Check circle
    const cx = listX + 22, cy = y + 26;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = done ? accentColor : "rgba(255,255,255,0.08)";
    ctx.fill();
    if (done) {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 4.5, cy);
      ctx.lineTo(cx - 1, cy + 4);
      ctx.lineTo(cx + 5, cy - 4);
      ctx.stroke();
    }

    // Title
    ctx.font = `${done ? "500" : "400"} 14px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = done ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)";
    const maxW = W - listX - 48 - 50;
    let title = t.title;
    while (ctx.measureText(title).width > maxW && title.length > 4) title = title.slice(0, -1);
    if (title !== t.title) title = title.slice(0, -1) + "…";
    ctx.fillText(title, listX + 42, y + 30);

    // Weight
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.textAlign = "right";
    ctx.fillText(`${t.weight}`, W - 56, y + 30);
    ctx.textAlign = "left";
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function buildCanvas(data: ScoreCardData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  drawCard(ctx, data);
  return canvas;
}

export async function shareScoreCard(data: ScoreCardData): Promise<void> {
  const canvas = buildCanvas(data);

  if (Capacitor.isNativePlatform()) {
    // Write PNG to cache dir, then share the file URI.
    const base64 = canvas.toDataURL("image/png").split(",")[1];
    const fileName = `scoreday-${data.date}.png`;
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
    await Share.share({
      title: `My Score Day — ${data.pct}%`,
      text: `I scored ${data.pct}% on Score Day${data.streak > 0 ? ` · 🔥 ${data.streak}-day streak` : ""}`,
      url: uri,
      dialogTitle: "Share your score",
    });
  } else {
    // Web: try File Share API, fallback to download.
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], `scoreday-${data.date}.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `Score Day — ${data.pct}%` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `scoreday-${data.date}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      }
    }, "image/png");
  }
}
