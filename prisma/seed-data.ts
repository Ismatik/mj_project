// Demo data taken from the design prototypes (design/*.dc.html).
// Prices are in somoni. Staff and several guest names are placeholders until the salon provides real data.

export const staff = [
  // name, title, working weekdays (0 = Mon), commission %
  { key: "mavzuna", name: "Мавзуна", title: "Владелица · стилист", workDays: [1, 2, 3, 4, 5], commission: 0 },
  { key: "ines", name: "Инес", title: "Колорист", workDays: [1, 2, 3, 4, 5, 6], commission: 40 },
  { key: "mira", name: "Мира", title: "Брови · ресницы · макияж", workDays: [1, 2, 4, 5, 6], commission: 40 },
  { key: "petra", name: "Петра", title: "Ногтевой сервис", workDays: [1, 2, 3, 4, 5], commission: 40 },
  { key: "dario", name: "Дарио", title: "Парикмахер", workDays: [2, 3, 4, 5, 6], commission: 35, salary: 1000 },
] as const;

export type StaffKey = (typeof staff)[number]["key"];

/** Website profiles of the masters (placeholder texts until the salon writes its own). Photos: temporary stock from the design. */
export const masterProfiles: Record<StaffKey, { bio: string; works?: { url: string; caption: string; category: string }[] }> = {
  mavzuna: {
    bio: "Основательница Mavzunai Jovid и стилист. Подбирает образ под характер и черты лица, ведёт свадебные причёски и стрижки. Гостьи ценят её честный совет — она сама скажет, что пойдёт именно вам.",
    works: [
      {
        url: "https://images.unsplash.com/photo-1688395199230-ab7c7170a4b6?q=75&w=900&auto=format&fit=crop&sat=-100",
        caption: "Укладка для вечернего выхода",
        category: "hair",
      },
    ],
  },
  ines: { bio: "Колорист: окрашивание в один тон, балаяж и шатуш, уход за кожей. Подбирает оттенок под тон кожи и бережёт длину." },
  mira: {
    bio: "Брови, ресницы и макияж — от дневного до свадебного. Архитектура бровей по пропорциям лица, ламинирование ресниц и пробные свадебные образы.",
    works: [
      {
        url: "https://images.unsplash.com/photo-1708134128589-0dfd38b2203a?q=75&w=900&auto=format&fit=crop&sat=-100",
        caption: "Свадебный образ под ключ",
        category: "makeup",
      },
    ],
  },
  petra: { bio: "Ногтевой сервис: маникюр с гель-лаком, педикюр, нюдовые и смелые дизайны. Стерильные инструменты и аккуратная работа с кутикулой." },
  dario: { bio: "Парикмахер: стрижки, укладки и свадебные причёски для невест и гостей торжества." },
};

export const categories = [
  { slug: "hair", name: "Волосы", icon: "scissors" },
  { slug: "nails", name: "Ногти", icon: "hand" },
  { slug: "brows", name: "Брови и ресницы", icon: "eye" },
  { slug: "skin", name: "Уход за кожей", icon: "droplet" },
  { slug: "spa", name: "Спа", icon: "sparkles" },
  { slug: "makeup", name: "Макияж и образы", icon: "brush" },
] as const;

type Cat = (typeof categories)[number]["slug"];

