"""Resolve generated images from job ids.

The CDN key is hf_<date>_<time>_<job-id>.png and the time is the write time,
which drifts a second or two across a batch. Rather than transcribe every URL,
this records one base timestamp per batch and probes a small window around it.

Usage:
    python tools/fetch_batch.py thumbs     # game thumbnails -> art/<id>.webp
    python tools/fetch_batch.py syms       # symbol sheets  -> art/sym/<id>/*.webp
"""
import sys
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_39wgFi7Tu7lxq3w55HXxhkUTa10/hf_20260824_"
WINDOW = 6          # seconds either side of the recorded base time

# (base HHMMSS, [ (game-id, job-id), ... ])
THUMBS = [
    ("013546", [
        ("baccarat-speed", "4266705b-d4ca-4849-8fdc-08e9923f0735"),
        ("baccarat-mini", "e444f960-c3ae-4972-b02e-0a9c1b87a459"),
        ("baccarat-nc2", "0556c134-4580-44d8-8aa0-447f0031dbf8"),
        ("blackjack-vip", "3838b9a8-9ac4-4454-8089-5a40722740bb"),
        ("blackjack-turbo", "de29fd61-b8f8-4901-ae26-c3c053372ca1"),
        ("blackjack-lucky", "3ac5d522-b546-421b-b726-5db17672b4ab"),
        ("baccarat-gold", "a607e723-0567-4555-af3c-2d9088df6523"),
        ("baccarat-dragon", "b43144cb-68e5-442e-9f13-4c99950ac91a"),
        ("blackjack-atlantic", "d4c2e4fa-0d6d-4e6f-bcbd-a8907f8033a1"),
        ("blackjack-euro", "76c10a37-3465-4932-8ee6-8959a45afa9e"),
        ("blackjack-classic-h17", "d5a7562a-68a9-4aba-807a-ce9040c77994"),
        ("blackjack-double-exposure", "7b138885-85e4-4e59-b58b-2d2aa6973460"),
    ]),
    ("013608", [
        ("video-poker-ddb", "1e50b8d9-3955-4317-a13b-db1a1af0fe65"),
        ("video-poker-allamerican", "a89246b8-88e4-453c-aa77-fd041b2969d8"),
        ("video-poker-dwbonus", "29373cfb-60da-49bd-ae80-6f257cf9fdfe"),
        ("video-poker-kings", "b98d8a4c-1d89-4bc0-a328-7f31c6de3247"),
        ("roulette-speed", "59b21ee4-a444-42be-9e08-e1526021b478"),
        ("roulette-auto", "7924f053-71da-450f-89c7-b42d604bcc4e"),
        ("roulette-lightning-x", "b641976c-1d23-4e8f-939d-bf13e25430b6"),
        ("roulette-fr-gold", "396c0f50-5b32-4c2d-b267-17ef1405846e"),
        ("sic-bo-super", "7ba3d9aa-c8fd-4497-8f2e-fd3043344ec0"),
        ("craps-express", "c5c02048-3d33-4ecc-9738-072ccfe85942"),
        ("roulette-vip", "39ece688-4e75-40c3-8e5e-706ad99c9e5a"),
        ("roulette-double-zero", "b7448645-7c83-4bc6-bb94-0101394e653b"),
    ]),
    ("013631", [
        ("sic-bo-lightning", "bbbbaabe-1bc7-4870-9228-71a92257784a"),
        ("craps-vegas", "c0d841d7-42d8-4bac-8437-6bf893a8773d"),
        ("keno-mega", "e19993b6-6f9d-40d0-a51a-ca510a0d794f"),
        ("keno-cleo", "9413560d-c4a0-4a88-bb84-740d26d531bb"),
        ("keno-classic", "0a5a71d6-756d-4c61-b446-44fab1b47c54"),
        ("bingo-30", "f9de0bb9-4ace-4ca3-a75f-3a1fb731c84a"),
        ("bingo-80", "3070bb07-b122-4206-96f4-71739a256e89"),
        ("plinko-classic", "7aa08d61-b692-473d-ad6e-c292c8de9667"),
        ("plinko-gold", "082c39e5-271d-4954-83ac-3a12befe5f4b"),
        ("plinko-safe", "cbd2ca56-bf7b-475b-813b-c4d0b8edafb5"),
        ("scratch-royal", "f43c2894-33dd-4b03-b2e2-dcf9b6e04248"),
        ("plinko-mega", "cddd441b-5846-414a-aa18-dc0b39cefb6f"),
    ]),
    ("013659", [
        ("plinko-turbo", "084fa206-db0f-420f-abc9-3548bc8d9192"),
        ("scratch-emerald", "7cd4d2df-2aa9-4ec5-b796-a07090b8c500"),
        ("scratch-neon", "df398642-0231-4b97-b350-7db22d9e5648"),
        ("scratch-pirate", "f11d9310-d6fe-47dd-a764-1b122e70a22a"),
        ("kraken-depths", "f1c2b410-273b-49dd-9e00-0d06f4abe3b0"),
        ("golden-empire", "37c0d37c-8c4d-4333-af20-efbb1af19b12"),
        ("neon-drift", "058f78ca-7979-45e6-bf4b-563ce318a34c"),
        ("bee-bonanza", "e7ff12c1-0256-4c7a-8b32-7ebe3805eaf7"),
        ("tiki-tumble", "cabad272-3dbb-485d-a171-75d985488fa0"),
        ("frost-giants", "7709dad1-865f-493b-ab4b-222e2092d8e3"),
        ("cosmic-cats", "0d19a3a0-1899-452f-8e62-603b1feccc6d"),
        ("gold-rush-town", "40cbde92-1473-429d-805f-f1648dc70f91"),
    ]),
    ("013729", [
        ("temple-serpent", "2cf6c898-7b1f-452a-bbc3-75dfba40af61"),
        ("royal-crowns", "c97a8f7a-64c2-4dd0-876e-bd985665db0b"),
        ("lava-fortune", "bf7d7282-fa89-4c60-841d-115d5d341a7d"),
        ("bamboo-luck", "fe8ac0de-b239-4a93-930e-5e631af1dca4"),
        ("circus-cash", "1f645b57-b8bb-407c-88b8-774edd731fb2"),
        ("deep-reef", "ad4537e0-513a-4f83-b985-8a91eb40580a"),
        ("spartan-gold", "165ca5cc-9999-4d96-86a2-8961e296a048"),
        ("candy-vault", "8d6d690f-03fb-4116-810e-98ffadb0e7dd"),
        ("wolfpack-wilds", "9fa0b869-4f68-442a-af71-c4c83fbc1cd2"),
        ("mayan-moon", "573b433f-b653-401c-9192-55215b2200b5"),
        ("cyber-vault", "c89a1544-402b-483a-8550-5df37bfc618a"),
        ("desert-mirage", "4bf4eac5-33db-4bee-b6e5-5c1dc48693f9"),
    ]),
    ("013754", [
        ("festival-fever", "1b517ec5-8e1b-4f14-92fc-90843fa61be9"),
        ("bounty-seas", "d29671fe-0008-400f-a8ef-e85f7cc8e693"),
        ("primal-hunt", "c99b256c-274f-4209-bfda-d785750811e1"),
        ("lucky-lanterns", "b332e222-b6fc-4ca4-91a2-18bf27740065"),
        ("vault-breakers", "241b2ece-826e-4e50-a6cb-ef9faaee9fb2"),
        ("nordic-runes", "445e2467-6945-4b14-91fb-174d71bc68a0"),
        ("safari-drums", "d6c3231e-d750-403c-a022-67e1e7884d3d"),
        ("pixel-quest", "171437c7-5beb-4069-b2eb-3f4f89b45fea"),
        ("moonlit-manor", "0c7003b3-a976-4216-8445-230a24dbef8e"),
        ("harvest-gold", "eb5979bd-ddb4-4456-a741-9dc7cf422c70"),
        ("titan-thunder", "ea8264f1-7237-4cc0-aafd-0c8a12b08e12"),
        ("sweet-shop", "312f6538-7d40-4286-b8bf-15da6c28870c"),
    ]),
    ("013817", [
        ("ice-kingdom", "654b5aaf-f0ed-40e0-bec9-68267e663091"),
        ("rio-carnival", "d1845c1c-b902-44ad-a736-e5724983cfbf"),
        ("dwarven-forge", "0f281513-540f-4e33-b3f3-44c119841a43"),
        ("starlight-spins", "fdd8cca0-05f2-4e1b-817c-21117737c9ec"),
        ("jade-dragon", "397a12ad-53c2-4edf-99c6-ad1526770356"),
        ("outlaw-express", "67771708-d33c-445a-881b-f22761d6ca26"),
        ("mermaid-lagoon", "7da3a430-253b-4120-b549-1294c76e5fd9"),
        ("phantom-opera", "8ac8eb70-b7ab-49e6-927a-0b16fe7c567c"),
        ("golden-koi-pond", "af888fe6-38f3-4326-9aa8-a2137703e1f5"),
        ("meteor-miners", "fe2c9199-5392-4709-a22c-3dfdb9f84680"),
        ("gladiator-arena", "4f877b5d-35e1-46c0-ab43-da7e3272676d"),
        ("cupcake-cash", "e8daa26e-6542-4139-9161-d2ade830d49e"),
    ]),
    ("013840", [
        ("storm-chasers", "f2bd9999-af10-42db-9771-5912898b7297"),
        ("emerald-temple", "e0954f74-356b-49b0-9671-1a0292643e7a"),
        ("viking-voyage", "7f11eb7f-8bd2-4014-91fc-dcf6e3021621"),
        ("lucky-piggy", "307a71b2-55f4-4c34-b8cd-596576d74861"),
        ("sultan-spins", "7df0abe1-1d17-4684-a31f-bfeabdc3b13e"),
        ("bone-diggers", "4727de2a-06c2-4bd3-b238-58dd9cb37f0c"),
        ("bloom-fortune", "0ee12a68-36d2-4665-96d6-7614e8cd795c"),
        ("atlas-riches", "c46db8df-b25a-43a8-a14d-511958cd8fe7"),
        ("inferno-reels", "5cdffd1c-39c0-497d-b17e-feb45c4b2f36"),
        ("pearl-diver", "c0e183d7-17df-4995-bb75-f877182b3aa8"),
        ("rune-scrolls", "30c51c43-c5ef-4f73-9b62-4d3a2a95d180"),
        ("honey-heist", "92cfb9ea-035d-4ee3-b5ad-6cd640c6b7ac"),
    ]),
    ("013906", [
        ("midnight-jazz", "bbfe18f7-b84e-4d79-9fd9-699f78c2fd31"),
        ("crystal-crowns", "8cd3cb74-0ab0-4e75-85bf-f7ab08038c9a"),
        ("savanna-sun", "acf304de-ed2c-4a4d-b07a-3169f6d1ad3c"),
        ("lucky-fortune-cat", "6f4ef0ce-7626-44e8-a443-3130ef559ae3"),
    ]),
]

