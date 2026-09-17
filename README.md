# Stretch for a SEC

A privacy-conscious browser prototype that uses a laptop or iPad camera to recognise simple stretching movements and provide real-time guidance.

**SEC** stands for **Safely, Effectively, Consistently** — and also suggests that stretching can fit into a small moment of the day.

## Prototype features

- On-device pose tracking with MediaPipe Pose Landmarker
- Three starter movements: overhead reach, side stretch, and forward fold
- Live skeleton overlay and posture prompts
- Ten-second hold timer and session progress
- Responsive interface for laptop and iPad browsers
- No video recording, upload, account, or backend

## Run locally

Camera access requires a secure context. Run the project through a local web server rather than opening `index.html` directly.

```bash
npx serve .
```

Open the localhost URL shown in the terminal, select **Enable camera**, and allow camera access.

## GitHub Pages

In the repository, open **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save. The HTTPS Pages URL will support browser camera access.

## Important limitation

This is an interaction-design prototype, not a medical or clinical assessment tool. Its simple landmark thresholds cannot determine whether a movement is safe for a particular person.
