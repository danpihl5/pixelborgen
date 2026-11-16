# Pixelborgen

Isometrisk city-builder med tower-defence-elementer i pixel-art til mobilen. Byg din by omkring slottet, og forsvar den mod den røde hær.

Spillet er i gang med at blive bygget. Lige nu kan man placere sit slot (2 × 2 felter) på et kort på 30 × 30 felter og derefter bygge ølstue, farmerhus og troldmandshus (1 × 1 felt hver).

**Bemærk:** Bygningernes grafik i `src/assets/` er klippet ud af andres billeder (bl.a. et stockfoto med vandmærke og et signeret pixel-art-billede) og er kun midlertidige pladsholdere. Billederne skal købes med licens, bruges med kunstnerens tilladelse eller erstattes af egen grafik, før spillet udgives.

Lavet med [Phaser 3](https://phaser.io), TypeScript og Vite. [Capacitor](https://capacitorjs.com) gør det til en app til iPhone og Android.

## Kom i gang

Du skal have [Node.js](https://nodejs.org) 20 eller nyere.

```bash
npm install        # hent pakkerne
npm run dev        # start spillet på http://localhost:5173 (også synligt på dit netværk)
npm test           # kør testene af spillets regler
npm run build      # byg spillet til mappen dist/
npm run build:single  # byg hele spillet som én HTML-fil i dist-single/
```

## Sådan er koden bygget op

```
src/
  game/        Spillets regler: kortet og bygningerne. Ingen grafik.
    city.ts      Kortet (30 × 30 felter) og placering af bygninger.
    scenery.ts   Træer og sten, der optager felter på kortet.
    city.test.ts Test af reglerne.
  art/         Terræn, træer og sten tegnes i kode ved opstart. Bygningerne hentes fra billeder.
  assets/      Billedfiler til bygningerne.
  scenes/      Phaser-scenen, der tegner kortet isometrisk og håndterer tryk, træk og zoom.
  ui/          Knapper og tekst omkring kortet (HTML).
  iso.ts       Omregning mellem gitter og skærm.
  session.ts   Hvad spilleren er i gang med, fx hvor slottet skal stå.
  audio.ts     Lydeffekter lavet med Web Audio.
```

Reglerne i `src/game` kender ikke til skærmen. Derfor kan grafikken skiftes ud, fx med håndtegnede PNG-filer, uden at spillet ændrer sig.

Tower-defence-versionen af spillet findes stadig i Git-historikken (commit `d19260c`), hvis vi vil hente tårne og fjender tilbage.

## Lav en app med Capacitor

Capacitor er sat op i `capacitor.config.ts`. Selve app-projekterne er ikke lavet endnu, fordi de kræver værktøjer på din egen computer.

**Android** (kræver [Android Studio](https://developer.android.com/studio)):

```bash
npm install @capacitor/android
npm run build
npx cap add android
npx cap sync
npx cap open android   # åbner projektet i Android Studio, hvor du kan køre det på en telefon
```

**iPhone** (kræver en Mac med [Xcode](https://developer.apple.com/xcode/)):

```bash
npm install @capacitor/ios
npm run build
npx cap add ios
npx cap sync
npx cap open ios
```

Efter hver ændring i spillet: `npm run build && npx cap sync`.

For at udgive i butikkerne skal du have en Apple-udviklerkonto (99 dollar om året) og/eller en Google Play-konto (25 dollar én gang).