SYMS = [
    ("013906", [
        ("kraken-depths", "81177311-6176-4180-88ec-3b0d10184abc"),
        ("golden-empire", "82ba4f08-ea0e-4600-9bcc-5a9d3cc8c78f"),
        ("neon-drift", "c2af2755-3e36-48ec-a594-fa9a21dc9e0f"),
        ("bee-bonanza", "290cb8a8-85a7-4a82-a83c-250bdda28651"),
        ("tiki-tumble", "96039a06-1d76-4558-917e-688e274572d6"),
        ("frost-giants", "fac3bc73-89df-4af2-bbc0-e722343a4e26"),
        ("cosmic-cats", "6ecf9b64-7e07-4ad1-916f-2d4fe76aa13a"),
        ("gold-rush-town", "41f92d31-5e02-49d6-b4bc-92ad4296ba15"),
    ]),
    ("013942", [
        ("temple-serpent", "db792187-eafe-432b-accc-f4ba57ebedff"),
        ("royal-crowns", "4f4b6b4f-9cf7-4fc5-92ef-4a96085f45d3"),
        ("lava-fortune", "acaf4b57-6223-4a5f-9d6a-d001b8feea0a"),
        ("bamboo-luck", "6a631174-5160-401f-a867-fc068b027ff7"),
        ("circus-cash", "84d4d2f0-22bf-4335-a66d-cbf62b11c48a"),
        ("deep-reef", "87c2a38a-c6d1-4308-a934-60af9162e8c0"),
        ("spartan-gold", "08a31189-5246-4e78-8520-c0e4269c8d87"),
        ("candy-vault", "aa49a40a-a785-4b40-b2c6-590b786742c0"),
        ("wolfpack-wilds", "c3b25049-aa4c-49cc-8911-9cda866a62be"),
        ("mayan-moon", "b4e495ea-ea93-43aa-90b0-925a5e176f65"),
        ("cyber-vault", "d0b5bd24-b6aa-4250-a01c-784071499194"),
        ("desert-mirage", "cb745c88-1486-451c-8dbb-9c80fa7fa7dc"),
    ]),
    ("014006", [
        ("festival-fever", "fff42097-f118-46d3-8261-828a6cdde735"),
        ("bounty-seas", "080d9e77-12f5-4aca-a1b6-6b685a3a104d"),
        ("primal-hunt", "d90c5c9d-6649-4d22-99e6-4ce531a73ce9"),
        ("lucky-lanterns", "90066d4e-5dcd-4144-b337-c1f6c2576adb"),
        ("vault-breakers", "7003d299-0ce2-46ff-89d6-e9cb4ccd1949"),
        ("nordic-runes", "94b06f15-ec63-46fb-894e-28d074cabe54"),
        ("safari-drums", "cfda327f-163c-4ca9-913f-8e3f0f984c24"),
        ("pixel-quest", "2e3d8b60-67ea-4069-9d23-9823c30d4e59"),
        ("moonlit-manor", "be00b05a-7e13-4832-8745-c4890aa7e2a9"),
        ("harvest-gold", "4d15b38d-1bc4-4a3b-89cb-a9263941bf2b"),
        ("titan-thunder", "1ecff1ba-e5b2-4a9e-a9be-822f7e23fd9e"),
        ("sweet-shop", "4759a693-35a7-4ab8-8778-0d15bbf9c055"),
    ]),
    ("014029", [
        ("ice-kingdom", "030771e9-a4e4-4943-a00d-8fff345394cf"),
        ("rio-carnival", "233839cd-a326-42f7-8197-80abc21cc3e2"),
        ("dwarven-forge", "02c31900-c4ee-45b2-8ba0-a3189843da28"),
        ("starlight-spins", "fb8f01b4-0a44-4746-82f6-1b74a347b58f"),
        ("jade-dragon", "fc009712-e0b4-48e8-87b2-ff502ab710e9"),
        ("outlaw-express", "e54216b1-0518-4750-a9db-894b0190383f"),
        ("mermaid-lagoon", "26b421a5-f5d1-42d6-80d5-c3aed1fde369"),
        ("phantom-opera", "c030482e-1eb0-4738-8fa8-5fa0f830640a"),
        ("golden-koi-pond", "8feafffa-295e-4ef3-8b16-60b60376b48a"),
        ("meteor-miners", "e9ca4aac-f0a5-49c6-bcd9-8349b1d8155e"),
        ("gladiator-arena", "283c0a28-08a3-44a7-8c7b-dccbd9bcc48e"),
        ("cupcake-cash", "58234a5e-a6c6-4f56-bf25-62965ac9679d"),
    ]),
    ("014055", [
        ("storm-chasers", "0848be14-f500-4677-86b1-b7ba18f0cb01"),
        ("emerald-temple", "eaa2093d-2a89-47a5-911d-705f49770530"),
        ("viking-voyage", "5279c6eb-299b-49b7-a0c6-d9ccd763da35"),
        ("lucky-piggy", "d003fb0b-ca94-4888-92ef-71470c909ac4"),
        ("sultan-spins", "a5e23f4e-6e72-45c6-a06d-c87696ce568b"),
        ("bone-diggers", "16c95903-af30-4019-a949-8dc876dea7ba"),
        ("bloom-fortune", "0f7bb4b2-26b5-4ca3-a304-59ab9dd732f1"),
        ("atlas-riches", "dc444d54-48ee-4990-a585-01a1268db913"),
        ("inferno-reels", "031aaaf3-381f-4714-8d9b-3dfe258669ba"),
        ("pearl-diver", "60029135-03df-4463-a6d7-5ef833cbe04c"),
        ("rune-scrolls", "8b21cc19-f5fc-437b-95bd-b14febdcdaa0"),
        ("honey-heist", "6a876bb6-ec0e-4d1a-9af7-e1af314d730a"),
    ]),
    ("014113", [
        ("midnight-jazz", "d5bee8fd-dd32-4490-b140-ec84bdaa8a64"),
        ("crystal-crowns", "701df91e-3c86-4043-b44d-c20f7a81ff3f"),
        ("savanna-sun", "17cef213-5bb9-4d9a-bd0f-017bebcbc2ee"),
        ("lucky-fortune-cat", "10267b4b-597d-49db-b5c8-ef3d58cf3b62"),
    ]),
]


