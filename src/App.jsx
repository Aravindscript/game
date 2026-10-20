import React, { useCallback, useEffect, useRef, useState } from "react";
import "./style.css";

const W = 1000;
const H = 460;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* Endless terrain: alternating big and small gaps */
const gaps = (() => {
  const result = [];
  let start = 700;

  for (let i = 0; i < 2000; i++) {
    const type = [ "big", "small", "big", "small", "big", "big", "small" ][i % 7];
    const width = type === "big"
      ? 235 + (i % 4) * 22
      : 75 + (i % 3) * 12;

    result.push({ start, end: start + width, type });
    start += width + 285 + (i % 4) * 85;
  }

  return result;
})();

function gapInfo(x) {
  let lo = 0;
  let hi = gaps.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const g = gaps[mid];

    if (x < g.start) hi = mid - 1;
    else if (x > g.end) lo = mid + 1;
    else return g;
  }

  return null;
}

function groundY(x) {
  return (
    300 +
    Math.sin(x * 0.003) * 55 +
    Math.sin(x * 0.006) * 38 +
    Math.sin(x * 0.0015) * 35 +
    Math.sin(x * 0.009) * 15 +
    Math.sin(x * 0.0007) * 30
  );
}

function roadY(x) {
  return gapInfo(x) ? null : groundY(x);
}

function initialGame() {
  return {
    x: 100,
    y: groundY(100) - 14,
    vx: 0,
    vy: 0,
    angle: 0,
    spin: 0,
    angularVelocity: 0,
    camera: 0,
    score: 0,
    distance: 0,
    grounded: true,
    frontLanding: false,
    landingTime: 0,
    crashed: false,
    collected: new Set(),
    hitRocks: new Set(),
  };
}

function Cloud({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle cx="-23" cy="0" r="17" fill="#fff" />
      <circle cx="-5" cy="-10" r="24" fill="#fff" />
      <circle cx="19" cy="-3" r="19" fill="#fff" />
      <ellipse cx="0" cy="6" rx="42" ry="13" fill="#f4fbff" />
    </g>
  );
}

