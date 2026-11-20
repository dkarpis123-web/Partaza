# Partaza – versija 0.3

Nauja 0.3 versijoje: atidarymo animacija ir ikona; du pardavimo būdai (pavienė dalis arba dalys iš ardomo automobilio);
istorinių automobilių dalių žyma ir filtras; kainos patarėjas su trimis siūlomomis kainomis ir palyginamais skelbimais;
ekranas „Mano prekyba“ (pajamos, išlaidos, pelnas, kiekvieno ardomo automobilio atsipirkimas); pardavimo žymėjimas.
Jei `supabase/schema.sql` jau buvo paleistas anksčiau, paleiskite jį dar kartą – jis prideda tik tai, ko trūksta.

Transporto dalių rinka: viena programėlė „iPhone“, „Android“ ir kompiuterio naršyklei.
Sukurta su „Expo“ (SDK 58) ir „Expo Router“.

## Kas veikia

- **Pradžia** – nauji skelbimai, transporto tipai, paieška.
- **Paieška** – pagal pavadinimą, dalies kodą (su tarpais ar be) ir modelį; filtrai pagal šalį,
  miestą, gavimo būdą (pristatymas / atsiėmimas), „tik be defektų“; rikiavimas pagal kainą su
  pristatymu, naujumą arba šalį ir miestą.
- **Skelbimas** – defekto žyma ant nuotraukos, kaina su PVM arba be, pristatymo kaina,
  pardavėjo statusas (privatus / verslas), „Pranešti apie skelbimą“.
- **Siūlyti kainą ir derybos** – pasiūlymas, kontrpasiūlymas, priimti / atmesti, žinutės.
- **Parduoti** – nuotraukos iš kameros arba galerijos, skelbimo patikra, pažeidimų sąrašas,
  kaina, PVM, siuntos dydis, paskelbimas.
- **Registracija ir profilis** – privatus asmuo arba verslas, mano skelbimai, paskyros ištrynimas.

## Kas šioje versijoje yra bandomoji dalis

Tai svarbu žinoti prieš rodant programėlę kitiems:

| Dalis | Kaip veikia be serverio (bandomasis režimas) | Kada tikra |
| --- | --- | --- |
| Duomenys | Pavyzdiniai skelbimai, laikomi atmintyje; uždarius programėlę viskas dingsta | Įrašius `.env` reikšmes (žr. žemiau) |
| Dalies atpažinimas iš nuotraukų | Neprijungtas: laukai užpildomi pavyzdžiu, ekrane apie tai parašyta | AI etape (`src/services/ai.ts`) |
| Pardavėjo atsakymas į pasiūlymą | Automatinis demonstracinis kontrpasiūlymas | Įrašius `.env` reikšmes – atsako tikras pardavėjas |
| Kainos patarimas | Tik iš mūsų rinkos skelbimų su tuo pačiu kodu | Internetinė paieška – 4 etape |
| Mokėjimai, pirkėjo apsauga, siuntimas | Nėra; susitarus rodoma, kad tai bus vėliau | 3 etape |
| Prisijungimas | Tik vardas ir statusas šiame įrenginyje | Įrašius `.env` reikšmes – el. paštas ir slaptažodis |
| Pranešimai moderatoriams | Mygtukas yra, niekur nesiunčiama | Įrašius `.env` reikšmes – kaupiama lentelėje `reports` |

## Serveris („Supabase“) – kaip įjungti tikrą režimą

Kol serveris neprijungtas, programėlė veikia **bandomuoju režimu**: pavyzdiniai skelbimai, viskas lieka įrenginyje.
Prijungus serverį atsiranda tikros paskyros (el. paštas ir slaptažodis), tikri skelbimai su nuotraukomis ir
pokalbiai tarp pirkėjo ir pardavėjo realiu laiku.

1. Svetainėje supabase.com susikurkite paskyrą ir projektą (organizacija – MB „Sintela“, regionas – ES, pvz., Frankfurtas).
   Duomenų bazės slaptažodį išsaugokite slaptažodžių tvarkyklėje; jo niekur kitur rašyti nereikia.
2. Projekto skydelyje atidarykite **SQL Editor**, įklijuokite visą failą `supabase/schema.sql` ir spauskite **Run**.
   Failas sukuria lenteles, saugumo taisykles, nuotraukų saugyklą ir įjungia žinutes realiu laiku. Jį galima leisti pakartotinai.
3. **Project Settings → API** nukopijuokite dvi reikšmes: *Project URL* ir *Publishable key* (senesniuose projektuose – *anon public*).
4. Nukopijuokite `.env.example` pavadinimu `.env` ir įrašykite tas dvi reikšmes. Paleiskite programėlę iš naujo.