export const services: {
  key: string;
  cat: Cat;
  name: string;
  min: number;
  price: number;
  site: boolean;
  pos: boolean;
  staff: StaffKey[];
  /** Prepayment percent for online bookings */
  deposit?: number;
}[] = [
  { key: "cut", cat: "hair", name: "Стрижка + укладка", min: 60, price: 180, site: true, pos: true, staff: ["dario", "mavzuna"] },
  { key: "color", cat: "hair", name: "Окрашивание в один тон", min: 120, price: 450, site: true, pos: true, staff: ["ines"] },
  { key: "balayage", cat: "hair", name: "Балаяж / шатуш", min: 180, price: 700, site: true, pos: true, staff: ["ines"] },
  { key: "bridalHair", cat: "hair", name: "Свадебная причёска", min: 90, price: 550, site: true, pos: false, staff: ["mavzuna", "dario"] },
  { key: "gel", cat: "nails", name: "Маникюр, гель-лак", min: 90, price: 280, site: true, pos: true, staff: ["petra"] },
  { key: "pedi", cat: "nails", name: "Педикюр", min: 75, price: 320, site: true, pos: true, staff: ["petra"] },
  { key: "nailArt", cat: "nails", name: "Дизайн (за ноготь)", min: 10, price: 15, site: false, pos: false, staff: ["petra"] },
  { key: "brows", cat: "brows", name: "Архитектура бровей", min: 45, price: 150, site: true, pos: true, staff: ["mira"] },
  { key: "lashes", cat: "brows", name: "Ламинирование ресниц", min: 60, price: 340, site: true, pos: true, staff: ["mira"] },
  { key: "skin", cat: "skin", name: "Уход за кожей", min: 60, price: 520, site: true, pos: true, staff: ["ines"] },
  { key: "spaHands", cat: "spa", name: "Спа-уход для рук", min: 45, price: 220, site: false, pos: false, staff: ["petra"] },
  { key: "dayMakeup", cat: "makeup", name: "Макияж дневной", min: 45, price: 250, site: true, pos: false, staff: ["mira"] },
  { key: "eveMakeup", cat: "makeup", name: "Макияж вечерний", min: 60, price: 400, site: true, pos: true, staff: ["mira"] },
  { key: "bridal", cat: "makeup", name: "Свадебный образ под ключ", min: 180, price: 1500, site: true, pos: false, staff: ["mira", "ines"], deposit: 30 },
  { key: "trial", cat: "makeup", name: "Пробный образ", min: 90, price: 950, site: false, pos: false, staff: ["mira"], deposit: 30 },
];

export type ServiceKey = string;

export const guests: {
  key: string;
  name: string;
  phone: string;
  tag: "NEW" | "REGULAR" | "VIP" | "BRIDE";
  /** Visits in history, days since the last visit (relative to "today"), favourite service. */
  visits: number;
  lastDaysAgo: number;
  fav: ServiceKey;
  birthdayWeekday?: number;
}[] = [
  { key: "marta", name: "Марта Каримова", phone: "+992935012214", tag: "VIP", visits: 24, lastDaysAgo: 0, fav: "balayage", birthdayWeekday: 3 },
  { key: "farzona", name: "Фарзона Икромова", phone: "+992987004590", tag: "BRIDE", visits: 3, lastDaysAgo: 3, fav: "trial" },
  { key: "sofia", name: "София Рахимова", phone: "+992901123877", tag: "REGULAR", visits: 17, lastDaysAgo: 0, fav: "gel" },
  { key: "anna", name: "Анна Литвинова", phone: "+992938800451", tag: "REGULAR", visits: 9, lastDaysAgo: 0, fav: "lashes" },
  { key: "sevara", name: "Севара Мирзоева", phone: "+992914551908", tag: "REGULAR", visits: 12, lastDaysAgo: 7, fav: "skin" },
  { key: "leila", name: "Лейла Хамидова", phone: "+992983226733", tag: "NEW", visits: 2, lastDaysAgo: 4, fav: "eveMakeup" },
  { key: "gulnora", name: "Гульнора Ташева", phone: "+992906402816", tag: "VIP", visits: 21, lastDaysAgo: 9, fav: "color" },
  { key: "nargis", name: "Наргис Бобоева", phone: "+992932189042", tag: "REGULAR", visits: 6, lastDaysAgo: 14, fav: "cut" },
  // Guests who appear only in the calendar
  { key: "chloe", name: "Хлоя Бекова", phone: "+992900000101", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "skin" },
  { key: "yuki", name: "Юки Таирова", phone: "+992900000102", tag: "NEW", visits: 0, lastDaysAgo: -1, fav: "cut" },
  { key: "nigora", name: "Нигора Саидова", phone: "+992900000103", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "brows" },
  { key: "zarina", name: "Зарина Алиева", phone: "+992900000104", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "gel" },
  { key: "dilnoza", name: "Дильноза Рашидова", phone: "+992900000105", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "cut" },
  { key: "lola", name: "Лола Хакимова", phone: "+992900000106", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "gel" },
  { key: "malika", name: "Малика Юсупова", phone: "+992900000107", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "cut" },
  { key: "shakhlo", name: "Шахло Камолова", phone: "+992900000108", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "pedi" },
  { key: "aziza", name: "Азиза Назарова", phone: "+992900000109", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "lashes" },
  { key: "mokhira", name: "Мохира Давлатова", phone: "+992900000110", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "eveMakeup" },
  { key: "rukhshona", name: "Рухшона Валиева", phone: "+992900000111", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "gel" },
  { key: "kamila", name: "Камила Саидова", phone: "+992900000112", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "gel" },
  { key: "dilorom", name: "Дилором Азимова", phone: "+992900000113", tag: "REGULAR", visits: 0, lastDaysAgo: -1, fav: "brows" },
];

