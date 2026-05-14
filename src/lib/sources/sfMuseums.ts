import type { SourceDefinition, NormalizedEvent } from "../types";

// Curated SF museums & always-open kid-friendly venues. Same shape as parks.ts
// but for San Francisco, where most museums are paid and don't expose machine-
// readable event feeds. These appear as evergreen cards on every day.
//
// For venues that DO have scrapeable kid programming (e.g. Randall Museum's
// Saturday Science via iCal), use a dedicated event source instead — they get
// real dated events that rank correctly on schedule.

interface Museum {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  indoorness: "indoor" | "outdoor";
  cost: "free" | "paid";
  url: string;
}

const MUSEUMS: Museum[] = [
  {
    id: "cal-academy",
    name: "California Academy of Sciences",
    lat: 37.7699,
    lng: -122.4661,
    description:
      "Aquarium, planetarium, rainforest dome, and natural history under one Golden Gate Park roof. Stroller-friendly. Free for SF residents on quarterly Neighborhood Free Days.",
    ageMinMonths: 6,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "paid",
    url: "https://www.calacademy.org/",
  },
  {
    id: "exploratorium",
    name: "Exploratorium",
    lat: 37.8017,
    lng: -122.3973,
    description:
      "Hands-on science museum on Pier 15. Tactile exhibits, light play, water tables. Free for under-4. Free first Wednesday of the month.",
    ageMinMonths: 12,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "paid",
    url: "https://www.exploratorium.edu/",
  },
  {
    id: "childrens-creativity-museum",
    name: "Children's Creativity Museum",
    lat: 37.7842,
    lng: -122.4029,
    description:
      "Tech-and-art focused kids museum in Yerba Buena Gardens. Animation studio, music studio, and an outdoor 1906 carousel ($5). Best for ages 2–10.",
    ageMinMonths: 24,
    ageMaxMonths: 120,
    indoorness: "indoor",
    cost: "paid",
    url: "https://creativity.org/",
  },
  {
    id: "de-young-museum",
    name: "de Young Museum",
    lat: 37.7715,
    lng: -122.4685,
    description:
      "Fine art museum in Golden Gate Park. Free Saturday Cultural Encounters drop-in family art-making 10:30 AM–3:30 PM. Free for under-17. Tower observation deck is free.",
    ageMinMonths: 12,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "paid",
    url: "https://deyoung.famsf.org/",
  },
  {
    id: "sfmoma",
    name: "SFMOMA",
    lat: 37.7857,
    lng: -122.4011,
    description:
      "Modern art museum with a large rooftop sculpture garden and family guides at front desk. Free for under-18.",
    ageMinMonths: 24,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "paid",
    url: "https://www.sfmoma.org/",
  },
  {
    id: "asian-art-museum",
    name: "Asian Art Museum",
    lat: 37.7798,
    lng: -122.4163,
    description:
      "Civic Center museum with monthly Target Free Sundays (1st Sunday) including family art-making. Free for under-12 always.",
    ageMinMonths: 24,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "paid",
    url: "https://asianart.org/",
  },
  {
    id: "walt-disney-family-museum",
    name: "Walt Disney Family Museum",
    lat: 37.7991,
    lng: -122.4583,
    description:
      "Tells Walt Disney's life story through animation, sound, and interactive exhibits. In the Presidio. Storytime programs for under-5 on select Saturdays.",
    ageMinMonths: 36,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "paid",
    url: "https://www.waltdisney.org/",
  },
  {
    id: "contemporary-jewish-museum",
    name: "Contemporary Jewish Museum",
    lat: 37.7860,
    lng: -122.4030,
    description:
      "Modern Jewish art and culture museum in Yerba Buena. Family Fun Days on select Sundays. Free for under-18.",
    ageMinMonths: 36,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "paid",
    url: "https://www.thecjm.org/",
  },
  {
    id: "sf-zoo",
    name: "San Francisco Zoo",
    lat: 37.7325,
    lng: -122.5026,
    description:
      "Family-friendly zoo by Ocean Beach. Little Puffer steam train, Family Farm, and a children's zoo area. Stroller rentals onsite.",
    ageMinMonths: 6,
    ageMaxMonths: 144,
    indoorness: "outdoor",
    cost: "paid",
    url: "https://www.sfzoo.org/",
  },
  {
    id: "aquarium-of-the-bay",
    name: "Aquarium of the Bay",
    lat: 37.8090,
    lng: -122.4099,
    description:
      "Small aquarium at PIER 39 focused on local SF Bay wildlife. Walk-through underwater tunnels, touch tide pools. Manageable in 60–90 min with toddlers.",
    ageMinMonths: 12,
    ageMaxMonths: 120,
    indoorness: "indoor",
    cost: "paid",
    url: "https://www.aquariumofthebay.org/",
  },
  {
    id: "conservatory-of-flowers",
    name: "Conservatory of Flowers",
    lat: 37.7726,
    lng: -122.4607,
    description:
      "Victorian glasshouse in Golden Gate Park with butterflies, carnivorous plants, and an aquatic plants room. Small but kid-magical. Free first Tuesday of the month.",
    ageMinMonths: 12,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "paid",
    url: "https://conservatoryofflowers.org/",
  },
  {
    id: "japanese-tea-garden",
    name: "Japanese Tea Garden",
    lat: 37.7702,
    lng: -122.4702,
    description:
      "Oldest public Japanese garden in the US. Koi pond, pagoda, drum bridge. Free entry Mon/Wed/Fri before 10 AM. Tea house onsite.",
    ageMinMonths: 12,
    ageMaxMonths: 144,
    indoorness: "outdoor",
    cost: "paid",
    url: "https://japaneseteagardensf.com/",
  },
  {
    id: "bay-model-visitor-center",
    name: "Bay Model Visitor Center (Sausalito)",
    lat: 37.8632,
    lng: -122.4889,
    description:
      "Free Army Corps of Engineers facility with a 1.5-acre working hydraulic model of SF Bay. Big-kid wow-factor. Tue–Sat. Just across the Golden Gate Bridge.",
    ageMinMonths: 36,
    ageMaxMonths: 144,
    indoorness: "indoor",
    cost: "free",
    url: "https://www.spn.usace.army.mil/Missions/Recreation/Bay-Model-Visitor-Center/",
  },
];

export const sfMuseumsSource: SourceDefinition = {
  id: "sfMuseums",
  name: "SF Museums",
  description: "Curated San Francisco kid-friendly museums & always-open venues",
  async fetch() {
    const events: NormalizedEvent[] = MUSEUMS.map((m) => ({
      sourceId: "sfMuseums",
      externalId: m.id,
      title: m.name,
      description: m.description,
      // Evergreen — anchor to now so it sorts as "available today".
      startAt: new Date(),
      endAt: null,
      location: m.name,
      lat: m.lat,
      lng: m.lng,
      ageMinMonths: m.ageMinMonths,
      ageMaxMonths: m.ageMaxMonths,
      indoorness: m.indoorness,
      cost: m.cost,
      registration: "walk-in",
      scheduleLabel: null,
      url: m.url,
      evergreen: true,
    }));
    return { events };
  },
};
