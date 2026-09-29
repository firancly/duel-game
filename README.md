<a id="readme-top"></a>

# Duel Game

Murderer vs Sheriff / Rivals style Roblox game, built in roblox-ts (https://roblox-ts.com/). Started as a skin inventory, turned into a full economy: shop, crates, gamepasses, gifting, trading, coins.

[Play it](#play-it) | [Demo](#video-demo) | [Questions? Slack me](#questions)

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About the project</a></li>
    <li><a href="#built-with">Built with</a></li>
    <li><a href="#architecture">Architecture</a></li>
    <li>
      <a href="#systems">Systems</a>
      <ul>
        <li><a href="#inventory">Inventory</a></li>
        <li><a href="#shop-crates-gamepasses-limiteds">Shop, crates, gamepasses, limiteds</a></li>
        <li><a href="#gifting">Gifting</a></li>
        <li><a href="#trading">Trading</a></li>
        <li><a href="#currency">Currency</a></li>
        <li><a href="#death-effects">Death effects</a></li>
      </ul>
    </li>
    <li>
      <a href="#setup">Setup</a>
      <ul>
        <li><a href="#requirements">Requirements</a></li>
        <li><a href="#dev">Dev</a></li>
      </ul>
    </li>
    <li><a href="#dev-chat-commands">Dev chat commands</a></li>
    <li><a href="#the-old-weight-system">The old weight system</a></li>
    <li><a href="#ai-usage">AI usage</a></li>
    <li><a href="#video-demo">Video demo</a></li>
    <li><a href="#questions">Questions</a></li>
  </ol>
</details>

## About the project

Three weapons: rifle, revolver, knife. Everyone has them from spawn, nothing to unlock. You're collecting skins, one per weapon, plus a death effect.

Inventory came first as basically a learning project. Server owns state, client mirrors and renders. Everything else, shop, crates, gamepasses, gifting, trading, got built on that same base.

Still early. Works, people are playing it.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built with

- roblox-ts (https://roblox-ts.com/)
- @rbxts/profile-store (https://github.com/MadStudioRoblox/ProfileStore) for DataStores and offline gift delivery
- Rojo (https://rojo.space/)
- ESLint + Prettier, roblox-ts plugin

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Architecture

Server owns everything. Client just renders whatever state it's given and requests changes (equip, buy, trade, gift).

Both sides import from shared/ (Catalog.ts, Cases.ts, Gamepasses.ts, Monetization.ts), one copy of pricing and drop tables.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Systems

### Inventory

shared/Catalog.ts, one entry per skin id: name, image, rarity, weapon slot, source crate. Player-owned item is just `{ id, uuid }`, rest resolved from the catalog on lookup.

uuid is for trade references and dupe prevention. add/remove/equip run off plain id.

4 slots: rifle, revolver, knife, deathEffect. Default skin per slot, not tradeable, acts as fallback. New skin = one catalog entry.

### Shop, crates, gamepasses, limiteds

6 crates: green, blue, purple, yellow, red, Plus (needs the Plus gamepass). Each has its own price, odds, open animation. Drop pool comes from the catalog.

Gamepasses grant a fixed skin set on purchase (clown set, limited bundle, Plus). 2x earnings is a coin multiplier, no item. Ownership rechecked against MarketplaceService on join.

Limiteds: one dev product, buy, bundle lands in inventory. No crate.

### Gifting

Gift a gamepass or limited bundle at 10% off, its own separately priced dev product. Recipient recorded server side before the purchase prompt. If they've left by the time ProcessReceipt fires, buyer gets it instead.

### Trading

Pick items, offers mirror live on both sides, ready up. Both ready, 10s countdown, touching your offer resets it. Server rechecks ownership right before the swap.

### Currency

Coins from matches, spent on crates. 2x earnings doubles the payout.

### Death effects

Equipped deathEffect plays at your death spot, visible server-wide. Server picks effect and location, broadcasts it, each client spawns and cleans it up locally.

### Party 

Invite others to your party to play on the same team, allows for just the leader to queue. Functions: create, invite, accept/decline request, leave, kick, disband.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Setup

### Requirements

- Node and npm
- Rojo, CLI and Studio plugin
- Roblox Studio

### Dev

```sh
npm install
npm run watch
```

watch rebuilds on save, build is one off. Sync into Studio via Rojo, default.project.json.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Dev chat commands

Hardcoded to my UserId in server/main.server.ts:

```
add <id>       e.g. add seer
remove <id>
equip <id>
get state      dumps inventory to output
coins          prints balance
earn <n>
spend <n>
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## The old weight system

First version was a full survival inventory: weight limits, stacking, hotbar/storage, world drops. Ripped out, doesn't fit a single-equip cosmetic model. Still in commit 778d051.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## AI usage

Used for debugging, Roblox API lookups, file layout notes on earlier README drafts. Used ai to write comments for some functions since rbxts' compiled code to luau is hard to understand (semi obfuscated). 

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Video demo

https://streamable.com/hknw34

## Play it

Tester only. Message me your Roblox username on Slack for access.
https://www.roblox.com/games/100643617969932/ULTIMATE-DUELS

## Questions

Slack: firancly, id U0BDBQL1PNV.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

README template from https://github.com/othneildrew/Best-README-Template