type Status = "PENDING" | "CONFIRMED" | "IN_CHAIR" | "DONE";

export type SeedAppt = {
  time: string;
  guest: string | null; // guest key, or null for a named group
  guestName?: string;
  label: string;
  service: ServiceKey;
  staff: StaffKey[];
  price: number;
  status?: Status;
};

/** "Кто сегодня в кресле" — today's list from the dashboard. */
export const today: SeedAppt[] = [
  { time: "09:00", guest: "marta", label: "Балаяж + стрижка", service: "balayage", staff: ["ines"], price: 880, status: "DONE" },
  { time: "10:30", guest: "sofia", label: "Гель-лак, пыльная роза", service: "gel", staff: ["petra"], price: 280, status: "DONE" },
  { time: "12:00", guest: "anna", label: "Ламинирование ресниц", service: "lashes", staff: ["mira"], price: 340, status: "IN_CHAIR" },
  { time: "13:30", guest: "chloe", label: "Уход за кожей", service: "skin", staff: ["ines"], price: 520, status: "CONFIRMED" },
  { time: "15:30", guest: "yuki", label: "Стрижка и укладка", service: "cut", staff: ["dario"], price: 180, status: "PENDING" },
  { time: "17:00", guest: "leila", label: "Пробный свадебный образ", service: "trial", staff: ["mira"], price: 950, status: "CONFIRMED" },
];

/** The calendar week from the prototype, by weekday (0 = Mon, closed). */
export const week: SeedAppt[][] = [
  [],
  [
    { time: "09:00", guest: "marta", label: "Балаяж + стрижка", service: "balayage", staff: ["ines"], price: 880 },
    { time: "11:30", guest: "nigora", label: "Брови + ресницы", service: "brows", staff: ["mira"], price: 490 },
    { time: "14:00", guest: "zarina", label: "Маникюр", service: "gel", staff: ["petra"], price: 280 },
    { time: "16:30", guest: "dilnoza", label: "Укладка", service: "cut", staff: ["dario"], price: 180 },
  ],
  [
    { time: "09:30", guest: "sevara", label: "Уход за кожей", service: "skin", staff: ["ines"], price: 520 },
    { time: "12:00", guest: "lola", label: "Гель-лак", service: "gel", staff: ["petra"], price: 280 },
    { time: "15:00", guest: "malika", label: "Стрижка", service: "cut", staff: ["dario"], price: 180 },
  ],
  [
    { time: "11:00", guest: "farzona", label: "Свадебный образ, проба", service: "trial", staff: ["mira"], price: 950 },
    { time: "13:30", guest: "gulnora", label: "Окрашивание", service: "color", staff: ["ines"], price: 450 },
    { time: "17:00", guest: "shakhlo", label: "Педикюр", service: "pedi", staff: ["petra"], price: 320 },
  ],
  [
    { time: "09:00", guest: "aziza", label: "Ламинирование ресниц", service: "lashes", staff: ["mira"], price: 340 },
    { time: "12:30", guest: "mokhira", label: "Макияж вечерний", service: "eveMakeup", staff: ["mira"], price: 400 },
    { time: "14:30", guest: "rukhshona", label: "Маникюр + педикюр", service: "gel", staff: ["petra"], price: 600 },
  ],
  [
    { time: "08:30", guest: "farzona", label: "СВАДЬБА: образ под ключ", service: "bridal", staff: ["mira", "ines"], price: 1500 },
    { time: "09:00", guest: null, guestName: "Мама невесты", label: "Причёска + макияж", service: "bridalHair", staff: ["dario"], price: 800 },
    { time: "10:00", guest: null, guestName: "Подружки ×3", label: "Укладки", service: "cut", staff: ["petra"], price: 540 },
    { time: "15:00", guest: "kamila", label: "Гель-лак", service: "gel", staff: ["petra"], price: 280 },
  ],
  [
    { time: "10:00", guest: "nargis", label: "Стрижка", service: "cut", staff: ["dario"], price: 180 },
    { time: "12:00", guest: "dilorom", label: "Брови", service: "brows", staff: ["mira"], price: 150 },
  ],
];