function Wheel({ x, radius, spin }) {
  return (
    <g transform={`translate(${x} -3) rotate(${spin})`}>
      <circle r={radius} fill="#121a22" stroke="#050b12" strokeWidth="3" />
      <circle r={radius * 0.7} fill="#526676" stroke="#d5e2eb" strokeWidth="2" />

      {Array.from({ length: 8 }, (_, i) => (
        <path
          key={i}
          d={`M0 ${-radius * 0.27} L0 ${-radius * 0.61}`}
          transform={`rotate(${i * 45})`}
          stroke="#e6f0f7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}

      <circle r={radius * 0.2} fill="#f1f6fa" />
    </g>
  );
}

function Car({ angle, spin, airborne }) {
  return (
    <g transform={`rotate(${angle})`}>
      <path
        d="M-25 -12 L-28 -22 L-18 -26 M27 -12 L30 -20"
        stroke="#1b3449"
        strokeWidth="4"
        fill="none"
      />

      <path
        d="M-43 -18 L-35 -30 L-12 -40 L13 -36 L29 -25 L42 -21 L42 -12 L-40 -12 Z"
        fill="#0879e8"
        stroke="#163c62"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      <path
        d="M-31 -30 L-12 -37 L-4 -23 L-36 -23 Z"
        fill="#b6edff"
        stroke="#163c62"
        strokeWidth="2"
      />

      <path
        d="M-7 -36 L12 -33 L25 -23 L0 -23 Z"
        fill="#e5f9ff"
        stroke="#163c62"
        strokeWidth="2"
      />

      <path d="M-40 -19 L39 -19 L39 -15 L-41 -15 Z" fill="#64dfff" />
      <path d="M-43 -19 L-38 -19 L-38 -12 L-45 -12 Z" fill="#263e51" />
      <path d="M34 -20 L42 -18 L42 -13 L35 -13 Z" fill="#fff0ac" />

      <Wheel x={-24} radius={17} spin={spin} />
      <Wheel x={29} radius={11} spin={spin} />

      {airborne && (
        <path
          d="M-35 24 Q0 31 39 23"
          stroke="#e5faff"
          strokeWidth="2"
          opacity=".55"
          fill="none"
        />
      )}
    </g>
  );
}

function Rock({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-18 0 L-14 -14 L-4 -24 L10 -20 L20 0 Z"
        fill="#687987"
        stroke="#354653"
        strokeWidth="2"
      />
      <path d="M-14 -14 L-4 -24 L2 -10 L-8 -7 Z" fill="#b7c4cd" />
      <path d="M2 -10 L10 -20 L20 0 L7 0 Z" fill="#465866" />
    </g>
  );
}

function Box({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x="-13" y="-13" width="26" height="26" rx="4"
        fill="#ffbd36" stroke="#9e6418" strokeWidth="2.5"
      />
      <rect x="-7" y="-7" width="14" height="14" rx="2" fill="#fff0a2" />
      <path
        d="M-3 -4 H3 V4 M-3 0 H3"
        fill="none" stroke="#9e6418" strokeWidth="2"
      />
    </g>
  );
}

function WoodenBridge({ gap }) {
  const width = gap.end - gap.start;
  const y = groundY(gap.start);

  return (
    <g>
      <path
        d={`M${gap.start + 5} ${y + 7} V${y + 24}
             M${gap.end - 5} ${y + 7} V${y + 24}`}
        fill="none"
        stroke="#684021"
        strokeWidth="6"
      />

      <rect
        x={gap.start} y={y - 6} width={width} height="12"
        fill="#87532d" stroke="#603b20" strokeWidth="2"
      />

      {Array.from({ length: Math.floor(width / 17) }, (_, i) => (
        <g key={i}>
          <rect
            x={gap.start + i * 17 + 1}
            y={y - 7}
            width="14"
            height="14"
            rx="1"
            fill={i % 2 ? "#ad7543" : "#d09a60"}
            stroke="#754724"
            strokeWidth="1"
          />
          <path
            d={`M${gap.start + i * 17 + 4} ${y - 4} l6 8`}
            stroke="#80532f"
            strokeWidth="1"
          />
        </g>
      ))}
    </g>
  );
}

export default function App() {
  const game = useRef(initialGame());
  const keys = useRef({ gas: false, brake: false });

  const [hud, setHud] = useState({
    score: 0,
    speed: 0,
    distance: 0,
    crashed: false,
  });

  const restart = useCallback(() => {
    game.current = initialGame();
    keys.current = { gas: false, brake: false };
    setHud({ score: 0, speed: 0, distance: 0, crashed: false });
  }, []);

 const jump = useCallback(() => {
  const g = game.current;

  if (g.crashed) return;

  const frontX = g.x + 29;

  const nearBigGap = gaps.some(
    gap =>
      gap.type === "big" &&
      frontX >= gap.start - 45 &&
      frontX <= gap.start + 10
  );

  if (g.grounded || nearBigGap) {
    g.vy = -440;
    g.grounded = false;
    g.frontLanding = false;
    g.angularVelocity = -8;
  }
}, []);

  useEffect(() => {
    const keyDown = e => {
      if (["ArrowRight", "ArrowLeft", "ArrowUp", " "].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        keys.current.gas = true;
      }

      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        keys.current.brake = true;
      }

      if (e.key === "ArrowUp" || e.key === " ") jump();
      if (e.key.toLowerCase() === "r") restart();
    };

    const keyUp = e => {
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        keys.current.gas = false;
      }

      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        keys.current.brake = false;
      }
    };

    const clearKeys = () => {
      keys.current = { gas: false, brake: false };
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clearKeys);

    let frame;
    let last = performance.now();
    let lastHud = 0;

    function tick(now) {
      const dt = Math.min((now - last) / 1000, 0.02);
      last = now;

      const g = game.current;

      if (!g.crashed) {
        const accelerating = keys.current.gas;
        const braking = keys.current.brake;

        if (accelerating) g.vx += 150 * dt;
        if (braking) g.vx -= 100 * dt;

        if (g.grounded) {
          const slope = (groundY(g.x + 12) - groundY(g.x - 12)) / 24;
          g.vx += slope * 220 * dt;
        }

        g.vx *= Math.pow(0.999, dt * 60);
        g.vx = clamp(g.vx, -260, 500);
        const previousX = g.x;
const nextX = Math.max(35, previousX + g.vx * dt);

const reachedBigGap = g.grounded
  ? gaps.find(
      gap =>
        gap.type === "big" &&
        previousX + 29 < gap.start &&
        nextX + 29 >= gap.start
    )
  : null;

if (reachedBigGap) {
  // Keep forward momentum while falling into the gap.
  g.x = nextX;
  g.grounded = false;
  g.frontLanding = false;
} else {
  g.x = nextX;
}

        const rad = g.angle * Math.PI / 180;
        const frontX = g.x + 29 * Math.cos(rad) + 3 * Math.sin(rad);
        const rearX = g.x - 24 * Math.cos(rad) + 3 * Math.sin(rad);

        const frontGround = roadY(frontX);
        const rearGround = roadY(rearX);

        // Actual wheel-bottom positions, accounting for car rotation.
        const frontOffset = 29 * Math.sin(rad) - 3 * Math.cos(rad) + 11;
        const rearOffset = -24 * Math.sin(rad) - 3 * Math.cos(rad) + 17;

        const wasGrounded = g.grounded;

if (!g.grounded && !g.frontLanding) {
  g.vy += 820 * dt;
  g.y += g.vy * dt;

  if (accelerating) g.angularVelocity += 42 * dt;
  if (braking) g.angularVelocity -= 48 * dt;

  g.angularVelocity *= Math.pow(0.994, dt * 60);
  g.angularVelocity = clamp(g.angularVelocity, -115, 115);
  g.angle = clamp(g.angle + g.angularVelocity * dt, -65, 65);
}

        const frontBottom = g.y + frontOffset;
        const rearBottom = g.y + rearOffset;

        const frontContact =
          frontGround !== null &&
          g.vy >= 0 &&
          frontBottom >= frontGround;

        const rearContact =
          rearGround !== null &&
          g.vy >= 0 &&
          rearBottom >= rearGround;

        if (!wasGrounded && !g.frontLanding && frontContact) {
          // First touchdown: ONLY the front tyre touches the road.
          g.y = frontGround - frontOffset;
          g.vy = 0;
          g.frontLanding = true;
          g.landingTime = 0;
          g.angularVelocity = Math.max(g.angularVelocity, 0);
        } else if (!wasGrounded && !g.frontLanding && rearContact) {
          // Rear-first fallback for steep terrain.
          g.y = rearGround - rearOffset;
          g.vy = 0;
          g.grounded = true;
          g.angularVelocity *= 0.35;
        }

        if (g.frontLanding && !g.grounded) {
          g.landingTime += dt;

          if (frontGround !== null) {
            // Keep the front tyre on the surface while the rear comes down.
            g.y = frontGround - frontOffset;

            if (rearGround !== null) {
              const targetAngle =
                Math.atan2(frontGround - rearGround, frontX - rearX) *
                180 / Math.PI;

              g.angle += (targetAngle - g.angle) * Math.min(1, dt * 8);
            }

            const updatedRad = g.angle * Math.PI / 180;
            const updatedRearOffset =
              -24 * Math.sin(updatedRad) - 3 * Math.cos(updatedRad) + 17;

            if (
              rearGround !== null &&
              g.y + updatedRearOffset >= rearGround - 1
            ) {
              g.y = rearGround - updatedRearOffset;
              g.vy = 0;
              g.grounded = true;
              g.frontLanding = false;
              g.angularVelocity *= 0.25;
            }
          } else {
            // The front tyre has reached the edge of a gap.
            g.frontLanding = false;
            g.vy = 80;
          }

          if (g.landingTime > 0.24 && !g.grounded) {
            g.frontLanding = false;
          }
        }

        if (wasGrounded && !g.frontLanding) {
          if (frontGround !== null && rearGround !== null) {
            const targetAngle =
              Math.atan2(frontGround - rearGround, frontX - rearX) *
              180 / Math.PI;

            const diff = ((targetAngle - g.angle + 540) % 360) - 180;
            g.angle += diff * Math.min(1, dt * 9);

            const newRad = g.angle * Math.PI / 180;
            const fOffset = 29 * Math.sin(newRad) - 3 * Math.cos(newRad) + 11;
            const rOffset = -24 * Math.sin(newRad) - 3 * Math.cos(newRad) + 17;

            // Suspension smoothly follows the two tyre contact points.
            const targetY = Math.max(
              frontGround - fOffset,
              rearGround - rOffset
            );

            const suspension = targetY - g.y;
            g.y += suspension * Math.min(1, dt * 16);

            if (Math.abs(suspension) > 7 && g.vx > 100) {
              g.y -= Math.min(2, Math.abs(suspension) * 0.08);
            }

            g.vy = 0;
          } else {
            g.grounded = false;
            g.vy = Math.max(g.vy, 15);
          }
        }

        if (!g.grounded && !g.frontLanding) {
          g.vy += 820 * dt;
          g.y += g.vy * dt;

          if (accelerating) g.angularVelocity += 42 * dt;
          if (braking) g.angularVelocity -= 48 * dt;

          // Air resistance gradually damps rotation.
          g.angularVelocity *= Math.pow(0.994, dt * 60);
          g.angularVelocity = clamp(g.angularVelocity, -115, 115);
          g.angle = clamp(g.angle + g.angularVelocity * dt, -65, 65);
        }

        // Wheel rotation.
        g.spin += g.vx * dt * 3.2;

        // Coins / bonus boxes.
        const firstBox = Math.max(0, Math.floor((g.x - 100) / 420) - 2);
        const lastBox = Math.floor((g.x + 100) / 420) + 2;

        for (let i = firstBox; i <= lastBox; i++) {
          const bx = 520 + i * 420;

          if (g.collected.has(i) || gapInfo(bx)) continue;

          if (
            Math.abs(g.x - bx) < 34 &&
            Math.abs(g.y - (groundY(bx) - 47)) < 62
          ) {
            g.collected.add(i);
            g.score += 10;
          }
        }

        // Rocks cause a bump and loss of speed.
        const firstRock = Math.max(0, Math.floor((g.x - 100) / 1150) - 2);
        const lastRock = Math.floor((g.x + 100) / 1150) + 2;

        for (let i = firstRock; i <= lastRock; i++) {
          const rx = 1000 + i * 1150;

          if (g.hitRocks.has(i) || gapInfo(rx)) continue;

          if (
            Math.abs(g.x - rx) < 32 &&
            Math.abs(g.y + 5 - groundY(rx)) < 39
          ) {
            g.hitRocks.add(i);
            g.vx *= 0.68;
            g.vy = -300;
            g.angularVelocity = -65;
            g.grounded = false;
            g.frontLanding = false;
            g.y -= 5;
            break;
          }
        }

        if (g.y > H + 110) {
          g.crashed = true;
          g.vx = 0;
          g.vy = 0;
        }

        g.distance = Math.max(g.distance, Math.floor(g.x / 10));
        g.camera = Math.max(0, g.x - 250);
      }

      if (now - lastHud > 50) {
        lastHud = now;

        setHud({
          score: g.score,
          speed: Math.min(120, Math.round(Math.abs(g.vx) * 0.12)),
          distance: g.distance,
          crashed: g.crashed,
        });
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, [jump, restart]);

  const g = game.current;
  const camera = g.camera;

  const points = [];
  const start = Math.floor((camera - 100) / 10) * 10;
  const end = camera + W + 100;

  for (let x = start; x <= end; x += 10) {
    points.push({ x, y: groundY(x), gap: Boolean(gapInfo(x)) });
  }

  const terrain = [];
  let segment = [];

  for (const p of points) {
    if (p.gap) {
      if (segment.length > 1) terrain.push(segment);
      segment = [];
    } else {
      segment.push(p);
    }
  }

  if (segment.length > 1) terrain.push(segment);

  const clouds = Array.from({ length: 10 }, (_, i) => ({
    x: ((i * 153 - camera * 0.12) % 1400 + 1400) % 1400 - 100,
    y: 45 + (i % 3) * 43,
    scale: 0.65 + (i % 3) * 0.12,
  }));

  const visibleGaps = gaps.filter(
    gap => gap.end >= camera - 100 && gap.start <= camera + W + 100
  );

  const firstBox = Math.max(0, Math.floor((camera - 620) / 420));
  const lastBox = Math.floor((camera + W - 520) / 420) + 1;

  const firstRock = Math.max(0, Math.floor((camera - 1100) / 1150));
  const lastRock = Math.floor((camera + W - 1000) / 1150) + 1;

  return (
    <main className="hill-game">
      <header className="hud">
        <div className="brand"><span>▲</span> HILL CLIMB</div>

        <div className="stats">
          <div>DISTANCE <b>{hud.distance} m</b></div>
          <div>SPEED <b>{hud.speed} km/h</b></div>
          <div>SCORE <b>{hud.score}</b></div>
        </div>
      </header>

      <section className="viewport">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="game-svg"
          role="img"
          aria-label="Hill climb car game"
        >
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#098ee8" />
              <stop offset="100%" stopColor="#71d6ff" />
            </linearGradient>

            <linearGradient id="greenRoad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a7ed37" />
              <stop offset="100%" stopColor="#66ba20" />
            </linearGradient>
          </defs>

          <rect width={W} height={H} fill="url(#sky)" />
          <circle cx="850" cy="65" r="26" fill="#fff0a1" opacity=".95" />
          <circle cx="850" cy="65" r="40" fill="#fff0a1" opacity=".15" />

          {clouds.map((c, i) => <Cloud key={i} {...c} />)}

          <path
            d="M0 290 L95 135 L195 225 L350 105 L510 290 L660 175 L810 305 L925 205 L1000 270 L1000 460 L0 460 Z"
            fill="#304d70"
            transform={`translate(${-camera * 0.12} 0)`}
          />

          <path
            d="M0 315 L115 205 L205 265 L330 190 L475 315 L610 240 L755 330 L895 270 L1000 320 L1000 460 L0 460 Z"
            fill="#496584"
            transform={`translate(${-camera * 0.2} 0)`}
          />

          <g fill="#f3fbff" transform={`translate(${-camera * 0.12} 0)`}>
            <path d="M75 166 L95 135 L115 166 L96 158 Z" />
            <path d="M323 132 L350 105 L378 132 L352 124 Z" />
            <path d="M643 201 L660 175 L679 201 L660 194 Z" />
            <path d="M907 230 L925 205 L945 230 L925 222 Z" />
          </g>

          <path
            d={`M0 380 ${Array.from({ length: 16 }, (_, i) =>
              `L${i * 70} ${350 + Math.sin(i * 1.8) * 18}`
            ).join(" ")} L1000 460 L0 460 Z`}
            fill="#064e43"
          />

          <g transform={`translate(${-camera} 0)`}>
            {terrain.map((pts, i) => (
              <g key={i}>
                <path
                  d={`M${pts[0].x} 500 ${pts.map(p =>
                    `L${p.x} ${p.y}`
                  ).join(" ")} L${pts[pts.length - 1].x} 500 Z`}
                  fill="url(#greenRoad)"
                />

                <path
                  d={pts.map((p, j) =>
                    `${j === 0 ? "M" : "L"}${p.x} ${p.y}`
                  ).join(" ")}
                  fill="none"
                  stroke="#eaffad"
                  strokeWidth="4"
                />

                <path
                  d={pts.map((p, j) =>
                    `${j === 0 ? "M" : "L"}${p.x} ${p.y + 5}`
                  ).join(" ")}
                  fill="none"
                  stroke="#579d20"
                  strokeWidth="2"
                />
              </g>
            ))}

            {visibleGaps
              .filter(gap => gap.type === "small")
              .map(gap => <WoodenBridge key={gap.start} gap={gap} />)}

            {Array.from({ length: Math.max(0, lastBox - firstBox + 1) }, (_, j) => {
              const i = firstBox + j;
              const x = 520 + i * 420;

              if (g.collected.has(i) || gapInfo(x)) return null;

              return <Box key={i} x={x} y={groundY(x) - 48} />;
            })}

            {Array.from({ length: Math.max(0, lastRock - firstRock + 1) }, (_, j) => {
              const i = firstRock + j;
              const x = 1000 + i * 1150;

              if (gapInfo(x)) return null;

              return <Rock key={i} x={x} y={groundY(x) - 5} />;
            })}

            <g transform={`translate(${g.x} ${g.y})`}>
              <Car
                angle={g.angle}
                spin={g.spin}
                airborne={!g.grounded}
              />
            </g>
          </g>

          {hud.crashed && (
            <g>
              <rect width={W} height={H} fill="#071421" opacity=".8" />
              <text
                x={W / 2} y="200" textAnchor="middle"
                fill="white" fontSize="40" fontWeight="900"
              >
                GAME OVER
              </text>
              <text
                x={W / 2} y="238" textAnchor="middle"
                fill="#c8e2f8" fontSize="18"
>
Press RESTART to try again
              </text>
            </g>
          )}

          <rect x="0" y="444" width={W} height="16" fill="#17363c" />

          {Array.from({ length: 42 }, (_, i) => (
            <rect
              key={i}
              x={i * 25}
              y="448"
              width="15"
              height="6"
              rx="1"
              fill="#42636a"
            />
          ))}
        </svg>
      </section>

      <footer className="controls">
        <div className="instructions">
          <b>HILL CLIMB</b>
          <span>← BRAKE / REVERSE</span>
          <span>→ ACCELERATE</span>
          <span>SPACE JUMP</span>
        </div>

        <div className="buttons">
          <button
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              keys.current.brake = true;
            }}
            onPointerUp={() => { keys.current.brake = false; }}
            onPointerCancel={() => { keys.current.brake = false; }}
            onLostPointerCapture={() => { keys.current.brake = false; }}
          >←</button>

          <button
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              keys.current.gas = true;
            }}
onPointerUp={() => { keys.current.gas = false; }}
            onPointerCancel={() => { keys.current.gas = false; }}
            onLostPointerCapture={() => { keys.current.gas = false; }}
          >→</button>

          <button onClick={jump}>JUMP ↑</button>
          <button className="restart" onClick={restart}>RESTART ↻</button>
        </div>
      </footer>
    </main>
  );
}