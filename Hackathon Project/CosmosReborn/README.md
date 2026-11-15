#Story

- Beginning: (starts with a scene of floating in space and crash landing on the moon. This starts the story, after the sudden crash land multiple players or one wake up depending on “multi or single player.”) {keep a side plot of the players being able to survive without a space suit.}
Act I: (Idea b) Start off with building a simple base, to survive trying to learn and find different materials (are the materials common or not?) in order to build this, no story will be told during this to keep a mysterious story during act 1. (playtime 2 hrs?)
Act II: when the actual story begins, this act will take about (4 hrs) it is meant to be confusing and make you go around the moon, finding materials, special animals and anomalies, by finding these it will lead you to create a civilization (idea A)
Act III: (idea c) begin using custom materials, and searching inside of the moon (6 hrs) you will dig into the ground find caves and explore (other planets possibly and stars.) you will explore these ideas to create new tools and have a minecraft gameplay of trying to progress in gear and survive, during this we will have a actual enemies start appearing, (humans in space suits and aliens and animals). You will be confused on whats happening and why you have to fight your own people (there will be blasters, swords etc to survive fight waves of monsters and the same people you once thought were your people.
Act 4: this when you got to start building a rocket home, you promise your town/civ to take everyone home (during this you will have an internal conflict “why are you able to survive without a spacesuit why are my own people hussing me down?) You will build a rocket and must protect it people will come again and again, this time killing or trying to. You will fight alongside your people building a rocket protecting your people and surviving. Each time they attack they can destroy your rocket and civ. You must rebuild your civ before you can continue on your rocket. (if you choose other there will be a 2nd ending) (10 hrs)
Act V: “finale” (idea D) this is when the game is about to end you finish everything the rockets (but you must find fuel in the world using drills and other things and get rdy to start your rocket. Depending on what you did on act 4 the ending will either allow you home or your own people will destroy the spacecraft because you left them. (9 hrs)
story : (only real impact start and act 4 and 5 middle is empty and more mystery.













Task/Quest Story Missions

ACT 1 SURVIVAL
Crash Landing Explore the crash site and salvage 3 useful supplies. Complete when all are collected.
First Materials Collect 10 moon rocks, 6 metal scraps, and 4 crystals. Complete when resources are stored.
A Place to Stay Craft a pickaxe and build shelter, storage, and power. Complete when all parts work.
First Exploration Scout nearby Moon terrain and return to base. Complete when a location is mapped.
Optional: Strange Survival Find early clues about why you can survive without a spacesuit; preserve the mystery.

ACT 2 
Beyond the Base Discover 3 new Moon regions. Complete when all are mapped.
Unusual Life Scan 2 alien creatures and gather samples. Complete when research is recorded.
Anomaly Hunt Investigate 2 anomalies and trace a strange signal. Complete when a clue to the underground is found.
Growing Settlement Build housing, expanded storage, and reliable power. Complete when the settlement operates.
A New Community Help survivors and assign gathering, construction, or research jobs. Complete when the settlement can produce supplies.
Optional: Moon Survey Map hidden areas and collect rare materials.
Optional: Lunar Tools Forge a moon pickaxe from moon rock, scrap, and anomaly shards. Complete when crafted; it mines in two swings and yields extra rock.

ACT 3 
Into the Depths Upgrade mining tools and enter the caves. Complete when the first cave is reached.
Buried Resources Find rare underground materials for stronger equipment. Complete when delivered to base.
Gear Up Craft improved tools, armor, and a defensive weapon. Complete when equipped.
First Attack Survives an encounter with hostile creatures or humans in spacesuits. Complete when you escape or win.
Familiar Faces Investigate the humans' equipment to uncover clues about why they are attacking. Complete when a clue is logged.
Defend the Settlement Build defenses and survive a wave of enemies. Complete when the town remains functional.
Optional: Hidden Cavern Discover a secret cave with upgrade materials and lore.

ACT 4 
A Way Home Promise the settlement a way off the Moon and pick a launch site. Complete when rocket construction is started.
Blueprints for Escape Unlock plans for frame, engine, controls, fuel storage, and passenger space. Complete when blueprint is ready.
Build Together Gather rocket parts and construct its first sections. Complete at the first construction milestone.
Under Attack Protect the settlement and rocket during a raid. Complete when both survive.
Repair and Rebuild Fix damaged buildings or spacecraft components and improve defenses. Complete when critical parts work.
The Hard Choice: Choose to prepare an escape for everyone or prioritize leaving alone. Complete when the choice is saved for the ending.
Optional: Leave No One Behind Expand passenger capacity and stockpile food and supplies.

ACT 5 ONE WAY HOME: FINALE
Final Assembly Complete the engines, controls, fuel tanks, and remaining rocket sections. Complete at 100% construction.
Fuel for the Journey Build/use drills to find and collect launch fuel. Complete when fuel quota is met.
Preflight Check Test power, engines, fuel, and passenger plans. Complete when checks pass.
Last Stand Defend the launch site during the final enemy attack and repair critical damage. Complete when ready to launch.
Countdown Start the launch sequence and trigger the finale.
Ending A Together We Leave: Supporting the town and preparing enough supplies/capacity allows everyone to escape.
Ending B Broken Promise: Abandoning the settlement can cause the betrayed community to stop or destroy the rocket.
Optional: The Truth Discover extra clues about surviving without a spacesuit and the hostile humans.

















AI stuff
AI QUEST TRACKING
Track current act, quest ID, objective counts, inventory, explored areas, creature scans, base/rocket progress, enemy waves, and the Act IV choice. Example hint: “You've collected two moon rocks; try searching the nearby crater.”


 AI Mission Assistant 

The game will include an AI assistant that helps players when they get stuck or need guidance. It will use the game's quest tracker (in the code not visualized in game) to check the player's current objective, progress, and inventory. For example, if a quest asks the player to collect three moon rocks, the assistant can see how many they have collected and suggest where to search next. Players can also ask questions such as “What should I do next?” or “How do I complete this mission?” The AI will give useful hints without automatically completing the quest. If needed, it could also use information from the current game screen to provide more specific help. 

MOONLINK ASSISTANT (LIVE)
The lander's assistant lives in the tablet's A.I. app: press Tab to open the tablet, pick the green A.I. tile and ask it anything. Answers come from **Google Gemini** through SerpApi's `google_gemini` engine, so they are written prose rather than a list of links. ◀ HOME (or Esc while the input is empty) returns to the tablet home, Tab closes the tablet, and the conversation survives going back and forth.

What the panel shows, straight from Gemini's response:
- `text_blocks` as terminal text: paragraphs, headings (amber), bullet lists, tables and code blocks.
- Up to 4 `references` as a SOURCES list of numbered links (`[1]`, `[2]`, ...) under the answer.
- Up to 2 suggested follow-ups as dashed chips; tapping one sends it as the next question.

Answers are deliberately short: the persona caps them at one paragraph of about 55 words, so a reply fits the tablet screen without scrolling.

Every request carries the persona, the game guide, the player's live status (active quest, progress, inventory, location, nearest resources) and the question. That prompt is held under 7,000 characters: SerpApi answers a longer `q` with an empty `400` after about a minute, and reading that empty body is what used to surface as `LINK FAILED: UNEXPECTED END OF JSON INPUT`. Responses are now read as text and parsed defensively, so a failure prints something usable (`GEMINI WENT SILENT (HTTP 400)`, `GEMINI TOOK TOO LONG`), and a dropped connection is retried once.

**Persona:** before the first question, the server briefs Gemini as MOONLINK — the damaged core of a lander called the Kestrel: ominous, clipped, second person, treating the dark and the dust as things that listen. The briefing forbids it from inventing game rules, quest objectives, inventory or map locations, so hints stay in-fiction without contradicting the quest tracker. Because the thread is kept with a token, the voice carries through follow-ups for free.

How it stays a conversation: each response returns a `subsequent_request_token`, the client sends it back as `?token=` with the next question, and SerpApi replays the thread to Gemini, so "tell me more about that" keeps its context. Gemini expires tokens quickly, so a rejected token is retried once as a fresh question instead of erroring.

Running locally:
1. `cp .env.example .env` and paste your key from https://serpapi.com/manage-api-key into `SERPAPI_KEY`.
2. `npm run dev` and open the tablet's A.I. tab.

Deploying (Render):
The assistant cannot live in a static build — `/api/assist` needs a server holding the key. `server.js` is that server: it serves `dist/` and the endpoint, and Render runs it with `npm start`. The key is read from the environment (Render → Environment → `SERPAPI_KEY`), so it still never reaches the browser.
1. Commit a `render.yaml` blueprint (already in this repo) or create a Web Service pointing at this folder.
2. Build command `npm install && npm run build`, start command `npm start`.
3. Add `SERPAPI_KEY` as a secret env var (blueprints leave it unsynced so Render prompts for it).
4. Health check path `/healthz`.

To run the production build locally: `npm run build && npm start` (defaults to port 3000, honours `PORT`).

Voice input ("Hey AI"):
Click the `VOICE` control at the top of the game, allow the microphone, then say "Hey AI, how do we make air?". The browser records one utterance, posts it to `/api/stt`, and `server/stt.js` transcribes it with ElevenLabs Scribe using `ELEVENLABS_API_KEY`. The text after the wake phrase is sent to the existing MOONLINK assistant, the tablet opens on the A.I. screen, and the answer is spoken with the existing ElevenLabs voice. The mic pauses while a voice line is playing. The wake word can also be said alone; the next utterance becomes the question. If the browser blocks the microphone, the control shows `MIC BLOCKED`; allow mic access for the page (use Chrome/Edge if the packaged preview refuses it).

Both hosts share `server/assist.js`, which owns the persona, the block/reference mapping, the 10-minute cache and the errors. The endpoint returns 503 when the key is missing, so the A.I. app prints "SERPAPI_KEY IS MISSING FROM .env" instead of failing silently, and the header switches from "SIGNAL: WEAK" to "SIGNAL: LOST" after a failed query. Each new question costs one SerpApi search; repeats are cached per question and thread.

Live Earth rotation data (radio dish):
The dish's Earth-lock telemetry comes from the NASA CDDIS GNSS Earth Rotation Parameters (ERP) dataset: https://data.nasa.gov/dataset/global-navigation-satellite-system-gnss-earth-rotation-parameters-erp-products-from-nasa-c. The product is the IGS combined ERP (X/Y pole, UT1-UTC, LOD), DOI 10.5067/GNSS/GNSS_IGSERP_001. CDDIS requires an Earthdata login, so `server/earth.js` reads the same IGS product from the public BKG mirror (`https://igs.bkg.bund.de/root_ftp/IGS/products/{gps-week}/`), preferring observed rapid files over predicted ultra-rapid ones. Values are cached for three hours; if the mirror is unreachable, a bundled real record is served so the tablet and dish still work offline. The tablet home screen shows the current fix and the radio dish uses it for its Earth lock. Units are arcseconds for X/Y, seconds for UT1-UTC and milliseconds for LOD.










