# Duel Game Skin Inventory

Cosmetic skin inventory for a Murderer vs Sheriff / Rivals style Roblox game. Written in [roblox-ts](https://roblox-ts.com/).

Everyone spawns with the same three weapons: a Rifle, a Revolver, and a Knife. You don't own or equip the weapons, they're always there. What you actually collect and equip is **skins**, one per weapon. So this whole thing is really a skin locker, not a bag of items.

I built it as a learning project. Learnt inventory systems to see how those are structured, then kept the good architectural ideas (server owns everything, delta replication, one file per operation) and threw out the parts a cosmetic game doesn't need.

## How it's put together

The server is the source of truth. It decides who owns what and what's equipped. The client just mirrors that and draws it. Anything the client asks for gets re checked on the server, because you can't trust the client.

```
SERVER (truth)                         CLIENT (mirror + view)
┌────────────────────┐                 ┌────────────────────┐
│ InventoryState     │                 │ Store              │
│  items, equipped   │                 │  owned, equipped   │
│ Operations         │                 │ InventoryUI        │
│  add/remove/equip  │                 │  render + tabs     │
│ Replicator/Actions │──RemoteEvent──▶ │ NetworkHandler     │
│                    │◀─RemoteEvent────│  (requests)        │
└────────────────────┘                 └────────────────────┘
        ▲                                       │
        └──── shared/Catalog (skin defs) ───────┘
```

Three flows, that's the whole thing:

```
join         → client asks for a snapshot → server sends it → store fills → UI draws
server change → server sends a small delta → store updates → UI redraws
click equip  → client asks server → server checks + equips → delta back → UI redraws
```

## A few decisions worth knowing

**Catalog holds all the static stuff.** Name, image, rarity, which slot a skin goes on. It lives in `shared/Catalog.ts`, keyed by `id`. An owned item is just `{ id, uuid }`, and anything else about it gets looked up from the catalog. That way a skin's image lives in exactly one place, and I never send images over the network since the client already has the catalog.

**Everything runs on `id`. The `uuid` is just along for the ride.** Add, remove, equip all take an `id`. Each copy still gets a `uuid` so trading can point at one specific copy later (and so you can't dupe), but nothing uses it yet.

**Updates are deltas, not full resyncs.** One RemoteEvent, tagged messages: `Init`, `Add`, `Remove`, `Equip`, `Unequip`. Only the thing that changed gets sent.

## Files

```
src/
├── shared/                     # both sides see this
│   ├── Catalog.ts              # all skin definitions, WeaponSlot & Rarity enums, DEFAULT_SKINS
│   ├── InventoryActions.ts     # shared payload types / action enum
│   ├── Settings.ts             # leftover Stoway config, mostly dead (see the note at the bottom)
│   └── types.ts                # odds and ends
│
├── server/
│   ├── main.server.ts          # boots the service + chat commands for testing
│   ├── Inventory/
│   │   ├── index.ts            # InventoryService: player lifecycle, routes requests, ties ops to replication
│   │   ├── Data/InventoryState.ts    # per player state (items, equipped)
│   │   ├── Operations/Operations.ts  # add / remove / equip / unequip
│   │   ├── Replication/actions.ts    # builds the payloads (flattens Maps for the wire)
│   │   ├── Replication/replicator.ts # makes the remotes + the send functions
│   │   └── Utils/uuid.ts             # GUID generator
│   └── Currency/               # coins system, scaffolded but not done
│
└── client/
    └── Inventory/
        ├── NetworkHandler.client.ts  # the entry point, wires remotes to the store
        ├── Store.ts                  # client copy of owned + equipped, pings the UI on change
        └── InventoryUI.ts            # draws the grid, category tabs, equip buttons
```

Quick roblox-ts thing if you haven't hit it: a `.client.ts` file becomes a LocalScript and runs on its own, a plain `.ts` becomes a ModuleScript that only runs when something imports it. `NetworkHandler.client.ts` is the one that kicks off on the client.

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
- **Currency / crates.** `Currency/` is stubbed out.
- **The `Other` tab** in the UI has no slot behind it yet.

## About the weight system (commit `778d051`)

Early on I made a full survival/rpg inventory system: weight limits, stacking, hotbar and storage slots with gaps, dropping items on the ground, metadata parsing, all of it. Spent a good while on it. Then I rewrote it to a skin locker and it needs none of that. Skins have no weight, you never drop one in the world, there's no grid to manage. So I deleted the whole weight/stacking/slot layer and replaced it with the catalog + one skin per slot setup that's here now. `shared/Settings.ts` is the last scrap of that old version and it'll get removed. If you want to see that system go to commit `778d051`.

## AI Usage
Used ai for debugging only and finding roblox api specific methods.

## Video demo
https://github.com/user-attachments/assets/a5237e4f-1cca-43d1-89da-853a3781ec80
