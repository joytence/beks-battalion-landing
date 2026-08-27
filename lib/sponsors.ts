export const sponsorPackages = [
  {
    tier: "Platinum Sponsor",
    title: "Top Visibility",
    price: "$2,500",
    items: [
      "Logo on all promotional materials",
      "10 SVIP guest passes included",
      "Stage recognition during the event",
      "Booth or display space",
      "Social media promotion before and after",
    ],
    featured: false,
  },
  {
    tier: "Gold Sponsor",
    title: "High Impact",
    price: "$1,500",
    items: [
      "Logo on posters and social media",
      "6 SVIP tickets included",
      "Stage recognition",
      "Booth or display space",
      "Preferred sponsor placement",
    ],
    featured: true,
  },
  {
    tier: "Silver Sponsor",
    title: "Community Support",
    price: "$750",
    items: [
      "Logo on selected promotional materials",
      "3 tickets included in the package",
      "Social media shout-out",
      "Supporter recognition",
      "Budget-friendly entry point",
    ],
    featured: false,
  },
] as const;

export const sponsorLogos = [
  {
    name: "John De Leon Enterprise",
    src: "/assets/john-deleon-enterprize.jpg",
    href: undefined,
    wide: false,
    luna: false,
  },
  {
    name: "Manila Bistro",
    src: "/assets/manila-bistro-logo.jpg",
    href: "https://www.facebook.com/manilabistro.sd/",
    wide: false,
    luna: false,
  },
  {
    name: "JPM Lights and Sounds",
    src: "/assets/jpm-lights-and-sounds.jpg",
    href: "https://www.facebook.com/profile.php?id=100051323666388",
    wide: false,
    luna: false,
  },
  {
    name: "Ashhmarie Skin Care",
    src: "/assets/ashhmarie-logo.webp",
    href: "https://www.ashmarieskincare.com",
    wide: false,
    luna: false,
  },
  {
    name: "Mrs. B's Realty",
    src: "/assets/mrs-b-realty-transparent.png",
    href: "https://bernadethhuertas.com",
    wide: true,
    luna: false,
  },
  {
    name: "Doctora Rosana Alfonso DDS",
    src: "/assets/doctora-rosana-alfonso.png",
    href: "https://www.miramesasandiegodentistry.com",
    wide: true,
    luna: false,
  },
  {
    name: "Luna Band PH",
    src: "/assets/luna-band-ph.png",
    href: undefined,
    wide: false,
    luna: true,
  },
] as const;
