/** The legal entity that runs Partaza. Shown in the terms and the privacy policy. */
export const COMPANY = {
  name: 'MB „Sintela“',
  code: '304127980',
  vat: 'LT100009776219',
  address: 'Brastos g. 7/4, Kaunas, Lietuva',
  /** Contact e-mail for users; empty until the owner provides one. */
  email: '',
  site: 'https://partaza.eu',
  version: '2026-11-21',
};

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

const contact = COMPANY.email
  ? `el. paštu ${COMPANY.email} arba paštu adresu ${COMPANY.address}`
  : `paštu adresu ${COMPANY.address}`;

export const TERMS: LegalSection[] = [
  {
    title: '1. Kas mes ir kas yra „Partaza“',
    paragraphs: [
      `„Partaza“ (${COMPANY.site}) yra skelbimų platforma naujoms ir naudotoms transporto priemonių dalims. Ją valdo ${COMPANY.name}, juridinio asmens kodas ${COMPANY.code}, PVM mokėtojo kodas ${COMPANY.vat}, buveinė ${COMPANY.address}.`,
      'Platforma veikia bandomuoju laikotarpiu: funkcijos gali keistis, o kai kurios dar neveikia (pavyzdžiui, siuntų užsakymas iš platformos).',
    ],
  },
  {
    title: '2. Mūsų vaidmuo',
    paragraphs: [
      'Mes suteikiame vietą skelbimams ir susirašinėjimui. Pirkimo–pardavimo sutartį sudaro pirkėjas ir pardavėjas tarpusavyje; mes nesame šios sutarties šalis, dalių neparduodame, netikriname ir nesaugome.',
      'Jeigu pirkėjas ir pardavėjas atsiskaito ne per platformą, dėl apmokėjimo ir pristatymo jie susitaria patys. Už tokius atsiskaitymus mes neatsakome.',
    ],
  },
  {
    title: '3. Paskyra',
    paragraphs: [
      'Naudotis paskyra gali asmenys nuo 18 metų ir juridiniai asmenys. Registruojantis reikia nurodyti tikrą el. pašto adresą ir telefono numerį bei patvirtinti el. paštą. Per 15 minučių nepatvirtinta paskyra ištrinama.',
      'Privalote teisingai nurodyti, ar prekiaujate kaip privatus asmuo, ar kaip verslas. Už savo paskyros slaptažodžio saugumą atsakote patys.',
      'Paskyrą bet kada galite ištrinti skiltyje „Profilis“. Kartu ištrinami jūsų skelbimai, nuotraukos ir pokalbiai.',
    ],
  },
  {
    title: '4. Skelbimai',
    paragraphs: [
      'Pardavėjas atsako už tai, kad skelbimas būtų teisingas: dalies pavadinimas, numeris, būklė, kaina ir nuotraukos turi atitikti tikrovę. Visi žinomi pažeidimai ir trūkumai turi būti nurodyti.',
      'Skelbti galima tik tas dalis ir transporto priemones, kurias turite teisę parduoti ir kurių pardavimas yra teisėtas. Už dalies teisėtumą, saugumą ir tinkamumą naudoti, įskaitant saugos sistemų dalis, atsako pardavėjas.',
      'Dalies tinkamumas konkrečiai transporto priemonei nurodomas pagal pardavėjo pateiktą informaciją. Prieš pirkdami sutikrinkite dalies numerį.',
      'Siuntimo kainą skelbime nustato pardavėjas. Platformos siūlomos siuntimo kainos pagal siuntos dydį yra orientacinės ir gali skirtis nuo tikrų vežėjų kainų; už siuntimo kainos skirtumą atsako pardavėjas. Pardavėjas gali nurodyti atskirą siuntimo kainą į kitas ES šalis. Jeigu siuntimo kainos į pirkėjo šalį pardavėjas nenurodė, pirkėjas dėl kainos teiraujasi pardavėjo, o apmokėti siuntimą per platformą galima tik kainą nurodžius. Siunčiant ne į Europos Sąjungą arba ne iš jos, gali būti taikomi muito, importo PVM ir kiti mokesčiai; juos moka gavėjas, jei su pardavėju nesutarta kitaip. Kainą su PVM gali nurodyti tik pardavėjas, kurio PVM mokėtojo kodas patikrintas ES registre.',
      'Kiekvienas skelbimas prieš paskelbiant tikrinamas automatiškai, pasitelkiant dirbtinį intelektą (DI): ar tai transporto dalis, ar nuotraukos atitinka aprašymą, ar skelbimas nėra šlamštas ar apgaulė. Atmestą skelbimą galite pataisyti ir pateikti iš naujo arba kreiptis į mus dėl peržiūros.',
      'DI įrankiai gali pasiūlyti dalies pavadinimą, numerį, kitus kodus, tinkamus automobilius, gamybos metus, kainą ir siuntimo kainą. Tai tik pasiūlymai: DI gali suklysti, ypač skaitydamas smulkius ar apverstus numerius. Už paskelbto skelbimo teisingumą atsako pardavėjas, todėl prieš skelbdami numerius ir kodus palyginkite su etikete ant dalies.',
      'Draudžiama skelbti vogtas, suklastotas dalis, su transportu nesusijusius daiktus, klaidinančią ar įžeidžiančią informaciją, kitų asmenų duomenis ir svetimas nuotraukas be leidimo.',
    ],
  },
  {
    title: '5. Derybos ir susitarimas',
    paragraphs: [
      'Pirkėjas gali pasiūlyti savo kainą, o pardavėjas ją priimti, atmesti arba pasiūlyti kitą. Priimtas pasiūlymas reiškia, kad šalys susitarė dėl kainos; dėl apmokėjimo ir perdavimo jos susitaria tarpusavyje arba atsiskaito per platformą.',
      'Mokėjimai per platformą. Jeigu pardavėjas yra nustatęs išmokas, pirkėjas gali sumokėti mokėjimo kortele ar kitu mokėjimo lange siūlomu būdu. Mokėjimus priima, lėšas laiko ir pardavėjams išmoka mokėjimo paslaugų teikėjas „Stripe“ (Stripe Payments Europe, Ltd.); mes pirkėjų ir pardavėjų lėšų nelaikome ir mokėjimo kortelių duomenų negauname. Pardavėjas, norėdamas gauti išmokas, sudaro sutartį su „Stripe“ ir pateikia jai tapatybės bei banko sąskaitos duomenis.',
      'Pinigai pardavėjui pervedami, kai pirkėjas patvirtina, kad dalį gavo ir ji atitinka skelbimą. Pažymėjęs, kad dalį gavo, pirkėjas turi 5 dienas jai patikrinti; per šį laiką nepranešus apie problemą, pinigai pervedami pardavėjui savaime. Jeigu pirkėjas gavimo nepažymi ir apie problemą nepraneša, pinigai pervedami praėjus 14 dienų nuo tada, kai pardavėjas pažymėjo išsiuntimą ar perdavimą.',
      'Jeigu pardavėjas dalies neišsiunčia per 7 dienas nuo apmokėjimo, pirkėjas gali užsakymą atšaukti ir atgauti visą sumą. Pardavėjas iki išsiuntimo taip pat gali užsakymą atšaukti – pinigai grąžinami pirkėjui. Pirkėjui pranešus apie problemą, pinigai sulaikomi, kol išnagrinėsime abiejų šalių paaiškinimus; sprendimą priimame pagal skelbimo turinį ir pateiktus įrodymus. Tai neriboja šalių teisės kreiptis į teismą ar vartotojų ginčus nagrinėjančią instituciją.',
      'Įvykdžius užsakymą, pirkėjas ir pardavėjas gali įvertinti vienas kitą ir palikti atsiliepimą. Atsiliepimas turi būti teisingas ir susijęs su konkrečiu sandoriu; įžeidžiančius ar su sandoriu nesusijusius atsiliepimus galime pašalinti.',
      'Perkant per platformą pirkėjas moka pirkėjo apsaugos mokestį: 4,5 % nuo dalies kainos ir pristatymo sumos, pridedant 0,45 €, ir 1 € administravimo mokestį už kiekvieną užsakymą (abu su PVM). Mokesčiai rodomi prieš apmokant; pirkėjo apsaugos mokestis apima saugų mokėjimą bei lėšų laikymą iki dalies gavimo. Grąžinant pinigus pirkėjui, grąžinama visa sumokėta suma, įskaitant šiuos mokesčius. Pardavėjui mokesčiai netaikomi – jis gauna visą dalies kainą ir pristatymo mokestį.',
    ],
  },
  {
    title: '6. Verslo pardavėjai ir vartotojų teisės',
    paragraphs: [
      'Jeigu pardavėjas yra verslas, o pirkėjas – vartotojas, pirkėjui taikomos įstatymų nustatytos vartotojų teisės, įskaitant teisę per 14 dienų atsisakyti nuotoliniu būdu sudarytos sutarties ir teisę į kokybės garantiją. Šias pareigas vykdo pardavėjas.',
      'Perkant iš privataus asmens, vartotojų teisių apsaugos taisyklės netaikomos; taikomos bendrosios pirkimo–pardavimo taisyklės.',
    ],
  },
  {
    title: '7. Tvarka platformoje',
    paragraphs: [
      'Apie netinkamą skelbimą galite pranešti mygtuku „Pranešti apie skelbimą“, o naudotoją – užblokuoti. Užblokavus nebematote jo skelbimų ir pokalbių, o jis negali jums rašyti.',
      'Turime teisę pašalinti taisykles pažeidžiantį skelbimą, o pasikartojus pažeidimams ar esant sunkiam pažeidimui – apriboti arba panaikinti paskyrą.',
    ],
  },
  {
    title: '8. Intelektinė nuosavybė ir duomenų rinkimo draudimas',
    paragraphs: [
      `Pavadinimas „Partaza“, logotipas, platformos dizainas, programinė įranga, tekstai ir duomenų bazė priklauso ${COMPANY.name} arba naudojami teisėtu pagrindu. Skelbimo tekstai ir nuotraukos lieka jų autoriaus nuosavybe; įkeldami juos, suteikiate mums neišimtinę, neatlygintiną teisę juos rodyti, saugoti, pritaikyti (pavyzdžiui, sumažinti nuotrauką, išversti tekstą) ir viešinti platformoje bei ją reklamuojant, kol skelbimas yra platformoje.`,
      'Be išankstinio rašytinio mūsų sutikimo draudžiama: automatiškai rinkti ar kopijuoti platformos turinį (robotais, skreperiais ar panašiomis priemonėmis); kopijuoti, perpublikuoti ar parduoti skelbimus, nuotraukas, naudotojų duomenis, duomenų bazę ar esminę jos dalį; naudoti platformos turinį konkuruojančiai paslaugai kurti arba dirbtinio intelekto modeliams mokyti; apeiti techninius ribojimus, užklausų ribas ar apsaugos priemones; kopijuoti platformos dizainą ar programinę įrangą.',
      'Paieškos sistemoms leidžiama indeksuoti viešus puslapius pagal svetainės „robots.txt“ nurodymus. Pažeidus šį skyrių, galime apriboti prieigą, panaikinti paskyrą ir reikalauti atlyginti nuostolius.',
    ],
  },
  {
    title: '9. Kaina',
    paragraphs: [
      'Skelbti ir parduoti platformoje pardavėjui nemokama. Pirkėjas, pirkdamas per platformą, moka 5 skyriuje nurodytus mokesčius; jie rodomi prieš apmokant.',
      'Jeigu atsiras kitų mokamų paslaugų (pavyzdžiui, skelbimo iškėlimas), jų kaina bus aiškiai parodyta prieš jums jomis pasinaudojant.',
    ],
  },
  {
    title: '10. Atsakomybė',
    paragraphs: [
      'Stengiamės, kad platforma veiktų be trikdžių, tačiau bandomuoju laikotarpiu negarantuojame, kad ji veiks nepertraukiamai ir be klaidų. Kainos patarimai, siuntimo kainos įverčiai ir automatiškai užpildyti skelbimo laukai yra pagalbinė informacija – juos privalote patikrinti patys.',
      'Neatsakome už naudotojų skelbimų turinį, dalių kokybę ir naudotojų tarpusavio įsipareigojimų vykdymą. Tai neriboja atsakomybės, kurios pagal įstatymus apriboti negalima.',
    ],
  },
  {
    title: '11. Pakeitimai, taikoma teisė ir kontaktai',
    paragraphs: [
      'Taisykles galime keisti; apie esminius pakeitimus pranešime platformoje. Toliau naudodamiesi platforma po pakeitimų įsigaliojimo, su jais sutinkate.',
      'Taisyklėms taikoma Lietuvos Respublikos teisė. Vartotojai ginčus ne teismo tvarka gali spręsti Valstybinėje vartotojų teisių apsaugos tarnyboje (vvtat.lt).',
      'Taisyklės skelbiamos lietuvių ir anglų kalbomis. Esant neatitikimų, taikomas tekstas lietuvių kalba.',
      `Su mumis galite susisiekti ${contact}.`,
    ],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: '1. Duomenų valdytojas',
    paragraphs: [
      `Jūsų asmens duomenis tvarko ${COMPANY.name}, juridinio asmens kodas ${COMPANY.code}, buveinė ${COMPANY.address}. Dėl savo duomenų galite kreiptis ${contact}.`,
    ],
  },
  {
    title: '2. Kokius duomenis tvarkome',
    paragraphs: [
      'Paskyros duomenys: el. pašto adresas, slaptažodis (saugomas tik užšifruota forma, mes jo nematome), vardas arba pavadinimas, pardavėjo statusas (privatus asmuo ar verslas), telefono numeris.',
      'Skelbimų duomenys: pavadinimas, aprašymas, dalies numeris ir kiti kodai, kaina, miestas, nuotraukos. Šie duomenys yra vieši.',
      'Užsakymų duomenys: ką pirkote ar pardavėte, sumos, užsakymo būsena, pristatymo adresas ir telefonas, ginčo paaiškinimai. Juos mato užsakymo pirkėjas, pardavėjas ir mes.',
      'Atsiliepimai ir įvertinimai, kuriuos paliekate ar gaunate po sandorio. Jie yra vieši.',
      'Susirašinėjimas ir kainų pasiūlymai: juos mato tik pokalbio dalyviai. Pranešimai apie skelbimus ir blokavimai: juos matote tik jūs.',
      'Pardavėjo apskaitos duomenys, kuriuos įrašote patys (pirkimo kainos, ardomi automobiliai, pardavimo sumos): juos matote tik jūs.',
      'Techniniai duomenys: IP adresas, naršyklės tipas ir užklausų laikas, kuriuos fiksuoja serveriai, kad paslauga veiktų ir būtų saugi.',
    ],
  },
  {
    title: '3. Kas matoma kitiems',
    paragraphs: [
      'Kiti naudotojai mato jūsų vardą arba pavadinimą, pardavėjo statusą, registracijos metus, įvertinimą, gautus atsiliepimus ir jūsų skelbimus. El. pašto adreso ir telefono numerio kitiems naudotojams nerodome.',
    ],
  },
  {
    title: '4. Kam ir kokiu pagrindu naudojame',
    paragraphs: [
      'Paskyrai sukurti, skelbimams rodyti ir susirašinėjimui užtikrinti – tai būtina sutarčiai su jumis vykdyti (BDAR 6 str. 1 d. b p.).',
      'Skelbimams automatiškai tikrinti prieš paskelbiant ir DI įrankiams, kuriais naudojatės patys (dalies atpažinimas, kainos ir siuntimo įvertis) – sutarčiai vykdyti ir mūsų teisėtam interesui užtikrinti platformos kokybę. Sprendimą atmesti skelbimą galite ginčyti kreipdamiesi į mus – jį peržiūrės žmogus.',
      'Sukčiavimo prevencijai, pranešimų nagrinėjimui ir platformos saugumui – mūsų teisėtas interesas (BDAR 6 str. 1 d. f p.).',
      'Teisės aktų reikalavimams vykdyti, kai jie mums taikomi (BDAR 6 str. 1 d. c p.).',
      'Reklamos tikslais jūsų duomenų nenaudojame ir jų neparduodame.',
    ],
  },
  {
    title: '5. Duomenų tvarkytojai',
    paragraphs: [
      '„Supabase“ – duomenų bazė, paskyrų sistema ir nuotraukų saugykla. Duomenys laikomi Europos Sąjungoje (Frankfurtas, Vokietija).',
      '„Stripe“ (Stripe Payments Europe, Ltd., Airija) – mokėjimų priėmimas ir išmokos pardavėjams. Perkant ar nustatant išmokas, „Stripe“ kaip savarankiškas duomenų valdytojas tvarko mokėjimo, tapatybės ir banko sąskaitos duomenis; mes gauname tik mokėjimo būseną, sumą, o pristatymui – pirkėjo nurodytą adresą ir telefoną, kuriuos matome mes ir užsakymo pardavėjas.',
      '„Anthropic“ – dirbtinio intelekto paslauga. Jai perduodamos jūsų įkeltos dalies nuotraukos ir skelbimo duomenys (ne jūsų vardas, el. paštas ar telefonas), kad būtų atpažinta dalis, patikrintas skelbimas, rastos kainos. Duomenys gali būti tvarkomi JAV, taikant standartines sutarčių sąlygas.',
      '„Vercel“ – svetainės talpinimas. Šis teikėjas gali fiksuoti techninius duomenis (IP adresą) ir tvarkyti juos už Europos ekonominės erdvės ribų, taikydamas standartines sutarčių sąlygas.',
      'Kitiems asmenims duomenis perduodame tik tada, kai to reikalauja įstatymai (pavyzdžiui, teisėsaugos institucijoms pagal teisėtą prašymą).',
    ],
  },
  {
    title: '6. Kiek laiko saugome',
    paragraphs: [
      'Paskyros, skelbimų ir susirašinėjimo duomenis saugome, kol turite paskyrą. Ištrynus paskyrą, jie ištrinami. Kitų naudotojų gautos jūsų žinutės ištrinamos kartu su pokalbiu.',
      'Užsakymų ir mokėjimų įrašus saugome tiek, kiek reikalauja buhalterinės apskaitos ir mokesčių teisės aktai, net ir ištrynus paskyrą.',
      'Nepatvirtinta paskyra ištrinama automatiškai po 15 minučių. Techniniai serverių įrašai saugomi teikėjų nustatytą trumpą laiką.',
    ],
  },
  {
    title: '7. Duomenys jūsų įrenginyje',
    paragraphs: [
      'Sekimo ir reklamos slapukų nenaudojame. Jūsų įrenginyje saugome tik tai, kas būtina veikimui: prisijungimo būseną, pasirinktą „mano automobilį“ ir informaciją, kuriuos pokalbius jau perskaitėte, pasirinktą kalbą ir jūsų atsakymą dėl vietos naudojimo. Jeigu leidžiate naudoti vietą, pagal apytiksles (maždaug kilometro tikslumo) koordinates nustatome jūsų šalį ir miestą, kad rodytume dalis šalia jūsų; tam naudojama „OpenStreetMap“ paieškos paslauga „Nominatim“. Koordinačių nesaugome, o šalis ir miestas laikomi tik jūsų įrenginyje. Brūkšniniai ir QR kodai nuotraukose nuskaitomi jūsų įrenginyje.',
    ],
  },
  {
    title: '8. Jūsų teisės',
    paragraphs: [
      'Turite teisę susipažinti su savo duomenimis, juos ištaisyti, ištrinti, apriboti jų tvarkymą, gauti juos perkeliamu formatu ir nesutikti su tvarkymu, kuris grindžiamas teisėtu interesu.',
      'Vardą, statusą, telefono numerį ir skelbimus galite pakeisti patys programėlėje, o paskyrą ištrinti skiltyje „Profilis“. Dėl kitų prašymų kreipkitės nurodytais kontaktais – atsakysime per vieną mėnesį.',
      'Jeigu manote, kad jūsų duomenys tvarkomi netinkamai, galite pateikti skundą Valstybinei duomenų apsaugos inspekcijai (vdai.lrv.lt).',
    ],
  },
  {
    title: '9. Pakeitimai',
    paragraphs: ['Šią politiką galime atnaujinti, kai keičiasi platformos funkcijos ar teikėjai. Apie esminius pakeitimus pranešime platformoje. Politika skelbiama lietuvių ir anglų kalbomis; esant neatitikimų, taikomas tekstas lietuvių kalba.'],
  },
];
