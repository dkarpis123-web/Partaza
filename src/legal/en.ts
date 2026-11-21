import { COMPANY, type LegalSection } from './company';

// English translation of the terms and the privacy policy. The Lithuanian text in company.ts prevails.
const ADDRESS = 'Brastos g. 7/4, Kaunas, Lithuania';
const contact = COMPANY.email ? `by e-mail at ${COMPANY.email} or by post at ${ADDRESS}` : `by post at ${ADDRESS}`;

export const TERMS_EN: LegalSection[] = [
  {
    title: '1. Who we are and what Partaza is',
    paragraphs: [
      `Partaza (${COMPANY.site}) is a marketplace for new and used vehicle parts. It is operated by ${COMPANY.name}, company code ${COMPANY.code}, VAT number ${COMPANY.vat}, registered office ${ADDRESS}.`,
      'The platform is in a trial period: features may change and some do not work yet (for example, ordering a shipment from within the platform).',
    ],
  },
  {
    title: '2. Our role',
    paragraphs: [
      'We provide a place for listings and messaging. The contract of sale is concluded between the buyer and the seller; we are not a party to it and we do not sell, inspect or store the parts.',
      'If the buyer and the seller settle outside the platform, they agree on payment and delivery themselves. We are not responsible for such settlements.',
    ],
  },
  {
    title: '3. Account',
    paragraphs: [
      'An account may be used by persons aged 18 or over and by legal entities. To register you must give a real e-mail address and phone number and confirm the e-mail. An account not confirmed within 15 minutes is deleted.',
      'You must state truthfully whether you trade as a private person or as a business. You are responsible for keeping your password safe.',
      'You can delete your account at any time under "Profile". Your listings, photos and conversations are deleted with it.',
    ],
  },
  {
    title: '4. Listings',
    paragraphs: [
      'The seller is responsible for the listing being true: the name of the part, its number, condition, price and photos must match reality. All known damage and defects must be stated.',
      'You may list only parts and vehicles that you have the right to sell and whose sale is lawful. The seller is responsible for the legality, safety and fitness for use of the part, including parts of safety systems.',
      'Whether a part fits a particular vehicle is shown according to the information given by the seller. Check the part number before buying.',
      'The shipping price in a listing is set by the seller. Shipping prices suggested by the platform by parcel size are indicative and may differ from real carrier prices; the seller bears any difference. The seller may set a separate shipping price to other EU countries. If the seller has not set a shipping price to the buyer\'s country, the buyer asks the seller for it, and shipping can be paid through the platform only once a price is set. For shipments to or from countries outside the European Union, customs duty, import VAT and other charges may apply; they are paid by the recipient unless agreed otherwise with the seller. A price including VAT may be shown only by a seller whose VAT number has been verified in the EU register.',
      'Every listing is checked automatically before it is published, with the help of artificial intelligence (AI): whether it is a vehicle part, whether the photos match the description, and whether the listing is spam or a scam. You can correct a rejected listing and submit it again, or contact us for a review.',
      'AI tools may suggest the name of the part, its number, other codes, the vehicles it fits, production years, a price and a shipping price. These are suggestions only: the AI can be wrong, especially when reading small or upside-down numbers. The seller is responsible for the published listing being correct, so compare the numbers and codes with the label on the part before publishing.',
      'It is forbidden to list stolen or counterfeit parts, items unrelated to vehicles, misleading or offensive information, other people\'s personal data, or someone else\'s photos without permission.',
    ],
  },
  {
    title: '5. Negotiation and agreement',
    paragraphs: [
      'The buyer may offer a price and the seller may accept it, decline it or make a counter-offer. An accepted offer means the parties have agreed on the price; they agree on payment and handover between themselves or pay through the platform.',
      'Payments through the platform. If the seller has set up payouts, the buyer may pay by card or another method offered at checkout. Payments are accepted, funds are held and sellers are paid out by the payment service provider Stripe (Stripe Payments Europe, Ltd.); we do not hold buyers\' or sellers\' funds and do not receive card details. To receive payouts the seller enters into an agreement with Stripe and gives it identity and bank account details.',
      'The money is transferred to the seller when the buyer confirms that the part has been received and matches the listing. After marking the part as received, the buyer has 5 days to check it; if no problem is reported in that time, the money is transferred to the seller automatically. If the buyer neither marks receipt nor reports a problem, the money is transferred 14 days after the seller marked the part as shipped or handed over.',
      'If the seller does not ship the part within 7 days of payment, the buyer may cancel the order and get the full amount back. The seller may also cancel the order before shipping, and the money is returned to the buyer. When the buyer reports a problem, the money is held until we have considered both parties\' explanations; we decide on the basis of the listing and the evidence provided. This does not limit the parties\' right to go to court or to a consumer dispute body.',
      'After an order is completed, the buyer and the seller may rate each other and leave a review. A review must be truthful and relate to the transaction; we may remove reviews that are offensive or unrelated to the transaction.',
      'When buying through the platform the buyer pays a buyer protection fee of 4.5 % of the part price and delivery, plus EUR 0.45, and an administration fee of EUR 1 per order (both including VAT). The fees are shown before payment; the buyer protection fee covers secure payment and holding the funds until the part is received. When money is refunded to the buyer, the whole amount paid is refunded, including these fees. No fees apply to the seller, who receives the full part price and delivery charge.',
    ],
  },
  {
    title: '6. Business sellers and consumer rights',
    paragraphs: [
      'If the seller is a business and the buyer is a consumer, the buyer has the statutory consumer rights, including the right to withdraw from a distance contract within 14 days and the right to a guarantee of quality. These obligations are performed by the seller.',
      'When buying from a private person, consumer protection rules do not apply; the general rules of sale apply.',
    ],
  },
  {
    title: '7. Order on the platform',
    paragraphs: [
      'You can report an unsuitable listing with the "Report listing" button and block a user. After blocking you no longer see their listings and conversations, and they cannot write to you.',
      'We may remove a listing that breaks these terms and, for repeated or serious breaches, restrict or close the account.',
    ],
  },
  {
    title: '8. Intellectual property and ban on data collection',
    paragraphs: [
      `The name Partaza, the logo, the design of the platform, its software, texts and database belong to ${COMPANY.name} or are used on a lawful basis. Listing texts and photos remain the property of their author; by uploading them you grant us a non-exclusive, royalty-free right to display, store, adapt (for example, resize a photo or translate a text) and publish them on the platform and when advertising it, for as long as the listing is on the platform.`,
      'Without our prior written consent it is forbidden to: collect or copy the content of the platform automatically (with bots, scrapers or similar means); copy, republish or sell listings, photos, user data, the database or a substantial part of it; use the content of the platform to build a competing service or to train artificial intelligence models; circumvent technical limits, rate limits or security measures; copy the design or software of the platform.',
      'Search engines may index the public pages as set out in the site\'s robots.txt. If this section is breached we may restrict access, close the account and claim damages.',
    ],
  },
  {
    title: '9. Price',
    paragraphs: [
      'Listing and selling on the platform is free for the seller. A buyer who buys through the platform pays the fees set out in section 5; they are shown before payment.',
      'If other paid services are introduced (for example, promoting a listing), their price will be shown clearly before you use them.',
    ],
  },
  {
    title: '10. Liability',
    paragraphs: [
      'We try to keep the platform running smoothly, but during the trial period we do not guarantee that it will work without interruption or errors. Price advice, shipping estimates and automatically filled listing fields are supporting information – you must check them yourself.',
      'We are not responsible for the content of users\' listings, the quality of parts or the performance of users\' obligations to each other. This does not limit liability that cannot be limited by law.',
    ],
  },
  {
    title: '11. Changes, governing law and contact',
    paragraphs: [
      'We may change these terms; we will announce material changes on the platform. By continuing to use the platform after the changes take effect you accept them.',
      'These terms are governed by the law of the Republic of Lithuania. Consumers may settle disputes out of court at the State Consumer Rights Protection Authority (vvtat.lt).',
      'The terms are published in Lithuanian and English. In case of differences the Lithuanian text prevails.',
      `You can contact us ${contact}.`,
    ],
  },
];

