<a id="readme-top"></a>

# Duel Game

Murderer vs Sheriff / Rivals style Roblox game, written in [roblox-ts](https://roblox-ts.com/). Started out as just a skin inventory I built to learn how that kind of system works, and it's slowly turned into a whole little economy: a shop, loot crates, gamepasses, gifting, trading between players, coins, the works.

[Play it](#play-it) · [Watch the demo](#video-demo) · [Questions? Slack me](#questions)

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About the project</a></li>
    <li><a href="#built-with">Built with</a></li>
    <li><a href="#how-it-fits-together">How it fits together</a></li>
    <li>
      <a href="#whats-actually-in-here">What's actually in here</a>
      <ul>
        <li><a href="#skins-and-inventory">Skins and inventory</a></li>
        <li><a href="#shop-crates-gamepasses-and-limiteds">Shop, crates, gamepasses, limiteds</a></li>
        <li><a href="#gifting">Gifting</a></li>
        <li><a href="#trading">Trading</a></li>
        <li><a href="#currency">Currency</a></li>
        <li><a href="#death-effects">Death effects</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting started</a>
      <ul>
        <li><a href="#youll-need">You'll need</a></li>
        <li><a href="#running-it">Running it</a></li>
      </ul>
    </li>
    <li><a href="#testing-it">Testing it</a></li>
    <li><a href="#the-old-weight-system">The old weight system</a></li>
    <li><a href="#ai-usage">AI usage</a></li>
    <li><a href="#video-demo">Video demo</a></li>
    <li><a href="#questions">Questions</a></li>
  </ol>
</details>

## About the project

Every player spawns with the same three weapons, a rifle, a revolver, a knife. You don't unlock or buy the weapons themselves, they're just always there. What you're actually collecting is skins for them, one equipped per slot, plus a death effect that plays wherever you die.

I built the inventory part of this first, mostly to learn how inventory systems are usually put together. Read up on how survival/RPG games structure theirs, kept the ideas that made sense here (the server owns everything, the client just gets told what changed), and dropped the rest since a cosmetic game doesn't need stacking or weight limits or any of that. Once that foundation existed it was pretty easy to keep building on it, and now there's a shop, crates, gamepasses, gifting, and trading sitting on top.

Nowhere near done, but it plays.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built with

- [roblox-ts](https://roblox-ts.com/) - writing this in TypeScript instead of raw Luau
- [@rbxts/profile-store](https://github.com/MadStudioRoblox/ProfileStore) - handles the DataStore side, saving on leave, and delivering gifts to players who are offline when they're sent
- [Rojo](https://rojo.space/) - syncs everything into Studio
- ESLint + Prettier, with the roblox-ts plugin

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How it fits together

Server decides everything, client just draws it. If the server hasn't said you own something, you don't own it, full stop.

```
SERVER - the real state: inventory, coins, gamepasses, whatever a trade or purchase decides
  |                                    ^
  | tells the client what changed      | asks to equip / buy / trade / gift
  v                                    |
CLIENT - keeps its own copy in sync, draws the UI off of that
```

Both sides read from the same files in `shared/` (`Catalog.ts`, `Cases.ts`, `Gamepasses.ts`, `Monetization.ts`), so a skin or a crate or a gamepass only ever gets defined once. No risk of the client thinking something costs a different amount than the server does.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## What's actually in here

### Skins and inventory

The catalog is where every skin's actual info lives, name, image, rarity, which weapon slot it's for, which crate (if any) can drop it. That's `shared/Catalog.ts`, one entry per skin id. What a player owns is stored as basically nothing, just `{ id, uuid }`, and everything else gets looked up from the catalog when needed. Means an image only has to live in one place, and it never has to travel over the network at all since the client already has the same catalog loaded.

The `uuid` doesn't do much yet outside of giving trading something specific to point at (and stopping people from duping a copy of something). Everything else, adding, removing, equipping, just works off the plain `id`.

Four slots: rifle, revolver, knife, death effect. Everyone starts with the default skin in each one so nothing's ever sitting empty, and those defaults can't be traded away, they're the fallback if you ever unequip something. Adding a new skin is just adding one entry to the catalog, nothing else to touch.

### Shop, crates, gamepasses, limiteds

Six crates right now (green, blue, purple, yellow, red, and a plus one locked behind the Plus gamepass), each with its own price, its own odds by rarity, and its own opening animation. Whatever's droppable from a crate is decided entirely by the catalog, a skin just lists which crate id(s) it belongs to.

Gamepasses grant a fixed set of skins the moment you buy them (clown set, limited bundle, plus), except for the 2x earnings one which just doubles your coin gain. Ownership gets checked against actual Roblox records every time you join, so even if a save gets corrupted or wiped, you don't lose something you paid real money for.

Limiteds are simpler, one developer product, buy it, get the bundle straight into your inventory, no crate involved.

### Gifting

You can gift a gamepass or a limited bundle to someone else in the server for 10% less than buying it yourself. That discount isn't just a number on the label, it's an actual separate developer product priced lower, so what you see is what actually gets charged. Whoever you're gifting to gets recorded server side right before the purchase prompt shows up, and if they've left the server by the time it goes through, the buyer just gets it instead, better than the Robux disappearing into nothing.

### Trading

Pretty standard trade flow: pick items from your inventory, watch what the other person offers update live on your screen, hit ready when you're happy. Once both sides are ready a 10 second countdown kicks off, and touching your offer at all during that resets it. Right before anything actually swaps, the server double checks both people still own what they said they would, so nothing weird can happen if someone's inventory changed mid-trade.

### Currency

Coins come from playing matches, and get spent in the shop on crates. The 2x earnings gamepass doubles whatever you'd normally get.

### Death effects

Whatever death effect skin you've got equipped plays where you died, and everyone in the server sees it, not just you. Server figures out which effect and where, sends it to every client, and each client spawns it in, lets the particles burst, then cleans it up a few seconds later.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting started

### You'll need

- Node and npm
- Rojo, both the Studio plugin and the CLI
- Roblox Studio

### Running it

Clone it, then:

```sh
npm install
npm run watch
```

`npm run watch` rebuilds on save, `npm run build` does a one off build. Once that's running, open the project in Studio through Rojo using `default.project.json` and you're good.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Testing it

There are a handful of chat commands hardcoded to my own UserId in `server/main.server.ts`, from back when I was testing without any UI at all:

- `add <id>` gives yourself a skin, e.g. `add seer`
- `remove <id>`
- `equip <id>`
- `get state` dumps your inventory to the output
- `coins` prints your balance
- `earn <n>` / `spend <n>`

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## The old weight system

Before any of this, I'd built a full survival style inventory, weight limits, stacking, hotbar and storage slots, dropping stuff on the ground, all of it. Spent a while on it too. Then I realized none of that fits a game where you just pick a skin per weapon slot, so I ripped the whole thing out and replaced it with what's here now. If you're curious what that version looked like, it's still sitting in commit `778d051`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## AI usage

Used it for debugging and looking up Roblox API specifics, and for putting together diagrams and file layout notes on earlier drafts of this readme.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Video demo

https://github.com/user-attachments/assets/a5237e4f-1cca-43d1-89da-853a3781ec80

## Play it

The game is tester only right now message me your roblox username on slack to get access  
https://www.roblox.com/games/100643617969932/ULTIMATE-DUELS

## Questions

Msg me on Slack, username firancly, id `U0BDBQL1PNV`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

README template from https://github.com/othneildrew/Best-README-Template