Svarbu: slapto rakto (*secret* / *service_role*) niekada nedėkite nei į `.env`, nei į programėlę, nei į susirašinėjimą.
Dvi viešos reikšmės yra saugios tik todėl, kad prieigą riboja `schema.sql` taisyklės.

Pagal nutylėjimą „Supabase“ prašo patvirtinti el. paštą: užsiregistravęs žmogus gauna laišką ir tik tada gali prisijungti.
Bandymams tai galima laikinai išjungti (**Authentication → Sign In / Providers → Email → Confirm email**).

### Kas saugoma serveryje

- `profiles` – vardas ir statusas (privatus / verslas); sukuriamas automatiškai registruojantis.
- `listings` – skelbimai; aktyvius mato visi, keisti gali tik savininkas.
- `threads`, `messages` – pokalbiai; mato tik pirkėjas ir pardavėjas. Kainos pasiūlymai kuriami ir atsakomi tik per
  serverio funkcijas `send_offer` ir `answer_offer`, todėl niekas negali suklastoti „priimto“ pasiūlymo.
- `reports` – pranešimai apie skelbimus (kol kas tik kaupiami; peržiūrėti galima „Supabase“ lentelėje).
- `delete_my_account` – paskyros ištrynimas iš programėlės („App Store“ reikalavimas).

## Kaip paleisti

Reikia „Node.js“ 20 ar naujesnės versijos.

```bash
npm install
npx expo start
```

- **Telefone:** įsidiekite „Expo Go“ ir nuskaitykite terminale rodomą QR kodą.
- **Kompiuteryje:** terminale paspauskite `w` – atsidarys naršyklėje.

Kitos komandos:

```bash
npm run typecheck   # tipų patikra
npm run build:web   # naršyklės versija į aplanką dist/
```

## Kas patikrinta

- `npx tsc --noEmit` – tipų klaidų nėra; `npx expo export --platform web` – žiniatinklio versija susirenka.
- Bandomasis režimas: automatinis naršyklės testas praeina visą kelią (29 patikros).
- `supabase/schema.sql` paleista tikrame „Postgres“ variklyje (PGlite) su „Supabase“ dalių pakaitalais – 47 saugumo patikros
  (svetimo skelbimo keisti negalima, pašalinis nemato pokalbio, savo pasiūlymo priimti negalima ir pan.).
- Tikrasis režimas patikrintas tik su serverio imitacija (11 patikrų): registracija, skelbimai iš serverio, pasiūlymas, žinutė.

Nepatikrinta: veikimas su tikru „Supabase“ projektu (jo dar nėra), nuotraukų įkėlimas į saugyklą, žinutės realiu laiku,
el. pašto patvirtinimo laiškai, „iPhone“ ir „Android“ įrenginiai. Tai pirmas dalykas, kurį reikia išbandyti sukūrus projektą.

## Struktūra

- `supabase/schema.sql` – duomenų bazė ir saugumo taisyklės
- `src/backend/client.ts` – ryšys su serveriu (jei `.env` tuščias – bandomasis režimas)
- `src/store.tsx` – visi veiksmai abiem režimams

```
src/app/            ekranai (kiekvienas failas – maršrutas)
  (tabs)/           apatinio meniu ekranai: pradžia, paieška, parduoti, žinutės, profilis
  listing/[id]      skelbimas
  offer/[id]        siūlyti kainą
  chat/[id]         pokalbis ir derybos
  sell/review       skelbimo patikra prieš paskelbiant
  register          registracija
src/components/     bendri elementai (mygtukai, kortelės, skelbimo kortelė)
src/store.tsx       programėlės būsena (vėliau keičiama į serverį)
src/services/ai.ts  dalies atpažinimas ir kainos patarimas (vėliau jungiamas AI)
src/data/seed.ts    pavyzdiniai duomenys
src/theme.ts        spalvos, pinigų formatas, pirkėjo apsaugos mokesčio formulė
```

## Kiti žingsniai

1. Išbandyti telefone per „Expo Go“ ir surinkti pastabas.
2. Sukurti „Supabase“ projektą, paleisti `supabase/schema.sql`, įrašyti `.env` ir išbandyti tikrą režimą su dviem paskyromis.
3. AI: dalies ir kodo atpažinimas iš nuotraukų, pažeidimų pasiūlymai.
4. Mokėjimai su lėšų sulaikymu, siuntimas, atsiliepimai.
5. Teikimas į „App Store“ ir „Google Play“.