/** Daily revenue of the last 14 days from the dashboard chart ($ → somoni at ×10). Oldest first. */
export const revenue14 = [420, 510, 380, 640, 720, 560, 480, 690, 750, 610, 530, 820, 700, 486].map((v) => v * 10);

export const dresses = [
  { name: "Платье «Амира»", type: "WEDDING", size: "42–44", price: 900, status: "AVAILABLE", bookedInDays: null },
  { name: "Платье «Ситора»", type: "WEDDING", size: "46–48", price: 850, status: "AVAILABLE", bookedInDays: 6 },
  { name: "Платье «Лола»", type: "EVENING", size: "42", price: 400, status: "AVAILABLE", bookedInDays: null },
  { name: "Платье «Малика»", type: "WEDDING", size: "40–42", price: 1100, status: "AVAILABLE", bookedInDays: 13 },
  { name: "Платье «Наргис»", type: "EVENING", size: "44", price: 350, status: "CLEANING", bookedInDays: null },
  { name: "Платье «Гуландом»", type: "EVENING", size: "46", price: 380, status: "AVAILABLE", bookedInDays: null },
] as const;

export const reminders = [
  "День рождения Марты в четверг — маленький подарок?",
  "Гель-лак «розовое золото» заканчивается (3 шт.)",
  "Отправить советы по уходу гостьям после чисток",
];

export const settings: Record<string, string> = {
  "salon.name": "Mavzunai Jovid — Gallery of Beauty MJ",
  "salon.branch": "Студия на Бухоро",
  "salon.address": "ул. Бухоро, 23/25, 1–2 этаж, Шохмансур, Душанбе",
  "salon.phone": "+992 98 103 11 11",
  "salon.whatsapp": "wa.me/992981031111",
  "salon.instagram": "@mavzunai.jovid.official",
  "salon.instagramGallery": "@mavzunai_jovid_gallery_beauty",
  "salon.hours": "Вт–Вс 09:00–18:00 · Пн — выходной",
  "salon.currency": "сомони (TJS)",
  "site.seoTitle": "Mavzunai Jovid — салон красоты и свадебный зал в Душанбе",
  "site.seoDescription":
    "Gallery of Beauty MJ: волосы, ногти, макияж, свадебные образы и прокат платьев. ул. Бухоро 23/25. Запись в WhatsApp +992 98 103 11 11.",
};

// Website texts, photos and reviews: DEFAULT_CONTENT in src/lib/site-content.ts

export const integrations = ["telegram", "whatsapp", "sms", "payments", "instagram"];

