# Cosmos Reborn — 3:00 demo script

Matches the judging sheet row for row. The sheet reads like a mission-design game; Cosmos Reborn is a survival game, so each row maps to the closest real beat: the "mission" is the rocket, the "configuration" is sections and blueprints, the "resource limit" is fuel, and the "simulation run" is preflight plus launch. Do not claim a spacecraft-configuration screen.

## Before you start (10 minutes out)

- Load the prepared Act V save: all 5 rocket sections built, passenger bay built, 10 food loaded, Act IV choice = everyone, ice rig placed, power built and undamaged, preflight untested, fuel 4/12, **8 rocket fuel in the inventory**, player standing beside the rocket, blaster and power drill in the hotbar.
- Feed the settlers and clear enemies so no raid starts mid-demo.
- Open TAB › QUESTS once to confirm it reads "Fuel for the Journey 4/12", then Esc.
- Open TAB › A.I., ask `what should i do next?`, and close the tablet. The answer stays in the log during the demo. Do not move after asking: the cached answer is keyed to your live status.
- Sound on, dev menu closed, browser full screen at 100% zoom.
- Keep a screen recording of a successful launch as backup.

## 0:00–0:20 · Hook and problem

*[Title screen, or a slow shot of the crash site.]*

"Every better instrument on a space mission costs you power, mass, or money. Cosmos Reborn makes you feel that. You are stranded on the Moon, and every scrap you find can become a tool, a wall, a meal — or part of the rocket home. Players learn to budget under pressure, and the real chemistry of air and fuel."

## 0:20–0:40 · Your solution

*[Start the prepared save, walk one step so the base and rocket are visible.]*

"Cosmos Reborn is a pixel-art Moon survival game. You wake in the wreck of the Kestrel, breathing without a helmet, and nobody will explain why. Rebuild, keep survivors alive, then build a rocket home. MOONLINK, the lander's damaged A.I., reads your live quest, inventory and location, and answers in character."

## 0:40–1:50 · Gameplay demo

*[TAB › QUESTS.]*

"Act Five. The rocket is finished, but the tank holds four of the twelve fuel it needs. That is the whole game in one number."

*[Esc, stand at the rocket, press E on LOAD FUEL.]*

"Eight more fuel, processed from water ice drilled out of a crater that never sees sunlight. That ice is real: LCROSS found about five to six percent water in Cabeus. Melt it, split it with electricity, and you get hydrogen and oxygen — actual rocket propellant."

*[Tank hits 12/12. Press E through the four preflight checks.]*

"Fuel full. Power stable. Engines clean. Passenger bay loaded with ten food."

*[Quest flips to Countdown.]*

"Everyone I promised is on board."

*[E to launch. Let about ten seconds play, then keep talking over it.]*

## 1:50–2:20 · Learning and challenge fit

"Nothing here is free. Scrap spent on a turret is scrap not spent on the rocket. Settlers eat every seventy-five seconds of game time; hungry workers stop, and three hungry days loses one. Progression gates reward preparation: the anomaly guardians only open if you carry a blaster, and that blaster comes from a side quest, not from luck. The lesson is triage — what you protect, what you spend, and what you leave behind."

## 2:20–2:45 · What you built

"Everything you saw is playable, not a mockup: five acts of quests, mining and crafting, base building, settlement jobs and food, caves, blaster combat, two anomaly guardians, two endings, co-op rooms with a four-letter code, save and load, and MOONLINK — Gemini running server-side with the live game state, so the API key never reaches the browser. Art, sprites and UI are hand-built; voices use ElevenLabs. Still prototype: balance and pacing in the later acts, and difficulty tuning."

## 2:45–3:00 · Closing

"The takeaway: the Moon is a gas station if you are patient — but only if every scrap is spent like it matters. The last thing you see is everyone climbing aboard, one by one. Play it at [URL]."

## If you run long

- Cut the preflight narration; the four presses speak for themselves.
- Skip the launch with E after the liftoff shot.
- Drop the co-op sentence from "What you built" first.

## If a judge asks

- **Spacecraft configuration?** There is no mission-config screen; the equivalent is rocket sections, blueprints and the preflight checklist.
- **Real data?** Permanently shadowed polar craters near −230 °C, LCROSS's 5–6% water in Cabeus (2009), electrolysis of water into hydrogen and oxygen; solar power and ice mining drive the loop.
- **AI?** Gemini through SerpApi, briefed as MOONLINK, fed the live quest, progress, inventory and location; the server holds the key and caps the prompt so answers stay short.
