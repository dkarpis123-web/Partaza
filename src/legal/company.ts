/** The legal entity that runs Partaza. Shown in the terms and the privacy policy. */
export const COMPANY = {
  name: 'MB „Sintela“',
  code: '304127980',
  vat: 'LT100009776219',
  address: 'Brastos g. 7/4, Kaunas, Lietuva',
  /** Contact e-mail for users; empty until the owner provides one. */
  email: '',
  site: 'https://partaza.eu',
  version: '2026-11-20',
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
      'Platforma veikia bandomuoju laikotarpiu: funkcijos gali keistis, o kai kurios dar neveikia (mokėjimai per platformą, siuntų užsakymas, pirkėjo apsauga).',
    ],
  },
  {
    title: '2. Mūsų vaidmuo',
    paragraphs: [
      'Mes suteikiame vietą skelbimams ir susirašinėjimui. Pirkimo–pardavimo sutartį sudaro pirkėjas ir pardavėjas tarpusavyje; mes nesame šios sutarties šalis, dalių neparduodame, netikriname ir nesaugome.',
      'Kol mokėjimai per platformą neįjungti, dėl apmokėjimo ir pristatymo pirkėjas ir pardavėjas susitaria patys. Už tokius atsiskaitymus mes neatsakome.',
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
      'Draudžiama skelbti vogtas, suklastotas dalis, su transportu nesusijusius daiktus, klaidinančią ar įžeidžiančią informaciją, kitų asmenų duomenis ir svetimas nuotraukas be leidimo.',
    ],
  },
  {
    title: '5. Derybos ir susitarimas',
    paragraphs: [
      'Pirkėjas gali pasiūlyti savo kainą, o pardavėjas ją priimti, atmesti arba pasiūlyti kitą. Priimtas pasiūlymas reiškia, kad šalys susitarė dėl kainos; dėl apmokėjimo ir perdavimo jos susitaria tarpusavyje.',
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
    title: '8. Kaina',
    paragraphs: [
      'Bandomuoju laikotarpiu naudojimasis platforma yra nemokamas. Jeigu atsiras mokamų paslaugų (pavyzdžiui, pirkėjo apsaugos mokestis), apie jas ir jų kainą pranešime iš anksto, prieš jums jomis pasinaudojant.',
    ],
  },
  {
    title: '9. Atsakomybė',
    paragraphs: [
      'Stengiamės, kad platforma veiktų be trikdžių, tačiau bandomuoju laikotarpiu negarantuojame, kad ji veiks nepertraukiamai ir be klaidų. Kainos patarimai ir automatiškai užpildyti skelbimo laukai yra pagalbinė informacija – juos privalote patikrinti patys.',
      'Neatsakome už naudotojų skelbimų turinį, dalių kokybę ir naudotojų tarpusavio įsipareigojimų vykdymą. Tai neriboja atsakomybės, kurios pagal įstatymus apriboti negalima.',
    ],
  },
  {
    title: '10. Pakeitimai, taikoma teisė ir kontaktai',
    paragraphs: [
      'Taisykles galime keisti; apie esminius pakeitimus pranešime platformoje. Toliau naudodamiesi platforma po pakeitimų įsigaliojimo, su jais sutinkate.',
      'Taisyklėms taikoma Lietuvos Respublikos teisė. Vartotojai ginčus ne teismo tvarka gali spręsti Valstybinėje vartotojų teisių apsaugos tarnyboje.',
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
      'Skelbimų duomenys: pavadinimas, aprašymas, kaina, miestas, nuotraukos. Šie duomenys yra vieši.',
      'Susirašinėjimas ir kainų pasiūlymai: juos mato tik pokalbio dalyviai. Pranešimai apie skelbimus ir blokavimai: juos matote tik jūs.',
      'Pardavėjo apskaitos duomenys, kuriuos įrašote patys (pirkimo kainos, ardomi automobiliai, pardavimo sumos): juos matote tik jūs.',
      'Techniniai duomenys: IP adresas, naršyklės tipas ir užklausų laikas, kuriuos fiksuoja serveriai, kad paslauga veiktų ir būtų saugi.',
    ],
  },
  {
    title: '3. Kas matoma kitiems',
    paragraphs: [
      'Kiti naudotojai mato jūsų vardą arba pavadinimą, pardavėjo statusą, registracijos metus ir jūsų skelbimus. El. pašto adreso ir telefono numerio kitiems naudotojams nerodome.',
    ],
  },
  {
    title: '4. Kam ir kokiu pagrindu naudojame',
    paragraphs: [
      'Paskyrai sukurti, skelbimams rodyti ir susirašinėjimui užtikrinti – tai būtina sutarčiai su jumis vykdyti (BDAR 6 str. 1 d. b p.).',
      'Sukčiavimo prevencijai, pranešimų nagrinėjimui ir platformos saugumui – mūsų teisėtas interesas (BDAR 6 str. 1 d. f p.).',
      'Teisės aktų reikalavimams vykdyti, kai jie mums taikomi (BDAR 6 str. 1 d. c p.).',
      'Reklamos tikslais jūsų duomenų nenaudojame ir jų neparduodame.',
    ],
  },
  {
    title: '5. Duomenų tvarkytojai',
    paragraphs: [
      '„Supabase“ – duomenų bazė, paskyrų sistema ir nuotraukų saugykla. Duomenys laikomi Europos Sąjungoje (Frankfurtas, Vokietija).',
      '„Vercel“ – svetainės talpinimas. Šis teikėjas gali fiksuoti techninius duomenis (IP adresą) ir tvarkyti juos už Europos ekonominės erdvės ribų, taikydamas standartines sutarčių sąlygas.',
      'Kitiems asmenims duomenis perduodame tik tada, kai to reikalauja įstatymai (pavyzdžiui, teisėsaugos institucijoms pagal teisėtą prašymą).',
    ],
  },
  {
    title: '6. Kiek laiko saugome',
    paragraphs: [
      'Paskyros, skelbimų ir susirašinėjimo duomenis saugome, kol turite paskyrą. Ištrynus paskyrą, jie ištrinami. Kitų naudotojų gautos jūsų žinutės ištrinamos kartu su pokalbiu.',
      'Nepatvirtinta paskyra ištrinama automatiškai po 15 minučių. Techniniai serverių įrašai saugomi teikėjų nustatytą trumpą laiką.',
    ],
  },
  {
    title: '7. Duomenys jūsų įrenginyje',
    paragraphs: [
      'Sekimo ir reklamos slapukų nenaudojame. Jūsų įrenginyje saugome tik tai, kas būtina veikimui: prisijungimo būseną, pasirinktą „mano automobilį“ ir informaciją, kuriuos pokalbius jau perskaitėte.',
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
    paragraphs: ['Šią politiką galime atnaujinti, pavyzdžiui, kai atsiras mokėjimai ar siuntų užsakymas. Apie esminius pakeitimus pranešime platformoje.'],
  },
];