def shift(hhmmss: str, delta: int) -> str:
    total = int(hhmmss[:2]) * 3600 + int(hhmmss[2:4]) * 60 + int(hhmmss[4:]) + delta
    total %= 86400
    return f"{total // 3600:02d}{total % 3600 // 60:02d}{total % 60:02d}"


def resolve(base: str, job: str) -> Image.Image:
    """Probe the timestamp window until the CDN key hits."""
    order = [0]
    for d in range(1, WINDOW + 1):
        order += [d, -d]
    last = None
    for d in order:
        url = f"{BASE}{shift(base, d)}_{job}.png"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "nova-casino-art/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return Image.open(BytesIO(r.read())).convert("RGB")
        except urllib.error.HTTPError as exc:
            last = exc
            continue
    raise RuntimeError(f"not found within +/-{WINDOW}s of {base}: {last}")


def do_thumbs() -> None:
    sys.path.insert(0, "tools")
    from art import process_image  # noqa

    total = ok = 0
    for base, items in THUMBS:
        for gid, job in items:
            try:
                img = resolve(base, job)
                p = process_image(gid, img)
                total += p
                ok += 1
            except Exception as exc:
                print(f"  {gid:<26} FAILED: {exc}")
    print(f"thumbs: {ok} written, {total // 1024} KB")


def do_syms() -> None:
    sys.path.insert(0, "tools")
    from symbols import slice_image  # noqa

    total = ok = 0
    for base, items in SYMS:
        for gid, job in items:
            try:
                img = resolve(base, job)
                total += slice_image(gid, img)
                ok += 1
            except Exception as exc:
                print(f"  {gid:<26} FAILED: {exc}")
    print(f"symbol sets: {ok} written, {total // 1024} KB")


if __name__ == "__main__":
    (do_thumbs if sys.argv[1] == "thumbs" else do_syms)()