/** Tajik and English names and master profiles for the website (drafts for the salon to review in /admin). */
export const translations = {
  categories: {
    hair: { tg: "Мӯй", en: "Hair" },
    nails: { tg: "Нохун", en: "Nails" },
    brows: { tg: "Абрӯ ва мижгон", en: "Brows & lashes" },
    skin: { tg: "Нигоҳубини пӯст", en: "Skin care" },
    spa: { tg: "Спа", en: "Spa" },
    makeup: { tg: "Ороиш ва симо", en: "Makeup & looks" },
  } as Record<string, { tg: string; en: string }>,
  services: {
    cut: { tg: "Мӯйсаргирӣ + ороиш", en: "Haircut & styling" },
    color: { tg: "Рангкунии якранга", en: "Single-tone colour" },
    balayage: { tg: "Балаяж / шатуш", en: "Balayage / ombré" },
    bridalHair: { tg: "Мӯйороии арӯсӣ", en: "Bridal hairstyle" },
    gel: { tg: "Маникюр, гел-лак", en: "Manicure, gel polish" },
    pedi: { tg: "Педикюр", en: "Pedicure" },
    nailArt: { tg: "Тарҳ (барои як нохун)", en: "Nail art (per nail)" },
    brows: { tg: "Меъмории абрӯ", en: "Brow design" },
    lashes: { tg: "Ламинатсияи мижгон", en: "Lash lamination" },
    skin: { tg: "Нигоҳубини пӯст", en: "Skin care" },
    spaHands: { tg: "Спа-нигоҳубини даст", en: "Spa hand care" },
    dayMakeup: { tg: "Ороиши рӯзона", en: "Day makeup" },
    eveMakeup: { tg: "Ороиши шомгоҳӣ", en: "Evening makeup" },
    bridal: { tg: "Ороиши пурраи арӯсӣ", en: "Complete bridal look" },
    trial: { tg: "Ороиши озмоишӣ", en: "Trial look" },
  } as Record<string, { tg: string; en: string }>,
  staff: {
    mavzuna: {
      en: { name: "Mavzuna", specialty: "Owner · stylist", bio: "Founder of Mavzunai Jovid and a stylist. She chooses a look to suit your character and features, and does bridal hairstyles and cuts. Guests value her honest advice — she'll tell you herself what suits you." },
      tg: { specialty: "Соҳиби салон · стилист", bio: "Асосгузори Mavzunai Jovid ва стилист. Ороишро мувофиқи хислат ва симои шумо интихоб мекунад, мӯйороии арӯсӣ ва мӯйсаргирӣ мекунад. Меҳмонон маслиҳати самимии ӯро қадр мекунанд — худаш мегӯяд, ки маҳз ба шумо чӣ мувофиқ аст." },
    },
    ines: {
      en: { name: "Ines", specialty: "Colourist", bio: "Colourist: single-tone colour, balayage and ombré, skin care. She matches the shade to your skin tone and protects your length." },
      tg: { specialty: "Колорист", bio: "Колорист: рангкунии якранга, балаяж ва шатуш, нигоҳубини пӯст. Рангро мувофиқи ранги пӯст интихоб мекунад ва дарозии мӯйро нигоҳ медорад." },
    },
    mira: {
      en: { name: "Mira", specialty: "Brows · lashes · makeup", bio: "Brows, lashes and makeup — from everyday to bridal. Brow design to your facial proportions, lash lamination and bridal trial looks." },
      tg: { specialty: "Абрӯ · мижгон · ороиш", bio: "Абрӯ, мижгон ва ороиш — аз рӯзона то арӯсӣ. Меъмории абрӯ мувофиқи таносуби рӯй, ламинатсияи мижгон ва ороишҳои озмоишии арӯсӣ." },
    },
    petra: {
      en: { name: "Petra", specialty: "Nail technician", bio: "Nails: gel manicure, pedicure, nude and bold designs. Sterile tools and careful cuticle work." },
      tg: { specialty: "Устои нохун", bio: "Хизматрасонии нохун: маникюр бо гел-лак, педикюр, тарҳҳои нарм ва ҷасур. Асбобҳои стерилӣ ва кори бодиққат бо кутикула." },
    },
    dario: {
      en: { name: "Dario", specialty: "Hairdresser", bio: "Hairdresser: cuts, styling and bridal hairstyles for brides and their guests." },
      tg: { specialty: "Сартарош", bio: "Сартарош: мӯйсаргирӣ, ороиши мӯй ва мӯйороии арӯсӣ барои арӯсон ва меҳмонони тӯй." },
    },
  } as Record<string, Record<"tg" | "en", { name?: string; specialty: string; bio: string }>>,
  captions: {
    mavzuna0: { tg: "Ороиши мӯй барои шом", en: "Evening styling" },
    mira0: { tg: "Ороиши пурраи арӯсӣ", en: "Complete bridal look" },
  } as Record<string, { tg: string; en: string }>,
};

/** Demo gift certificates (codes are fixed so the demo can be tried at the till) */
export const giftCards = [
  { code: "MJ-7K2P-QX4M", token: "demo-gift-7k2p-qx4m-5b1c9e", amount: 1000, balance: 1000, recipient: "Нигора", buyer: "Фарзона Икромова", buyerPhone: "+992987004590", message: "С днём рождения! Твоя Фарзона", daysAgo: 12 },
  { code: "MJ-4HWD-8RTA", token: "demo-gift-4hwd-8rta-2f7a1d", amount: 500, balance: 0, recipient: "Мохира", buyer: "Лейла Хамидова", buyerPhone: "+992983226733", message: null, daysAgo: 40 },
];
