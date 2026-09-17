import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm";

const video = document.querySelector("#video");
const canvas = document.querySelector("#outputCanvas");
const ctx = canvas.getContext("2d");
const placeholder = document.querySelector("#cameraPlaceholder");
const startButton = document.querySelector("#startButton");
const statusChip = document.querySelector("#statusChip");
const feedbackText = document.querySelector("#feedbackText");
const feedbackIcon = document.querySelector("#feedbackIcon");
const holdValue = document.querySelector("#holdValue");
const holdRing = document.querySelector("#holdRing");
const title = document.querySelector("#stretchTitle");
const instruction = document.querySelector("#stretchInstruction");
const options = [...document.querySelectorAll(".stretch-option")];

const stretches = {
  overhead: {
    title: "Overhead reach",
    instruction: "Stand tall and lift both arms above your head. Keep your shoulders relaxed.",
    evaluate: p => {
      const visible = ok(p, [11, 12, 15, 16, 23, 24]);
      if (!visible) return [false, "Step back until your upper body is visible."];
      const wristsHigh = p[15].y < p[11].y && p[16].y < p[12].y;
      const tall = midpoint(p[11], p[12]).y < midpoint(p[23], p[24]).y;
      return wristsHigh && tall ? [true, "Beautiful — reach upward and breathe."] : [false, "Lift both hands gently above your shoulders."];
    },
  },
  side: {
    title: "Side stretch",
    instruction: "Reach both hands overhead, then lean gently to either side without twisting.",
    evaluate: p => {
      if (!ok(p, [11, 12, 15, 16, 23, 24])) return [false, "Step back until your upper body is visible."];
      const shoulders = midpoint(p[11], p[12]);
      const hips = midpoint(p[23], p[24]);
      const lean = Math.abs(shoulders.x - hips.x) > .055;
      const handsUp = p[15].y < p[11].y || p[16].y < p[12].y;
      return lean && handsUp ? [true, "Hold there — keep breathing softly."] : [false, "Reach up, then lean a little to one side."];
    },
  },
  bend: {
    title: "Forward fold",
    instruction: "Hinge forward comfortably from your hips. Let your arms fall and keep a soft bend in your knees.",
    evaluate: p => {
      if (!ok(p, [11, 12, 15, 16, 23, 24, 25, 26])) return [false, "Step back so your torso and knees are visible."];
      const shoulders = midpoint(p[11], p[12]);
      const hips = midpoint(p[23], p[24]);
      const knees = midpoint(p[25], p[26]);
      const folded = shoulders.y > hips.y - .04 && shoulders.y < knees.y + .04;
      const handsLow = midpoint(p[15], p[16]).y > shoulders.y;
      return folded && handsLow ? [true, "Stay comfortable — let your neck relax."] : [false, "Hinge forward slowly from your hips."];
    },
  },
};

let poseLandmarker;
let selected = "overhead";
let lastVideoTime = -1;
let holdStarted = null;
let completed = new Set();
let rafId;

const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const ok = (points, indices) => indices.every(i => points[i] && (points[i].visibility ?? 1) > .55);

options.forEach(option => option.addEventListener("click", () => selectStretch(option.dataset.stretch)));
startButton.addEventListener("click", startCamera);

function selectStretch(key) {
  selected = key;
  holdStarted = null;
  holdValue.textContent = "0";
  holdRing.style.setProperty("--hold-progress", "0%");
  title.textContent = stretches[key].title;
  instruction.textContent = stretches[key].instruction;
  options.forEach(o => o.classList.toggle("active", o.dataset.stretch === key));
}

async function createLandmarker() {
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm");
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: .55,
    minTrackingConfidence: .55,
  });
}

async function startCamera() {
  startButton.disabled = true;
  startButton.textContent = "Starting…";
  feedbackText.textContent = "Loading movement detection…";
  try {
    poseLandmarker ||= await createLandmarker();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    placeholder.hidden = true;
    statusChip.hidden = false;
    predict();
  } catch (error) {
    startButton.disabled = false;
    startButton.textContent = "Try again";
    feedbackText.textContent = error.name === "NotAllowedError" ? "Camera permission was declined. Allow it in browser settings and try again." : "Camera could not start on this browser.";
  }
}

async function predict() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = poseLandmarker.detectForVideo(video, performance.now());
    draw(result);
    if (result.landmarks?.[0]) updateFeedback(result.landmarks[0]);
    else resetHold("Move into view so I can find your pose.");
  }
  rafId = requestAnimationFrame(predict);
}

function draw(result) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const drawing = new DrawingUtils(ctx);
  for (const landmarks of result.landmarks ?? []) {
    drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#f1c49e", lineWidth: 4 });
    drawing.drawLandmarks(landmarks, { color: "#607357", fillColor: "#fdf9f2", radius: 4, lineWidth: 2 });
  }
}

function updateFeedback(points) {
  statusChip.textContent = "Pose detected";
  const [correct, message] = stretches[selected].evaluate(points);
  feedbackText.textContent = message;
  feedbackIcon.textContent = correct ? "✓" : "↗";
  if (!correct) return resetHold(message, false);
  holdStarted ??= performance.now();
  const elapsed = Math.min(10, (performance.now() - holdStarted) / 1000);
  holdValue.textContent = Math.floor(elapsed);
  holdRing.style.setProperty("--hold-progress", `${elapsed * 10}%`);
  if (elapsed >= 10 && !completed.has(selected)) completeStretch();
}

function resetHold(message, updateMessage = true) {
  holdStarted = null;
  holdValue.textContent = "0";
  holdRing.style.setProperty("--hold-progress", "0%");
  statusChip.textContent = "Finding your pose…";
  feedbackIcon.textContent = "↗";
  if (updateMessage) feedbackText.textContent = message;
}

function completeStretch() {
  completed.add(selected);
  document.querySelector(`[data-stretch="${selected}"]`).classList.add("complete");
  document.querySelector("#completedCount").textContent = completed.size;
  document.querySelector("#sessionProgress").style.width = `${completed.size / 3 * 100}%`;
  feedbackText.textContent = "Stretch complete — nicely done.";
  if (completed.size < 3) {
    const next = Object.keys(stretches).find(key => !completed.has(key));
    setTimeout(() => selectStretch(next), 900);
  }
}

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(rafId);
  video.srcObject?.getTracks().forEach(track => track.stop());
});
