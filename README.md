# Duel Game Skin Inventory

Cosmetic skin inventory for a Murderer vs Sheriff / Rivals style Roblox game. Written in [roblox-ts](https://roblox-ts.com/).

Everyone spawns with the same three weapons: a Rifle, a Revolver, and a Knife. You don't own or equip the weapons, they're equiped when you join a match. What you actually collect and equip is **skins**, one per weapon. So this whole thing is really a skin locker, not a bag of items.

I built it as a learning project. Learnt inventory systems to see how those are structured, then kept the good architectural ideas (server owns everything, delta replication) and threw out the parts a cosmetic game doesn't need.

## Layout

SERVER - owns who has what and what's equipped
|.             ^
|.             |
v.             |
delta event   request
|.             ^
v.             |
CLIENT - mirror the data and draw ui

both import `Catalog.ts` for the (skin defs(

## Note to the reviewers
I apologize for the previous re-ship not containing new information, I fixed it in a rush before leaving and forgot to commit on my PC. Currently I am on the way to Singapore and wrote updates on my mobile phone. I hope if there are any issues the next commit doesn't result in a permanent rejection as I am boarding the plane as of writing this readme. 

> This section will be removed once it leaves the review process. Feel free to ask me any questions regarding the game on slack. username: firancly slack-id: U0BDBQL1PNV.

### Try out the game here:
https://www.roblox.com/share?code=cf00c0718e1b2840898ebba9c61ac727&type=ExperienceDetails&stamp=1785460113999

## A few decisions worth knowing

**Catalog holds all the config stuff.** Name, image, rarity, which slot a skin goes on. It lives in `shared/Catalog.ts`, keyed by `id`. An owned item is just `{ id, uuid }`, and anything else about it gets looked up from the catalog. That way a skin's image lives in exactly one place, and I never send images over the network since the client already has the catalog.

**Everything runs on `id`. The `uuid` is just along for the ride.** Add, remove, equip all take an `id`. Each copy still gets a `uuid` so trading can point at one specific copy later (and so you can't dupe), but nothing uses it yet.

**Updates are deltas, not full resyncs.** One RemoteEvent, tagged messages: `Init`, `Add`, `Remove`, `Equip`, `Unequip`. Only the thing that changed gets sent.


## Skins and slots

Three slots: `Rifel`, `Revolver`, `Knife`. One equipped skin each. On join you get the `default_*` skin in every slot so nothing's ever empty. Defaults are `tradeable: false` and double as the "unequip" fallback.

New skin = one new entry in `Catalog`. That's it.

## Testing it

No UI needed. There are chat commands in `main.server.ts`:

- `add <id>` give yourself a skin, e.g. `add seer`
- `remove <id>`
- `equip <id>`
- `get state` dump your inventory to the output

I built the whole thing bottom up and tested each layer with prints before wiring any UI, which is why these exist.

## TO-DO:

- **Saving.** Right now everything resets when you leave. This is the big one. Once DataStore is in, granting defaults moves behind a "new player?" check instead of running every join.
- **Trading.** The `uuid` and the `tradeable` flag are already there waiting for it.
- **Porting Weapons** Currently Catalog holds dummy date will need to update config with actual weapons data
- **Currency** `Currency/` is stubbed out.
- **The `Other` tab** in the UI has no slot behind it yet.

## About the weight system (commit `778d051`)

Early on I made a full survival/rpg inventory system: weight limits, stacking, hotbar and storage slots with gaps, dropping items on the ground, metadata parsing, all of it. Spent a good while on it. Then I rewrote it to a skin locker and it needs none of that. Skins have no weight, you never drop one in the world, there's no grid to manage. So I deleted the whole weight/stacking/slot layer and replaced it with the catalog + one skin per slot setup that's here now. `shared/Settings.ts` is the last scrap of that old version and it'll get removed. If you want to see that system go to commit `778d051`.

## AI Usage
Used ai for debugging and finding roblox api specific methods. Was also used to generate diagrams and file layout for previous readme commits. 

## Video demo
https://github.com/user-attachments/assets/a5237e4f-1cca-43d1-89da-853a3781ec80
