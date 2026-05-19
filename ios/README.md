# Score Day — iOS Simulator Setup

## Requirements
- Xcode 16 or later (from the Mac App Store)
- No Node.js or other tools needed

## Steps

1. Open Xcode
2. File → Open → select the `App` folder inside this zip (the one containing `App.xcodeproj`)
3. Wait for Swift Package Manager to resolve dependencies (~1 min, needs internet)
4. In the toolbar, select any **iPhone Simulator** (e.g. iPhone 16)
5. Press **⌘R** (or the ▶ Run button)
6. Score Day will launch in the simulator

## What to test
- Register a new account with any email/password
- Add today's score and habits
- Check that data saves and reloads correctly
- Try the login/logout flow

## Backend
The app connects to a live backend at `https://score-day-backend.onrender.com`
(first request may take ~30 seconds if the server is sleeping — free tier)

## Feedback
Send feedback to: jainammomaya@gmail.com