export const PRIVACY_EN: LegalSection[] = [
  {
    title: '1. Data controller',
    paragraphs: [
      `Your personal data is processed by ${COMPANY.name}, company code ${COMPANY.code}, registered office ${ADDRESS}. You can contact us about your data ${contact}.`,
    ],
  },
  {
    title: '2. What data we process',
    paragraphs: [
      'Account data: e-mail address, password (stored only in encrypted form; we cannot see it), name or company name, seller status (private person or business), phone number.',
      'Listing data: title, description, part number and other codes, price, city, photos. This data is public.',
      'Order data: what you bought or sold, amounts, order status, delivery address and phone number, dispute explanations. It is visible to the buyer and the seller of the order and to us.',
      'Reviews and ratings that you leave or receive after a transaction. They are public.',
      'Messages and price offers: visible only to the participants of the conversation. Reports about listings and blocks: visible only to you.',
      'Seller bookkeeping data that you enter yourself (purchase prices, vehicles being dismantled, sale amounts): visible only to you.',
      'Technical data: IP address, browser type and request times, recorded by the servers so that the service works and is secure.',
    ],
  },
  {
    title: '3. What others can see',
    paragraphs: [
      'Other users see your name or company name, seller status, year of registration, rating, the reviews you have received and your listings. We do not show your e-mail address or phone number to other users.',
    ],
  },
  {
    title: '4. Purposes and legal bases',
    paragraphs: [
      'To create your account, show listings and provide messaging – necessary to perform the contract with you (GDPR Art. 6(1)(b)).',
      'To check listings automatically before they are published and for the AI tools you choose to use (part recognition, price and shipping estimates) – to perform the contract and for our legitimate interest in the quality of the platform. You can contest a decision to reject a listing by contacting us – a person will review it.',
      'To prevent fraud, handle reports and keep the platform secure – our legitimate interest (GDPR Art. 6(1)(f)).',
      'To comply with legal requirements where they apply to us (GDPR Art. 6(1)(c)).',
      'We do not use your data for advertising and we do not sell it.',
    ],
  },
  {
    title: '5. Processors',
    paragraphs: [
      'Supabase – database, account system and photo storage. Data is kept in the European Union (Frankfurt, Germany).',
      'Stripe (Stripe Payments Europe, Ltd., Ireland) – accepting payments and paying out sellers. When you buy or set up payouts, Stripe processes payment, identity and bank account data as an independent controller; we receive only the payment status and amount and, for delivery, the address and phone number given by the buyer, which are visible to us and to the seller of the order.',
      'Anthropic – artificial intelligence service. It receives the part photos you upload and the listing data (not your name, e-mail or phone number) in order to recognise the part, check the listing and find prices. The data may be processed in the USA under standard contractual clauses.',
      'Vercel – website hosting. This provider may record technical data (IP address) and process it outside the European Economic Area under standard contractual clauses.',
      'We pass data to others only where the law requires it (for example, to law enforcement on a lawful request).',
    ],
  },
  {
    title: '6. How long we keep data',
    paragraphs: [
      'We keep account, listing and message data for as long as you have an account. When the account is deleted, they are deleted. Your messages received by other users are deleted together with the conversation.',
      'We keep order and payment records for as long as accounting and tax law requires, even after the account is deleted.',
      'An unconfirmed account is deleted automatically after 15 minutes. Technical server logs are kept for the short period set by the providers.',
    ],
  },
  {
    title: '7. Data on your device',
    paragraphs: [
      'We do not use tracking or advertising cookies. On your device we store only what is needed for the service to work: your sign-in state, the chosen "my car", which conversations you have read, the chosen language and your answer about using your location. If you allow location, we use approximate coordinates (to about one kilometre) to work out your country and city so that we can show parts near you; the OpenStreetMap search service Nominatim is used for this. We do not store the coordinates, and the country and city are kept only on your device. Barcodes and QR codes in photos are read on your device.',
    ],
  },
  {
    title: '8. Your rights',
    paragraphs: [
      'You have the right to access your data, have it corrected or erased, restrict its processing, receive it in a portable format, and object to processing based on legitimate interest.',
      'You can change your name, status, phone number and listings yourself in the app and delete your account under "Profile". For other requests contact us using the details above – we will reply within one month.',
      'If you believe your data is processed improperly, you may lodge a complaint with the State Data Protection Inspectorate of Lithuania (vdai.lrv.lt).',
    ],
  },
  {
    title: '9. Changes',
    paragraphs: ['We may update this policy when the features of the platform or our providers change. We will announce material changes on the platform. The policy is published in Lithuanian and English; in case of differences the Lithuanian text prevails.'],
  },
];
