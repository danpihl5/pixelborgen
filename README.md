# Pixelborgen

Isometrisk tower-defence-spil i retro pixel-art til mobilen. Byg tårne langs vejen og forsvar borgen mod slim, flagermus, riddere og kæmpeslim.

Lavet med [Phaser 3](https://phaser.io), TypeScript og Vite. [Capacitor](https://capacitorjs.com) gør det til en app til iPhone og Android.

## Kom i gang

Du skal have [Node.js](https://nodejs.org) 20 eller nyere.

```bash
npm install        # hent pakkerne
npm run dev        # start spillet på http://localhost:5173 (også synligt på dit netværk)
npm test           # kør testene af spillogikken
npm run build      # byg spillet til mappen dist/
npm run build:single  # byg hele spillet som én HTML-fil i dist-single/
```

## Sådan er koden bygget op

```
src/
  game/        Spillets regler: kort, vej, tårne, fjender og bølger. Ingen grafik.
    data.ts      Tal for tårne og fjender (pris, skade, fart …). Justér balancen her.
    level.ts     Kortet og vejen.
    waves.ts     Hvilke fjender hver bølge består af.
    game.ts      Selve simuleringen.
    game.test.ts Test af reglerne.
  art/         Pixel-grafikken, tegnet i kode ved opstart.
  scenes/      Phaser-scenen, der tegner kortet isometrisk og håndterer tryk, træk og zoom.
  ui/          Knapper og menuer omkring kortet (HTML).
  iso.ts       Omregning mellem gitter og skærm.
  session.ts   Hvad spilleren er i gang med: valgt felt, hastighed, pause og rekord.
  audio.ts     Lydeffekter lavet med Web Audio.
```

Reglerne i `src/game` kender ikke til skærmen. Derfor kan grafikken skiftes ud, fx med håndtegnede PNG-filer, uden at spillet ændrer sig.

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
